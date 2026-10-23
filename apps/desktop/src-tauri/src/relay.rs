// The building blocks of the servers the app runs for other devices on the
// local network. Live follow (follow.rs) is the first; each server brings
// its own routes, port, seat limit and token policy, and this module brings
// what they share:
//
//   Session   the lifecycle: bind the preferred port on every interface (a
//             free one when it fails), serve, stop within STOP_WAIT
//   Gate      what a session's routes read: the stop flag, the seats, the beat
//   Seat      one viewer's place, counted while it is held
//   pump      the loop that serves one viewer from a `Source` (ping, beat,
//             stop); relay_to is its user for the latest value of a `watch`
//   with_assets  the app's own files, as a router's fallback
//   token, token_matches, lan_address
//
// The server is a hand-rolled hyper accept loop: at most MAX_CONNECTIONS
// connections still in HTTP, each with a header timeout; a viewer that stops
// answering pings loses its seat.
//
// This module knows nothing of Tauri: the app's files come through an
// `Assets` lookup and the viewer count goes out through `OnViewers`, so the
// tests run the real server without an app.

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::WebSocketUpgrade;
use axum::extract::ws::{CloseFrame, Message, Utf8Bytes, WebSocket};
use axum::http::{HeaderValue, Method, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hyper::server::conn::http1;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::service::TowerToHyperService;
use std::future::Future;
use std::io;
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::{JoinHandle, JoinSet};
use tokio::time::MissedTickBehavior;

/// The most HTTP connections at once on one listener, before any upgrade:
/// the seats' viewers loading the page together, with room to spare. One more
/// is closed as soon as it is accepted, so a device that opens many and sends
/// nothing cannot run the app out of sockets.
pub const MAX_CONNECTIONS: usize = 32;

/// hyper's read buffer for one connection: a request is a short GET.
/// hyper's own floor is 8 KiB.
const MAX_BUFFER: usize = 16 * 1024;

/// The server's clocks, shorter in the tests.
#[derive(Clone, Copy)]
pub struct Timing {
    /// How long a connection may take to send a request's headers, and stay
    /// idle between two requests
    pub headers: Duration,
    /// How often a viewer is pinged and sent a beat: one that has not
    /// answered the last ping by the next one is dropped
    pub beat: Duration,
}

pub const TIMING: Timing = Timing {
    beat: Duration::from_secs(15),
    headers: Duration::from_secs(10),
};

/// The frame a viewer gets with each ping: a page cannot see pings, and a
/// beat that stops coming tells it the connection died.
pub const BEAT: &str = "{\"beat\":true}";

/// How long the accept loop pauses after a failed accept (out of file
/// descriptors, say), rather than spinning.
const ACCEPT_PAUSE: Duration = Duration::from_millis(100);

/// A viewer sends nothing the server reads: anything longer is cut off.
const MAX_INCOMING: usize = 4096;

/// A viewer that takes longer to accept one frame is dropped, so a stalled
/// device cannot hold a seat (one that vanished is caught by the beat).
const SEND_TIMEOUT: Duration = Duration::from_secs(10);

/// How long a closing socket waits for the viewer's own close frame.
const CLOSE_WAIT: Duration = Duration::from_secs(1);

/// How long `stop` waits for the server and the viewers to wind down.
const STOP_WAIT: Duration = Duration::from_secs(2);

/// The close codes a viewer reads (a browser cannot read an HTTP status on a
/// refused WebSocket, so a refusal is an accepted socket closed at once).
pub mod close {
    /// The token is missing or not this session's: the link is out of date.
    pub const TOKEN: u16 = 4401;
    /// The server is stopped by the player.
    pub const STOPPED: u16 = 4410;
    /// The seat limit is reached.
    pub const FULL: u16 = 4503;
}

/// One of the app's files.
pub struct Asset {
    pub bytes: Vec<u8>,
    pub mime: String,
}

/// Finds one of the app's files by its path (`index.html`,
/// `assets/index-abc.js`): `None` when there is no such file.
pub type Assets = Arc<dyn Fn(&str) -> Option<Asset> + Send + Sync>;

/// Told the number of viewers each time it changes.
pub type OnViewers = Arc<dyn Fn(usize) + Send + Sync>;

/// A running server: its port, and the means to stop it.
pub struct Session {
    port: u16,
    stop: watch::Sender<bool>,
    viewers: watch::Receiver<usize>,
    server: JoinHandle<()>,
}

/// What every route of one session reads.
#[derive(Clone)]
pub struct Gate {
    stop: watch::Receiver<bool>,
    viewers: Arc<watch::Sender<usize>>,
    on_viewers: OnViewers,
    limit: usize,
    beat: Duration,
}

impl Session {
    /// Opens a server on `port`, or on a free port when that one fails
    /// (taken, or refused: Windows answers "access denied" for a port in a
    /// range Hyper-V, WSL or Docker reserved). `routes` builds the router
    /// from the session's gate. At most `limit` viewers hold a seat at once.
    pub async fn open(
        port: u16,
        limit: usize,
        timing: Timing,
        on_viewers: OnViewers,
        routes: impl FnOnce(Gate) -> Router,
    ) -> io::Result<Session> {
        // A fault that is not the port's (no descriptor left) fails the free
        // port the same way, and that error is the one reported
        let listener = match TcpListener::bind((Ipv4Addr::UNSPECIFIED, port)).await {
            Err(_) if port != 0 => TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).await?,
            bound => bound?,
        };
        let port = listener.local_addr()?.port();
        let (stop, stop_rx) = watch::channel(false);
        let (viewers, viewers_rx) = watch::channel(0);
        let gate = Gate {
            beat: timing.beat,
            limit,
            on_viewers,
            stop: stop_rx.clone(),
            viewers: Arc::new(viewers),
        };
        let server = tokio::spawn(serve(listener, routes(gate), stop_rx, timing.headers));
        Ok(Session {
            port,
            server,
            stop,
            viewers: viewers_rx,
        })
    }

    /// The port the server holds: not the preferred one if that failed.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// The viewers holding a seat now.
    pub fn viewers(&self) -> usize {
        *self.viewers.borrow()
    }

    /// Closes the port and every connection: the viewers' with 4410, the
    /// others at once.
    pub async fn stop(self) {
        self.stop.send_replace(true);
        let mut viewers = self.viewers;
        let mut server = self.server;
        let wound_down = tokio::time::timeout(STOP_WAIT, async {
            let _ = (&mut server).await;
            let _ = viewers.wait_for(|count| *count == 0).await;
        })
        .await;
        if wound_down.is_err() {
            server.abort();
        }
    }
}

impl Gate {
    /// Takes a seat, or `None` when `limit` viewers hold one. The viewer
    /// count is told while the count is held, so it reaches the page in
    /// order and before `Session::stop` sees the last seat freed.
    fn take_seat(&self) -> Option<Seat> {
        let taken = self.viewers.send_if_modified(|viewers| {
            if *viewers >= self.limit {
                return false;
            }
            *viewers += 1;
            tell(&self.on_viewers, &self.stop, *viewers);
            true
        });
        taken.then(|| Seat {
            on_viewers: Arc::clone(&self.on_viewers),
            stop: self.stop.clone(),
            viewers: Arc::clone(&self.viewers),
        })
    }

    /// Upgrades a request to a WebSocket and hands the socket to `pump`; the
    /// seat is held here until `pump` ends, whatever it does with the socket
    /// (a pump is usually `relay_to`, or `pump` over a `Source`). A refused viewer gets a socket closed at once with a code
    /// that says why: a browser sees no HTTP status on a refused WebSocket.
    /// A request that reaches a stopped session (it was sent before the
    /// stop) takes no seat, whatever its token.
    pub fn admit<F, Fut>(
        &self,
        upgrade: WebSocketUpgrade,
        query: Option<&str>,
        token: &str,
        pump: F,
    ) -> Response
    where
        F: FnOnce(WebSocket) -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        let upgrade = upgrade
            .max_frame_size(MAX_INCOMING)
            .max_message_size(MAX_INCOMING);
        if *self.stop.borrow() {
            return upgrade.on_upgrade(|socket| close_with(socket, close::STOPPED, "stopped"));
        }
        if !token_matches(query, token) {
            return upgrade.on_upgrade(|socket| close_with(socket, close::TOKEN, "token"));
        }
        let Some(seat) = self.take_seat() else {
            return upgrade.on_upgrade(|socket| close_with(socket, close::FULL, "full"));
        };
        upgrade.on_upgrade(move |socket| async move {
            let _seat = seat;
            pump(socket).await;
        })
    }
}

/// The accept loop: each connection served as HTTP/1 in a task of its own,
/// at most MAX_CONNECTIONS at once. hyper's header timeout (which needs a
/// timer, hence not `axum::serve`) closes a connection that sends no
/// request, or half of one. Once the session stops, the port and every
/// connection still in HTTP close at once; an upgraded viewer is no longer
/// one of them, and closes on the stop flag with 4410.
async fn serve(
    listener: TcpListener,
    router: Router,
    mut stop: watch::Receiver<bool>,
    headers: Duration,
) {
    let mut connections: JoinSet<()> = JoinSet::new();
    loop {
        let accepted = tokio::select! {
            biased;
            () = stopped(&mut stop) => break,
            Some(_) = connections.join_next(), if !connections.is_empty() => continue,
            accepted = listener.accept() => accepted,
        };
        let Ok((stream, _)) = accepted else {
            tokio::time::sleep(ACCEPT_PAUSE).await;
            continue;
        };
        while connections.try_join_next().is_some() {}
        if connections.len() >= MAX_CONNECTIONS {
            // Dropped: closed before a byte is read
            continue;
        }
        let service = TowerToHyperService::new(router.clone());
        connections.spawn(async move {
            let mut http = http1::Builder::new();
            http.timer(TokioTimer::new())
                .header_read_timeout(headers)
                .max_buf_size(MAX_BUFFER);
            let connection = http.serve_connection(TokioIo::new(stream), service);
            let _ = connection.with_upgrades().await;
        });
    }
    drop(listener);
    connections.shutdown().await;
}

/// What a viewer is sent: the one thing a server brings to `pump`.
pub trait Source: Send {
    /// The next frame, or `None` when there will be no more (the viewer is
    /// then closed on). Awaited in a `select!`: it must be cancel-safe.
    fn next(&mut self) -> impl Future<Output = Option<Utf8Bytes>> + Send;

    /// The frame a viewer gets with each ping.
    fn beat(&mut self) -> Utf8Bytes {
        Utf8Bytes::from_static(BEAT)
    }
}

/// The latest value of a `watch`: sent at once, then each change. A slow
/// viewer skips the values it had no time for; `None` (nothing published
/// yet) is not sent.
struct Latest(watch::Receiver<Option<Utf8Bytes>>);

impl Source for Latest {
    async fn next(&mut self) -> Option<Utf8Bytes> {
        loop {
            self.0.changed().await.ok()?;
            if let Some(text) = self.0.borrow_and_update().clone() {
                return Some(text);
            }
        }
    }
}

/// Sends one viewer the latest value of `latest` at once, then each change,
/// until either side goes (see `pump`).
pub async fn relay_to(
    socket: WebSocket,
    mut latest: watch::Receiver<Option<Utf8Bytes>>,
    gate: Gate,
) {
    latest.mark_changed();
    pump(socket, gate, Latest(latest)).await;
}

/// Serves one viewer from `source` until either side goes. Every beat the
/// viewer is pinged (its browser answers on its own) and sent a beat (its
/// page sees that the connection lives); one that has not answered the last
/// ping by the next is gone without a word, and loses its seat. A stopped
/// session closes the viewer with 4410 and sends nothing more. What the
/// viewer sends is read only to answer pings, hear it and see it leave.
pub async fn pump(mut socket: WebSocket, gate: Gate, mut source: impl Source) {
    let mut stop = gate.stop;
    let start = tokio::time::Instant::now() + gate.beat;
    let mut beat = tokio::time::interval_at(start, gate.beat);
    beat.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let mut unanswered = false;
    loop {
        // Biased, the stop first: a stopped session sends nothing more
        tokio::select! {
            biased;
            () = stopped(&mut stop) => {
                close_with(socket, close::STOPPED, "stopped").await;
                return;
            }
            frame = source.next() => {
                let Some(text) = frame else {
                    return;
                };
                if !send(&mut socket, Message::Text(text)).await {
                    return;
                }
            }
            incoming = socket.recv() => {
                if !matches!(incoming, Some(Ok(message)) if !matches!(message, Message::Close(_))) {
                    return;
                }
                unanswered = false;
            }
            _ = beat.tick() => {
                if unanswered
                    || !send(&mut socket, Message::Ping(Bytes::new())).await
                    || !send(&mut socket, Message::Text(source.beat())).await
                {
                    return;
                }
                unanswered = true;
            }
        }
    }
}

/// Sends one frame, within SEND_TIMEOUT: whether it went.
async fn send(socket: &mut WebSocket, message: Message) -> bool {
    let sent = tokio::time::timeout(SEND_TIMEOUT, socket.send(message));
    matches!(sent.await, Ok(Ok(())))
}

/// Resolves once the session stops (or is gone). Holds no lock on the flag
/// once it resolves.
async fn stopped(stop: &mut watch::Receiver<bool>) {
    let _ = stop.wait_for(|stopped| *stopped).await;
}

/// Closes a socket with `code`, and waits briefly for the viewer's answer
/// so the close is a clean one. A viewer that cannot even take the close
/// frame is cut off after CLOSE_WAIT.
async fn close_with(mut socket: WebSocket, code: u16, reason: &'static str) {
    let frame = CloseFrame {
        code,
        reason: Utf8Bytes::from_static(reason),
    };
    let sent = tokio::time::timeout(CLOSE_WAIT, socket.send(Message::Close(Some(frame))));
    if matches!(sent.await, Ok(Ok(()))) {
        let _ = tokio::time::timeout(CLOSE_WAIT, async {
            while let Some(Ok(_)) = socket.recv().await {}
        })
        .await;
    }
}

/// A viewer's place, counted while it is held.
struct Seat {
    viewers: Arc<watch::Sender<usize>>,
    on_viewers: OnViewers,
    stop: watch::Receiver<bool>,
}

impl Drop for Seat {
    fn drop(&mut self) {
        // Always counted down: `stop` waits for the count to reach 0
        self.viewers.send_modify(|viewers| {
            *viewers -= 1;
            tell(&self.on_viewers, &self.stop, *viewers);
        });
    }
}

/// Tells the page the viewer count, unless the session has stopped: the
/// event names no session, and a viewer of a stopped one that lingers (its
/// socket slow to close) must not overwrite the next session's count.
fn tell(on_viewers: &OnViewers, stop: &watch::Receiver<bool>, count: usize) {
    if !*stop.borrow() {
        on_viewers(count);
    }
}

/// Makes any other GET one of the app's files: the router's fallback. `/`
/// and paths without an extension (the page's own routes) get index.html; a
/// missing file gets 404.
pub fn with_assets<S>(router: Router<S>, assets: Assets) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    router.fallback(move |method: Method, uri: Uri| {
        let assets = Arc::clone(&assets);
        async move { asset(&assets, &method, &uri) }
    })
}

fn asset(assets: &Assets, method: &Method, uri: &Uri) -> Response {
    if method != Method::GET {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    let Some(path) = file_path(uri.path()) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let found = assets(path).map(|asset| (path, asset));
    let found = match found {
        None if !has_extension(path) => assets("index.html").map(|asset| ("index.html", asset)),
        found => found,
    };
    let Some((path, asset)) = found else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let mut response = Response::new(Body::from(asset.bytes));
    let headers = response.headers_mut();
    if let Ok(mime) = HeaderValue::from_str(&asset.mime) {
        headers.insert(header::CONTENT_TYPE, mime);
    }
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    // The page names every other file by its content hash: only it must be
    // asked for again, to pick up a new version
    if path.ends_with(".html") {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    }
    response
}

/// The file a request path names, or `None` for a path no file of the app
/// has. A strict alphabet: in development Tauri reads the path from disk, so
/// `..`, a drive letter or a backslash must never reach it.
fn file_path(path: &str) -> Option<&str> {
    let path = path.strip_prefix('/')?;
    if path.is_empty() {
        return Some("index.html");
    }
    let valid = path.split('/').all(|segment| {
        !segment.is_empty()
            && segment != "."
            && segment != ".."
            && segment
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    });
    valid.then_some(path)
}

fn has_extension(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .is_some_and(|name| name.contains('.'))
}

/// 128 random bits from the system, base64url without padding: 22 characters
/// that need no escaping in a URL.
pub fn token() -> io::Result<String> {
    let mut bits = [0; 16];
    getrandom::fill(&mut bits).map_err(io::Error::other)?;
    Ok(URL_SAFE_NO_PAD.encode(bits))
}

/// Whether the query carries this token, compared in constant time.
pub fn token_matches(query: Option<&str>, token: &str) -> bool {
    let given = query
        .unwrap_or_default()
        .split('&')
        .find_map(|pair| pair.strip_prefix("token="))
        .unwrap_or_default();
    if given.len() != token.len() {
        return false;
    }
    let difference = given
        .bytes()
        .zip(token.bytes())
        .fold(0, |difference, (a, b)| difference | (a ^ b));
    std::hint::black_box(difference) == 0
}

/// This machine's address on its network: the one the default route leaves
/// from. Connecting a UDP socket sends nothing; it only picks the route.
/// 192.0.2.1 is a documentation address, never a real host.
pub fn lan_address() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    match socket.local_addr().ok()? {
        SocketAddr::V4(address)
            if !address.ip().is_unspecified() && !address.ip().is_loopback() =>
        {
            Some(*address.ip())
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::{RawQuery, State};
    use axum::routing::get;
    use futures_util::StreamExt;
    use std::sync::Mutex as StdMutex;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio_tungstenite::tungstenite::Message as WsMessage;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

    type Viewer = WebSocketStream<MaybeTlsStream<TcpStream>>;

    const WAIT: Duration = Duration::from_secs(2);
    const TOKEN: &str = "secret";
    const LIMIT: usize = 3;

    /// Clocks short enough for a test to wait them out.
    const FAST: Timing = Timing {
        beat: Duration::from_millis(150),
        headers: Duration::from_millis(300),
    };

    /// What the test server's routes read.
    #[derive(Clone)]
    struct Shared {
        gate: Gate,
        latest: watch::Receiver<Option<Utf8Bytes>>,
    }

    /// A server over one file and one stream (`/stream`, which sends what is
    /// put in `latest`), and the viewer counts it reported.
    struct Server {
        session: Session,
        latest: watch::Sender<Option<Utf8Bytes>>,
        counts: Arc<StdMutex<Vec<usize>>>,
    }

    async fn stream(
        State(shared): State<Shared>,
        RawQuery(query): RawQuery,
        upgrade: WebSocketUpgrade,
    ) -> Response {
        let Shared { gate, latest } = shared;
        let pump = gate.clone();
        gate.admit(upgrade, query.as_deref(), TOKEN, move |socket| {
            relay_to(socket, latest, pump)
        })
    }

    fn counter() -> (OnViewers, Arc<StdMutex<Vec<usize>>>) {
        let counts = Arc::new(StdMutex::new(Vec::new()));
        let seen = Arc::clone(&counts);
        let on_viewers: OnViewers = Arc::new(move |count| seen.lock().unwrap().push(count));
        (on_viewers, counts)
    }

    async fn server(port: u16, timing: Timing) -> Server {
        let (on_viewers, counts) = counter();
        let assets: Assets = Arc::new(|path| {
            (path == "index.html").then(|| Asset {
                bytes: path.as_bytes().to_vec(),
                mime: "text/html".to_owned(),
            })
        });
        let (latest, receiver) = watch::channel(None);
        let session = Session::open(port, LIMIT, timing, on_viewers, |gate| {
            let shared = Shared {
                gate,
                latest: receiver,
            };
            with_assets(Router::new().route("/stream", get(stream)), assets).with_state(shared)
        })
        .await
        .unwrap();
        Server {
            session,
            latest,
            counts,
        }
    }

    async fn connect(port: u16) -> Viewer {
        connect_to(port, &format!("/stream?token={TOKEN}")).await
    }

    async fn connect_to(port: u16, path_and_query: &str) -> Viewer {
        connect_async(format!("ws://127.0.0.1:{port}{path_and_query}"))
            .await
            .unwrap()
            .0
    }

    /// The next message, pings, pongs and beats included.
    async fn next_any(viewer: &mut Viewer) -> WsMessage {
        tokio::time::timeout(WAIT, viewer.next())
            .await
            .expect("the server said nothing")
            .expect("the server hung up")
            .expect("the stream broke")
    }

    /// Whether the server closed this connection: it reads the end, or a
    /// reset, within WAIT.
    async fn closed_by_server(stream: &mut TcpStream) -> bool {
        let mut buffer = [0; 512];
        let ended = tokio::time::timeout(WAIT, async {
            loop {
                match stream.read(&mut buffer).await {
                    Ok(0) | Err(_) => return,
                    Ok(_) => {}
                }
            }
        });
        ended.await.is_ok()
    }

    #[tokio::test]
    async fn refuses_a_viewer_past_the_limit() {
        let server = server(0, TIMING).await;
        let port = server.session.port();
        let mut viewers = Vec::new();
        for _ in 0..LIMIT {
            viewers.push(connect(port).await);
        }
        let mut extra = connect(port).await;
        match next_any(&mut extra).await {
            WsMessage::Close(Some(frame)) => assert_eq!(u16::from(frame.code), close::FULL),
            other => panic!("expected a close, got {other:?}"),
        }
        assert_eq!(*server.counts.lock().unwrap(), [1, 2, 3]);
        assert_eq!(server.session.viewers(), LIMIT);
        server.session.stop().await;
    }

    #[tokio::test]
    async fn drops_a_connection_that_never_finishes_its_headers() {
        let server = server(0, FAST).await;
        let port = server.session.port();
        // Half a request, then nothing
        let mut half = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        half.write_all(b"GET / HTTP/1.1\r\nHost: tracker\r\n")
            .await
            .unwrap();
        // Not a byte
        let mut silent = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        // Idle after a request answered
        let mut idle = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        idle.write_all(b"GET / HTTP/1.1\r\nHost: tracker\r\n\r\n")
            .await
            .unwrap();
        let mut answer = [0; 12];
        idle.read_exact(&mut answer).await.unwrap();
        assert_eq!(&answer, b"HTTP/1.1 200");

        let begun = tokio::time::Instant::now();
        assert!(closed_by_server(&mut half).await);
        assert!(closed_by_server(&mut silent).await);
        assert!(closed_by_server(&mut idle).await);
        assert!(begun.elapsed() >= FAST.headers / 2);
        server.session.stop().await;
    }

    #[tokio::test]
    async fn closes_a_connection_past_the_limit_at_once() {
        let server = server(0, TIMING).await;
        let port = server.session.port();
        let mut held = Vec::new();
        for _ in 0..MAX_CONNECTIONS {
            held.push(TcpStream::connect(("127.0.0.1", port)).await.unwrap());
        }
        // The default header timeout is 10 s: this one is closed by the cap
        let mut extra = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        assert!(closed_by_server(&mut extra).await);
        for stream in &mut held[..4] {
            let mut byte = [0; 1];
            let open = tokio::time::timeout(Duration::from_millis(50), stream.read(&mut byte));
            assert!(open.await.is_err(), "a connection under the cap was closed");
        }

        // A connection that leaves frees its place
        held.pop();
        let served = tokio::time::timeout(WAIT, async {
            loop {
                let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
                let request = b"GET / HTTP/1.1\r\nHost: tracker\r\nConnection: close\r\n\r\n";
                if stream.write_all(request).await.is_ok() {
                    let mut response = Vec::new();
                    let _ = stream.read_to_end(&mut response).await;
                    if response.starts_with(b"HTTP/1.1 200") {
                        return;
                    }
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        });
        served.await.expect("no place freed");
        server.session.stop().await;
    }

    #[tokio::test]
    async fn a_viewer_that_stops_answering_loses_its_seat() {
        let server = server(0, FAST).await;
        server.latest.send_replace(Some("1".into()));
        let port = server.session.port();
        // One reads all along, so its client answers the pings
        let mut present = connect(port).await;
        let reader = tokio::spawn(async move {
            let mut beats = 0;
            while beats < 4 {
                if let WsMessage::Text(text) = next_any(&mut present).await
                    && text.as_str() == BEAT
                {
                    beats += 1;
                }
            }
            present
        });
        // One goes silent after the first frame, as a phone out of range would
        let mut gone = connect(port).await;
        assert_eq!(next_any(&mut gone).await, WsMessage::text("1"));

        // The one still there gets beats, and keeps its seat
        let present = tokio::time::timeout(WAIT, reader).await.expect("no beat");
        assert!(present.is_ok());
        assert_eq!(*server.counts.lock().unwrap(), [1, 2, 1]);
        assert_eq!(server.session.viewers(), 1);
        drop(gone);
        server.session.stop().await;
    }

    #[tokio::test]
    async fn takes_a_free_port_when_the_preferred_one_is_taken() {
        let taken = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).await.unwrap();
        let port = taken.local_addr().unwrap().port();
        let server = server(port, TIMING).await;
        assert_ne!(server.session.port(), port);
        server.session.stop().await;
    }

    /// A source of one frame, then nothing more, with a beat of its own: what
    /// a pump written outside this module supplies.
    struct Once(Option<&'static str>);

    impl Source for Once {
        async fn next(&mut self) -> Option<Utf8Bytes> {
            match self.0.take() {
                Some(text) => Some(Utf8Bytes::from_static(text)),
                None => std::future::pending().await,
            }
        }

        fn beat(&mut self) -> Utf8Bytes {
            Utf8Bytes::from_static("tick")
        }
    }

    #[tokio::test]
    async fn a_pump_over_its_own_source_keeps_the_seat_and_beats_its_own_frame() {
        let (on_viewers, counts) = counter();
        let session = Session::open(0, 1, FAST, on_viewers, |gate| {
            Router::new().route(
                "/once",
                get(move |upgrade: WebSocketUpgrade| async move {
                    let pump = gate.clone();
                    gate.admit(upgrade, Some("token=t"), "t", move |socket| {
                        super::pump(socket, pump, Once(Some("hello")))
                    })
                }),
            )
        })
        .await
        .unwrap();
        let mut viewer = connect_to(session.port(), "/once?token=t").await;
        assert_eq!(next_any(&mut viewer).await, WsMessage::text("hello"));
        loop {
            match next_any(&mut viewer).await {
                WsMessage::Text(text) => {
                    assert_eq!(text.as_str(), "tick");
                    break;
                }
                WsMessage::Ping(_) => {}
                other => panic!("expected the beat, got {other:?}"),
            }
        }
        assert_eq!(*counts.lock().unwrap(), [1]);
        assert_eq!(session.viewers(), 1);
        session.stop().await;
    }

    #[test]
    fn compares_the_token_whole() {
        assert!(token_matches(Some("view=follow&token=abc"), "abc"));
        assert!(token_matches(Some("token=abc"), "abc"));
        assert!(!token_matches(Some("token=abd"), "abc"));
        assert!(!token_matches(Some("token=ab"), "abc"));
        assert!(!token_matches(Some("token=abcd"), "abc"));
        assert!(!token_matches(Some("xtoken=abc"), "abc"));
        assert!(!token_matches(None, "abc"));
        assert_ne!(token().unwrap(), token().unwrap());
    }
}

// Live follow on the local network: while the player has it on, the app
// serves its own page and a WebSocket that relays the run, so a phone or a
// second computer on the same network watches the tracker update live
// (docs/desktop.md, "Live follow on the LAN").
//
//   GET /follow?token=…  the stream: the run as the page last published it,
//                        at once, then each change
//   GET /<file>          the app's embedded files (the page the viewer opens)
//
// The relay only relays: nothing a viewer sends is read, there is no other
// route, and no port is open while the feature is off. A random token, new
// at each start, gates the stream; at most MAX_VIEWERS watch at once.
//
// This module knows nothing of Tauri: the app's files come through an
// `Assets` lookup and the viewer count goes out through `OnViewers`, so the
// tests run the real server without an app.

use axum::Router;
use axum::body::Body;
use axum::extract::ws::{CloseFrame, Message, Utf8Bytes, WebSocket, WebSocketUpgrade};
use axum::extract::{RawQuery, State};
use axum::http::{HeaderValue, Method, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::Serialize;
use std::io;
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, watch};
use tokio::task::JoinHandle;

/// The port the relay asks for first; a free one when it is taken.
pub const PORT: u16 = 23075;

/// The most viewers at once. Each one costs a socket, a task and a copy of
/// each update in flight.
pub const MAX_VIEWERS: usize = 8;

/// The largest run the page may publish. A full ALttPR run is a few kB.
pub const MAX_VALUE: usize = 1 << 20;

/// The longest a game id or a storage key may be.
const MAX_NAME: usize = 64;

/// A viewer sends nothing the relay reads: anything longer is cut off.
const MAX_INCOMING: usize = 4096;

/// A viewer that takes longer to accept one update is dropped, so a stalled
/// device cannot hold a seat.
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
    /// The relay is stopped by the player.
    pub const STOPPED: u16 = 4410;
    /// MAX_VIEWERS already watch.
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

/// What `start` hands the page.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Started {
    /// The link a viewer opens, on this machine's address on the network
    pub url: String,
    pub port: u16,
    /// `false` when no network address was found: `url` is then on
    /// 127.0.0.1, which only this machine can open
    pub lan_found: bool,
    pub viewers: usize,
}

/// The relay: the run the page last published, and the server while it runs.
pub struct Relay {
    latest: watch::Sender<Option<Utf8Bytes>>,
    session: Mutex<Option<Session>>,
    assets: Assets,
    on_viewers: OnViewers,
}

struct Session {
    started: Started,
    stop: watch::Sender<bool>,
    viewers: watch::Receiver<usize>,
    server: JoinHandle<()>,
}

/// What every request of one session reads.
#[derive(Clone)]
struct Shared {
    token: Arc<str>,
    latest: watch::Receiver<Option<Utf8Bytes>>,
    stop: watch::Receiver<bool>,
    viewers: Arc<watch::Sender<usize>>,
    assets: Assets,
    on_viewers: OnViewers,
}

/// The run as a viewer receives it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot<'a> {
    game: &'a str,
    key: &'a str,
    /// The game's persisted state, as the page stored it: opaque here
    value: &'a str,
    /// When the page sent it (ms since the epoch), to correct the timer for
    /// the viewer's clock
    sent_at: u64,
}

impl Relay {
    pub fn new(assets: Assets, on_viewers: OnViewers) -> Self {
        Relay {
            assets,
            latest: watch::Sender::new(None),
            on_viewers,
            session: Mutex::new(None),
        }
    }

    /// Keeps the run the page just saved, and sends it to every viewer. It
    /// is kept while the relay is off, so a viewer gets the run at once.
    pub fn publish(&self, game: &str, key: &str, value: &str, sent_at: u64) -> Result<(), String> {
        if value.len() > MAX_VALUE {
            return Err(format!("the run is over {MAX_VALUE} bytes"));
        }
        if game.len() > MAX_NAME || key.len() > MAX_NAME {
            return Err("the game or key is too long".to_owned());
        }
        let snapshot = Snapshot {
            game,
            key,
            sent_at,
            value,
        };
        let text = serde_json::to_string(&snapshot).map_err(|error| error.to_string())?;
        self.latest.send_replace(Some(text.into()));
        Ok(())
    }

    /// Opens the relay on `port`, or on a free port when it is taken, with a
    /// new token. While it runs, hands back the running session unchanged.
    pub async fn start(&self, port: u16) -> io::Result<Started> {
        let mut session = self.session.lock().await;
        if let Some(running) = session.as_ref() {
            let mut started = running.started.clone();
            started.viewers = *running.viewers.borrow();
            return Ok(started);
        }
        let listener = match TcpListener::bind((Ipv4Addr::UNSPECIFIED, port)).await {
            Err(error) if error.kind() == io::ErrorKind::AddrInUse => {
                TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).await?
            }
            bound => bound?,
        };
        let port = listener.local_addr()?.port();
        let token = token()?;
        let (lan_found, address) = match lan_address() {
            Some(address) => (true, address),
            None => (false, Ipv4Addr::LOCALHOST),
        };
        let (stop, stop_rx) = watch::channel(false);
        let (viewers, viewers_rx) = watch::channel(0);
        let shared = Shared {
            assets: Arc::clone(&self.assets),
            latest: self.latest.subscribe(),
            on_viewers: Arc::clone(&self.on_viewers),
            stop: stop_rx.clone(),
            token: token.as_str().into(),
            viewers: Arc::new(viewers),
        };
        let mut shutdown = stop_rx;
        let server = tokio::spawn(async move {
            let serve = axum::serve(listener, router(shared))
                .with_graceful_shutdown(async move { stopped(&mut shutdown).await });
            let _ = serve.await;
        });
        let started = Started {
            lan_found,
            port,
            url: format!("http://{address}:{port}/?view=follow&token={token}"),
            viewers: 0,
        };
        *session = Some(Session {
            server,
            started: started.clone(),
            stop,
            viewers: viewers_rx,
        });
        Ok(started)
    }

    /// Closes every viewer's socket and the port. Does nothing when the
    /// relay is off.
    pub async fn stop(&self) {
        let Some(session) = self.session.lock().await.take() else {
            return;
        };
        session.stop.send_replace(true);
        let mut viewers = session.viewers;
        let mut server = session.server;
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

fn router(shared: Shared) -> Router {
    Router::new()
        .route("/follow", get(follow))
        .fallback(asset)
        .with_state(shared)
}

/// The stream. A refused viewer gets a socket closed at once with a code
/// that says why: a browser sees no HTTP status on a refused WebSocket.
async fn follow(
    State(shared): State<Shared>,
    RawQuery(query): RawQuery,
    upgrade: WebSocketUpgrade,
) -> Response {
    let upgrade = upgrade
        .max_frame_size(MAX_INCOMING)
        .max_message_size(MAX_INCOMING);
    if !token_matches(query.as_deref(), &shared.token) {
        return upgrade.on_upgrade(|socket| close_with(socket, close::TOKEN, "token"));
    }
    let Some(seat) = Seat::take(&shared) else {
        return upgrade.on_upgrade(|socket| close_with(socket, close::FULL, "full"));
    };
    upgrade.on_upgrade(move |socket| relay_to(socket, shared, seat))
}

/// Sends the run to one viewer, then each change, until either side goes.
/// A slow viewer skips the states it had no time for.
async fn relay_to(mut socket: WebSocket, shared: Shared, _seat: Seat) {
    let mut latest = shared.latest;
    let mut stop = shared.stop;
    latest.mark_changed();
    loop {
        tokio::select! {
            changed = latest.changed() => {
                if changed.is_err() {
                    return;
                }
                let text = latest.borrow_and_update().clone();
                if let Some(text) = text {
                    let sent = tokio::time::timeout(SEND_TIMEOUT, socket.send(Message::Text(text)));
                    if !matches!(sent.await, Ok(Ok(()))) {
                        return;
                    }
                }
            }
            // Read only to answer pings and see the viewer leave
            incoming = socket.recv() => {
                if !matches!(incoming, Some(Ok(message)) if !matches!(message, Message::Close(_))) {
                    return;
                }
            }
            () = stopped(&mut stop) => {
                close_with(socket, close::STOPPED, "stopped").await;
                return;
            }
        }
    }
}

/// Resolves once the session stops (or is gone). Holds no lock on the flag
/// once it resolves.
async fn stopped(stop: &mut watch::Receiver<bool>) {
    let _ = stop.wait_for(|stopped| *stopped).await;
}

/// Closes a socket with `code`, and waits briefly for the viewer's answer
/// so the close is a clean one.
async fn close_with(mut socket: WebSocket, code: u16, reason: &'static str) {
    let frame = CloseFrame {
        code,
        reason: Utf8Bytes::from_static(reason),
    };
    if socket.send(Message::Close(Some(frame))).await.is_ok() {
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
}

impl Seat {
    /// The viewer count is told while the count is held, so it reaches the
    /// page in order and before `stop` sees the last seat freed.
    fn take(shared: &Shared) -> Option<Seat> {
        let taken = shared.viewers.send_if_modified(|viewers| {
            if *viewers == MAX_VIEWERS {
                return false;
            }
            *viewers += 1;
            (shared.on_viewers)(*viewers);
            true
        });
        taken.then(|| Seat {
            on_viewers: Arc::clone(&shared.on_viewers),
            viewers: Arc::clone(&shared.viewers),
        })
    }
}

impl Drop for Seat {
    fn drop(&mut self) {
        self.viewers.send_modify(|viewers| {
            *viewers -= 1;
            (self.on_viewers)(*viewers);
        });
    }
}

/// Any other GET: one of the app's files. `/` and paths without an extension
/// (the page's own routes) get index.html; a missing file gets 404.
async fn asset(State(shared): State<Shared>, method: Method, uri: Uri) -> Response {
    if method != Method::GET {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    let Some(path) = file_path(uri.path()) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let found = (shared.assets)(path).map(|asset| (path, asset));
    let found = match found {
        None if !has_extension(path) => {
            (shared.assets)("index.html").map(|asset| ("index.html", asset))
        }
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
fn token() -> io::Result<String> {
    let mut bits = [0; 16];
    getrandom::fill(&mut bits).map_err(io::Error::other)?;
    Ok(URL_SAFE_NO_PAD.encode(bits))
}

/// Whether the query carries this session's token, compared in constant time.
fn token_matches(query: Option<&str>, token: &str) -> bool {
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
fn lan_address() -> Option<Ipv4Addr> {
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

/// The app's files, from Tauri: embedded in a release, read from the page's
/// build in development.
pub fn tauri_assets<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Assets {
    Arc::new(move |path| {
        let asset = app.asset_resolver().get(path.to_owned())?;
        // A release falls back to index.html for a file it does not have:
        // that is a 404 here, unless HTML was asked for
        if asset.mime_type == "text/html" && !path.ends_with(".html") {
            return None;
        }
        Some(Asset {
            bytes: asset.bytes,
            mime: asset.mime_type,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::{SinkExt, StreamExt};
    use std::sync::Mutex as StdMutex;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio_tungstenite::tungstenite::Message as WsMessage;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

    type Viewer = WebSocketStream<MaybeTlsStream<TcpStream>>;

    const WAIT: Duration = Duration::from_secs(2);

    /// A relay over two files, and the viewer counts it reported.
    fn relay() -> (Relay, Arc<StdMutex<Vec<usize>>>) {
        let counts = Arc::new(StdMutex::new(Vec::new()));
        let seen = Arc::clone(&counts);
        let assets: Assets = Arc::new(|path| {
            let mime = match path {
                "index.html" => "text/html",
                "assets/app-1a2b.js" => "text/javascript",
                _ => return None,
            };
            Some(Asset {
                bytes: path.as_bytes().to_vec(),
                mime: mime.to_owned(),
            })
        });
        let on_viewers: OnViewers = Arc::new(move |count| seen.lock().unwrap().push(count));
        (Relay::new(assets, on_viewers), counts)
    }

    fn token_of(started: &Started) -> &str {
        started.url.split("token=").nth(1).unwrap()
    }

    async fn connect(port: u16, query: &str) -> Viewer {
        let url = format!("ws://127.0.0.1:{port}/follow{query}");
        connect_async(url).await.unwrap().0
    }

    async fn watch_with(started: &Started) -> Viewer {
        connect(started.port, &format!("?token={}", token_of(started))).await
    }

    /// The next message, skipping the pongs.
    async fn next(viewer: &mut Viewer) -> WsMessage {
        loop {
            let message = tokio::time::timeout(WAIT, viewer.next())
                .await
                .expect("the relay said nothing")
                .expect("the relay hung up")
                .expect("the stream broke");
            if !matches!(message, WsMessage::Pong(_)) {
                return message;
            }
        }
    }

    async fn close_code(viewer: &mut Viewer) -> u16 {
        match next(viewer).await {
            WsMessage::Close(Some(frame)) => u16::from(frame.code),
            other => panic!("expected a close, got {other:?}"),
        }
    }

    async fn snapshot(viewer: &mut Viewer) -> serde_json::Value {
        match next(viewer).await {
            WsMessage::Text(text) => serde_json::from_str(&text).unwrap(),
            other => panic!("expected a snapshot, got {other:?}"),
        }
    }

    /// One plain HTTP request; the status and the whole response.
    async fn request(port: u16, method: &str, path: &str) -> (u16, String) {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        let head =
            format!("{method} {path} HTTP/1.1\r\nHost: tracker\r\nConnection: close\r\n\r\n");
        stream.write_all(head.as_bytes()).await.unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).await.unwrap();
        let status = response[9..12].parse().unwrap();
        (status, response)
    }

    #[tokio::test]
    async fn refuses_a_viewer_without_the_token() {
        let (relay, counts) = relay();
        let started = relay.start(0).await.unwrap();
        let wrong = "A".repeat(token_of(&started).len());
        for query in ["", "?token=", "?token=nope", &format!("?token={wrong}")] {
            let mut viewer = connect(started.port, query).await;
            assert_eq!(close_code(&mut viewer).await, close::TOKEN, "{query}");
        }
        assert!(counts.lock().unwrap().is_empty());
        relay.stop().await;
    }

    #[tokio::test]
    async fn sends_the_run_at_once_then_each_change() {
        let (relay, _) = relay();
        relay
            .publish("alttpr", "alltp-tracker-state", "{\"a\":1}", 10)
            .unwrap();
        let started = relay.start(0).await.unwrap();
        let mut viewer = watch_with(&started).await;
        let first = snapshot(&mut viewer).await;
        assert_eq!(
            first,
            serde_json::json!({
                "game": "alttpr",
                "key": "alltp-tracker-state",
                "sentAt": 10,
                "value": "{\"a\":1}",
            })
        );
        relay
            .publish("alttpr", "alltp-tracker-state", "{\"a\":2}", 20)
            .unwrap();
        let second = snapshot(&mut viewer).await;
        assert_eq!(second["value"], "{\"a\":2}");
        assert_eq!(second["sentAt"], 20);
        relay.stop().await;
    }

    #[tokio::test]
    async fn waits_for_a_run_when_none_was_published() {
        let (relay, _) = relay();
        let started = relay.start(0).await.unwrap();
        let mut viewer = watch_with(&started).await;
        relay.publish("sm", "alltp-tracker-sm", "{}", 1).unwrap();
        assert_eq!(snapshot(&mut viewer).await["game"], "sm");
        relay.stop().await;
    }

    #[tokio::test]
    async fn ignores_what_a_viewer_sends() {
        let (relay, _) = relay();
        relay.publish("alttpr", "k", "1", 1).unwrap();
        let started = relay.start(0).await.unwrap();
        let mut viewer = watch_with(&started).await;
        snapshot(&mut viewer).await;
        viewer.send(WsMessage::text("reset")).await.unwrap();
        viewer.send(WsMessage::binary(vec![0; 16])).await.unwrap();
        viewer
            .send(WsMessage::Ping(b"hi".to_vec().into()))
            .await
            .unwrap();
        let pong = tokio::time::timeout(WAIT, viewer.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(pong, WsMessage::Pong(b"hi".to_vec().into()));
        relay.publish("alttpr", "k", "2", 2).unwrap();
        assert_eq!(snapshot(&mut viewer).await["value"], "2");
        relay.stop().await;
    }

    #[tokio::test]
    async fn refuses_a_viewer_past_the_limit() {
        let (relay, counts) = relay();
        let started = relay.start(0).await.unwrap();
        let mut viewers = Vec::new();
        for _ in 0..MAX_VIEWERS {
            viewers.push(watch_with(&started).await);
        }
        let mut extra = watch_with(&started).await;
        assert_eq!(close_code(&mut extra).await, close::FULL);
        assert_eq!(
            *counts.lock().unwrap(),
            (1..=MAX_VIEWERS).collect::<Vec<_>>()
        );
        assert_eq!(relay.start(0).await.unwrap().viewers, MAX_VIEWERS);

        // A seat frees when a viewer leaves
        viewers.pop().unwrap().close(None).await.unwrap();
        tokio::time::timeout(WAIT, async {
            while counts.lock().unwrap().last() != Some(&(MAX_VIEWERS - 1)) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        relay.publish("alttpr", "k", "1", 1).unwrap();
        let mut late = watch_with(&started).await;
        assert_eq!(snapshot(&mut late).await["value"], "1");
        relay.stop().await;
    }

    #[tokio::test]
    async fn stop_closes_every_viewer_and_frees_the_port() {
        let (relay, counts) = relay();
        let started = relay.start(0).await.unwrap();
        let mut first = watch_with(&started).await;
        let mut second = watch_with(&started).await;
        relay.stop().await;
        assert_eq!(close_code(&mut first).await, close::STOPPED);
        assert_eq!(close_code(&mut second).await, close::STOPPED);
        assert_eq!(counts.lock().unwrap().last(), Some(&0));
        assert!(
            TcpStream::connect(("127.0.0.1", started.port))
                .await
                .is_err()
        );

        // The same port again, with a new token
        let again = relay.start(started.port).await.unwrap();
        assert_eq!(again.port, started.port);
        assert_ne!(token_of(&again), token_of(&started));
        relay.stop().await;
        relay.stop().await;
    }

    #[tokio::test]
    async fn start_while_running_hands_back_the_session() {
        let (relay, _) = relay();
        let first = relay.start(0).await.unwrap();
        let second = relay.start(0).await.unwrap();
        assert_eq!(first.url, second.url);
        assert_eq!(token_of(&first).len(), 22);
        assert!(first.url.starts_with("http://"));
        assert!(
            first
                .url
                .contains(&format!(":{}/?view=follow&token=", first.port))
        );
        relay.stop().await;
    }

    #[tokio::test]
    async fn takes_a_free_port_when_the_preferred_one_is_taken() {
        let taken = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).await.unwrap();
        let port = taken.local_addr().unwrap().port();
        let (relay, _) = relay();
        let started = relay.start(port).await.unwrap();
        assert_ne!(started.port, port);
        relay.stop().await;
    }

    #[tokio::test]
    async fn serves_the_app_files_and_nothing_else() {
        let (relay, _) = relay();
        let started = relay.start(0).await.unwrap();
        let port = started.port;

        let (status, response) = request(port, "GET", "/?view=follow&token=x").await;
        assert_eq!(status, 200);
        assert!(response.contains("content-type: text/html"));
        assert!(response.contains("cache-control: no-cache"));
        assert!(response.ends_with("index.html"));

        let (status, response) = request(port, "GET", "/assets/app-1a2b.js").await;
        assert_eq!(status, 200);
        assert!(response.contains("content-type: text/javascript"));
        assert!(!response.contains("cache-control"));

        // The page's own routes get the page
        let (status, response) = request(port, "GET", "/some/route").await;
        assert_eq!(status, 200);
        assert!(response.ends_with("index.html"));

        for path in [
            "/missing.js",
            "/../secret",
            "/assets/../index.html",
            "/a%2f..",
            "/C:/x",
            "//x",
        ] {
            assert_eq!(request(port, "GET", path).await.0, 404, "{path}");
        }
        assert_eq!(request(port, "POST", "/").await.0, 405);
        assert_eq!(request(port, "PUT", "/index.html").await.0, 405);
        // The stream is a WebSocket or nothing
        assert_ne!(request(port, "GET", "/follow").await.0, 200);
        relay.stop().await;
    }

    #[test]
    fn refuses_a_run_too_large_to_relay() {
        let (relay, _) = relay();
        let large = "x".repeat(MAX_VALUE + 1);
        assert!(relay.publish("alttpr", "k", &large, 0).is_err());
        assert!(
            relay
                .publish(&"g".repeat(MAX_NAME + 1), "k", "{}", 0)
                .is_err()
        );
        assert!(relay.publish("alttpr", "k", "{}", 0).is_ok());
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

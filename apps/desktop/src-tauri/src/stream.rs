// The stream view for OBS: a second server, beside live follow's, that serves
// the app's own page and the run to a browser source (docs/desktop.md,
// "Stream tools"). OBS cannot load the app's pages nor follow its storage,
// so the app serves `?view=obs&token=…` itself and relays the run to it.
//
//   GET /follow?token=…  the run, as live follow streams it (feed.rs)
//   GET /<file>          the app's embedded files
//
// What differs from live follow is the lifetime. Live follow is a moment the
// player starts (a new token, a free port when the usual one is taken, off at
// every launch). A browser source is set up once and left: the switch, the
// port and the tokens are kept in `stream.json` in the app's config
// directory, and the stream starts by itself at launch when it was on, so
// the address pasted into OBS keeps working.
//
//   enabled    the player's switch, kept across launches
//   port       the one the source's address names; 23076 first
//   viewToken  gates the page's stream (22 characters, 128 bits)
//   apiToken   reserved for the overlay API (not served yet)
//   lan        whether other devices on the network may reach the server:
//              off (the default) binds 127.0.0.1, on binds every interface
//
// A new address (`new_tokens`) replaces both tokens and closes the sessions
// that held the old ones. Quitting the app stops the server without turning
// the switch off. The file is replaced whole or not at all, readable by its
// owner alone. A missing file is replaced by a fresh config with the switch
// off; a damaged or tampered one is kept as `stream.json.bad` first; a file
// that cannot be read at all (not a missing one) is left alone and the stream
// stays off for this launch.
//
// This module knows nothing of Tauri: the config directory and the app's files
// come in as arguments, so the tests run the real server without an app.

use crate::feed::{Follow, RunFeed, follow};
use crate::files;
use crate::relay::{self, Assets, OnViewers, Session, TIMING, Timing, lan_address, with_assets};
use axum::Router;
use axum::routing::get;
use serde::{Deserialize, Serialize};
use std::io;
use std::net::Ipv4Addr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

/// The port the stream asks for first. When it is taken or refused, the next
/// nine (23077 to 23085: below the system's own range for outgoing
/// connections, 49152 and up, which a port a program grabs at random would
/// come from) are tried before any free one.
pub const PORT: u16 = 23076;

/// How many ports after the preferred one are tried before any free one.
const FALLBACK_PORTS: u16 = 9;

/// The most sources at once: OBS, its preview, a second scene, a dock, a
/// second computer, with room to spare. Each one costs a socket and a task.
pub const MAX_VIEWERS: usize = 16;

/// The config's file name, in the app's config directory.
const FILE: &str = "stream.json";

/// The length of a token (`relay::token`): a stored one is checked against it
const TOKEN_LEN: usize = 22;

/// What is kept across launches.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    enabled: bool,
    port: u16,
    view_token: String,
    api_token: String,
    /// Absent from a config written before the switch existed: off
    #[serde(default)]
    lan: bool,
}

/// A token as `relay::token` makes them. A stored one that is anything else
/// (empty, which `token_matches` would take for a missing token; shorter;
/// hand-edited) is not trusted.
fn is_token(text: &str) -> bool {
    text.len() == TOKEN_LEN
        && text
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

impl Config {
    fn fresh(port: u16) -> io::Result<Config> {
        Ok(Config {
            api_token: relay::token()?,
            enabled: false,
            lan: false,
            port,
            view_token: relay::token()?,
        })
    }

    fn valid(&self) -> bool {
        self.port != 0 && is_token(&self.view_token) && is_token(&self.api_token)
    }

    fn bytes(&self) -> io::Result<Vec<u8>> {
        serde_json::to_vec_pretty(self).map_err(io::Error::other)
    }
}

/// What `start` hands the page.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Started {
    /// The address of the server on this machine, where an OBS on the same
    /// computer reaches it; the page adds `?view=obs&token=…`
    pub address: String,
    pub port: u16,
    /// The saved port was not free: the server holds another, and the source's
    /// address must be pasted again
    pub moved: bool,
    pub token: String,
    pub viewers: usize,
    /// Whether other devices on the network may reach the server
    pub lan: bool,
    /// Where they reach it (`http://192.168.1.20:23076/`), when `lan` is on
    /// and the app found its address on the network
    pub lan_address: Option<String>,
}

/// A started server, and the answer `start` gave for it.
struct Running {
    session: Session,
    started: Started,
}

impl Running {
    /// The session as `start` handed it, with the viewers watching now.
    fn now(&self) -> Started {
        let mut started = self.started.clone();
        started.viewers = self.session.viewers();
        started
    }
}

struct Inner {
    /// Read on first use
    config: Option<Config>,
    running: Option<Running>,
}

/// The stream server and its remembered settings.
pub struct Stream {
    feed: RunFeed,
    assets: Assets,
    on_viewers: OnViewers,
    timing: Timing,
    /// `None` when the app has no config directory: the stream is unavailable
    file: Option<PathBuf>,
    /// The port a new config asks for
    preferred: u16,
    inner: Mutex<Inner>,
}

impl Stream {
    /// `dir` is the app's config directory, where `stream.json` lives; with
    /// none, nothing could be kept and the stream refuses to start.
    pub fn new(
        dir: Option<PathBuf>,
        preferred: u16,
        feed: RunFeed,
        assets: Assets,
        on_viewers: OnViewers,
    ) -> Self {
        Stream {
            assets,
            feed,
            file: dir.map(|dir| dir.join(FILE)),
            inner: Mutex::new(Inner {
                config: None,
                running: None,
            }),
            on_viewers,
            preferred,
            timing: TIMING,
        }
    }

    fn file(&self) -> io::Result<&Path> {
        self.file.as_deref().ok_or_else(|| {
            io::Error::other("the app has no config directory to keep the stream's settings in")
        })
    }

    /// The saved config. A fresh one (switch off, new tokens, not written
    /// until something changes) when there is no file yet, or when it cannot
    /// be trusted, in which case it is first kept as `stream.json.bad`. A
    /// file that cannot be read for any other reason (permissions, a
    /// directory in its place) is an error: nothing is replaced.
    fn load(&self) -> io::Result<Config> {
        let file = self.file()?;
        match std::fs::read(file) {
            Ok(bytes) => {
                let saved = serde_json::from_slice::<Config>(&bytes)
                    .ok()
                    .filter(Config::valid);
                if let Some(config) = saved {
                    return Ok(config);
                }
                let bad = file.with_extension("json.bad");
                if let Err(error) = std::fs::rename(file, &bad) {
                    eprintln!("could not keep the damaged stream settings: {error}");
                }
                Config::fresh(self.preferred)
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Config::fresh(self.preferred),
            Err(error) => Err(error),
        }
    }

    fn save(&self, config: &Config) -> io::Result<()> {
        files::put_private(self.file()?, &config.bytes()?).map(|_| ())
    }

    /// Binds the saved port, else the preferred one, else the few after it,
    /// else any free one: a source's address should stay on a port a player
    /// can recognise and open in the firewall. The error of the last attempt
    /// is the one reported.
    async fn bind(&self, address: Ipv4Addr, saved: u16) -> io::Result<TcpListener> {
        let after =
            self.preferred.saturating_add(1)..=self.preferred.saturating_add(FALLBACK_PORTS);
        let mut tried = Vec::new();
        for port in [saved, self.preferred].into_iter().chain(after) {
            if port == 0 || tried.contains(&port) {
                continue;
            }
            tried.push(port);
            if let Ok(listener) = TcpListener::bind((address, port)).await {
                return Ok(listener);
            }
        }
        TcpListener::bind((address, 0)).await
    }

    /// Turns the switch on and opens the server on the saved port, or on a
    /// free one when that fails; what is kept is updated to match. While it
    /// runs, hands back the running session.
    pub async fn start(&self) -> io::Result<Started> {
        let mut inner = self.inner.lock().await;
        if let Some(running) = inner.running.as_ref() {
            return Ok(running.now());
        }
        let config = self.config(&mut inner)?;
        self.open(&mut inner, config).await
    }

    /// Opens the server at launch if the switch was left on. Does nothing
    /// otherwise, or when it already runs.
    pub async fn resume(&self) -> io::Result<Option<Started>> {
        let mut inner = self.inner.lock().await;
        if inner.running.is_some() {
            return Ok(None);
        }
        let config = self.config(&mut inner)?;
        if !config.enabled {
            return Ok(None);
        }
        self.open(&mut inner, config).await.map(Some)
    }

    /// The config in memory, read on first use.
    fn config(&self, inner: &mut Inner) -> io::Result<Config> {
        if inner.config.is_none() {
            inner.config = Some(self.load()?);
        }
        Ok(inner.config.clone().expect("loaded just above"))
    }

    /// Opens a session for `config` with the switch on, and keeps the config
    /// with the port actually held. A config that cannot be written closes
    /// the session again, so what is running is always what the next launch
    /// will start.
    async fn open(&self, inner: &mut Inner, config: Config) -> io::Result<Started> {
        // Loopback unless the player allowed the network: a source on this
        // computer needs nothing more, and nothing else can reach the port
        let address = if config.lan {
            Ipv4Addr::UNSPECIFIED
        } else {
            Ipv4Addr::LOCALHOST
        };
        let listener = self.bind(address, config.port).await?;
        let session = Session::open_on(
            listener,
            MAX_VIEWERS,
            self.timing,
            Arc::clone(&self.on_viewers),
            |gate| {
                let assets = Arc::clone(&self.assets);
                with_assets(Router::new().route("/follow", get(follow)), assets)
                    .with_state(Follow::new(gate, &config.view_token, &self.feed))
            },
        )?;
        let port = session.port();
        let kept = Config {
            enabled: true,
            port,
            ..config.clone()
        };
        if let Err(error) = self.save(&kept) {
            session.stop().await;
            return Err(error);
        }
        let started = Started {
            address: format!("http://127.0.0.1:{port}/"),
            moved: port != config.port,
            port,
            token: kept.view_token.clone(),
            viewers: 0,
            lan: kept.lan,
            lan_address: lan_address()
                .filter(|_| kept.lan)
                .map(|ip| format!("http://{ip}:{port}/")),
        };
        inner.config = Some(kept);
        inner.running = Some(Running {
            session,
            started: started.clone(),
        });
        Ok(started)
    }

    /// The running session, or `None` while the server is off: what a page
    /// that loads again (a game switch reloads it) reads to pick it up.
    pub async fn running(&self) -> Option<Started> {
        self.inner.lock().await.running.as_ref().map(Running::now)
    }

    /// Turns the switch off and closes the port and every connection: the
    /// sources' with 4410, the others at once. A switch that cannot be saved
    /// is reported on stderr, not to the page: the server is stopped either
    /// way, and the next launch merely starts it again.
    pub async fn stop(&self) {
        let mut inner = self.inner.lock().await;
        if let Some(running) = inner.running.take() {
            running.session.stop().await;
        }
        let Ok(mut config) = self.config(&mut inner) else {
            return;
        };
        if config.enabled {
            config.enabled = false;
            if let Err(error) = self.save(&config) {
                eprintln!("could not keep the stream switched off: {error}");
            }
            inner.config = Some(config);
        }
    }

    /// Closes the server as the app quits, leaving the switch as the player
    /// had it: the stream starts again at the next launch.
    pub async fn shutdown(&self) {
        let running = self.inner.lock().await.running.take();
        if let Some(running) = running {
            running.session.stop().await;
        }
    }

    /// Allows other devices on the network (binds every interface) or takes
    /// that back (loopback only), and keeps the choice. A running server is
    /// opened again on the same port with the same tokens; one that is off
    /// stays off. Fails, changing nothing, when the choice cannot be written.
    pub async fn set_lan(&self, lan: bool) -> io::Result<Option<Started>> {
        let mut inner = self.inner.lock().await;
        let mut config = self.config(&mut inner)?;
        if config.lan == lan {
            return Ok(inner.running.as_ref().map(Running::now));
        }
        config.lan = lan;
        self.save(&config)?;
        inner.config = Some(config.clone());
        let Some(running) = inner.running.take() else {
            return Ok(None);
        };
        running.session.stop().await;
        self.open(&mut inner, config).await.map(Some)
    }

    /// Replaces both tokens. The sources holding the old address are closed
    /// (4410), and ask again with a token that is now refused (4401). A
    /// running server is opened again on the same port with the new tokens;
    /// one that is off stays off. Fails, changing nothing, when the new
    /// config cannot be written.
    pub async fn new_tokens(&self) -> io::Result<Option<Started>> {
        let mut inner = self.inner.lock().await;
        let mut config = self.config(&mut inner)?;
        config.view_token = relay::token()?;
        config.api_token = relay::token()?;
        // Written before anything is closed: a failure leaves the old
        // address working
        self.save(&config)?;
        inner.config = Some(config.clone());
        let Some(running) = inner.running.take() else {
            return Ok(None);
        };
        running.session.stop().await;
        self.open(&mut inner, config).await.map(Some)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::relay::close;
    use crate::test_support::{Viewer, assets, close_code, connect, request, snapshot};
    use std::sync::Mutex as StdMutex;
    use std::sync::atomic::{AtomicU32, Ordering};
    use tokio::net::TcpListener;
    use tokio::net::TcpStream;

    /// A config directory of its own, removed afterwards.
    struct Scratch(PathBuf);

    impl Scratch {
        fn new() -> Self {
            static NEXT: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "alltp-stream-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let _ = std::fs::remove_dir_all(&dir);
            Scratch(dir)
        }

        fn file(&self) -> PathBuf {
            self.0.join(FILE)
        }

        fn saved(&self) -> Config {
            serde_json::from_slice(&std::fs::read(self.file()).unwrap()).unwrap()
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// A port nothing holds now.
    async fn free_port() -> u16 {
        let listener = TcpListener::bind(("0.0.0.0", 0)).await.unwrap();
        listener.local_addr().unwrap().port()
    }

    type Counts = Arc<StdMutex<Vec<usize>>>;

    /// A stream over a directory, asking for `preferred`: what the app would
    /// build at launch, and the viewer counts it reports.
    fn stream(dir: &Scratch, preferred: u16, feed: &RunFeed) -> (Stream, Counts) {
        let counts: Counts = Arc::new(StdMutex::new(Vec::new()));
        let seen = Arc::clone(&counts);
        let on_viewers: OnViewers = Arc::new(move |count| seen.lock().unwrap().push(count));
        (
            Stream::new(
                Some(dir.0.clone()),
                preferred,
                feed.clone(),
                assets(),
                on_viewers,
            ),
            counts,
        )
    }

    async fn watch_with(started: &Started) -> Viewer {
        connect(started.port, &format!("?token={}", started.token)).await
    }

    /// A source on another address of this machine, as a device on the
    /// network would be.
    async fn connect_to(ip: Ipv4Addr, port: u16, token: &str) -> Viewer {
        let url = format!("ws://{ip}:{port}/follow?token={token}");
        tokio_tungstenite::connect_async(url).await.unwrap().0
    }

    #[tokio::test]
    async fn starts_on_the_saved_port_and_keeps_its_settings() {
        let dir = Scratch::new();
        let port = free_port().await;
        let (stream, _) = stream(&dir, port, &RunFeed::new());

        let started = stream.start().await.unwrap();

        assert_eq!(started.port, port);
        assert!(!started.moved);
        assert_eq!(started.address, format!("http://127.0.0.1:{port}/"));
        assert_eq!(started.token.len(), 22);
        let saved = dir.saved();
        assert!(saved.enabled);
        assert_eq!(saved.port, port);
        assert_eq!(saved.view_token, started.token);
        assert_ne!(saved.api_token, saved.view_token);
        assert_eq!(saved.api_token.len(), 22);
        // The config holds tokens: owner only
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(dir.file()).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        stream.stop().await;
    }

    #[tokio::test]
    async fn keeps_the_address_and_starts_by_itself_at_the_next_launch() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let port = free_port().await;
        let (first, _) = stream(&dir, port, &feed);
        let before = first.start().await.unwrap();
        // The app quits: the stream is stopped, the switch stays on
        first.shutdown().await;
        assert!(first.running().await.is_none());
        assert!(dir.saved().enabled);

        let (second, _) = stream(&dir, port, &feed);
        assert!(second.running().await.is_none());
        let after = second.resume().await.unwrap().unwrap();

        assert_eq!(after.port, before.port);
        assert_eq!(after.token, before.token);
        assert!(!after.moved);
        feed.publish("alttpr", "k", "1", 1).unwrap();
        let mut source = watch_with(&after).await;
        assert_eq!(snapshot(&mut source).await["value"], "1");
        second.shutdown().await;
    }

    #[tokio::test]
    async fn does_not_start_at_launch_when_the_switch_was_turned_off() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let port = free_port().await;
        let (first, _) = stream(&dir, port, &feed);
        let started = first.start().await.unwrap();
        first.stop().await;
        assert!(!dir.saved().enabled);
        // The tokens and the port outlive the switch: turned back on, the
        // source's address is the same
        let (second, _) = stream(&dir, port, &feed);
        assert!(second.resume().await.unwrap().is_none());
        assert!(second.running().await.is_none());
        let again = second.start().await.unwrap();
        assert_eq!(again.token, started.token);
        assert_eq!(again.port, started.port);
        second.stop().await;
    }

    #[tokio::test]
    async fn never_started_it_resumes_nothing_and_writes_nothing() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        assert!(stream.resume().await.unwrap().is_none());
        stream.stop().await;
        stream.shutdown().await;
        assert!(!dir.file().exists());
    }

    #[tokio::test]
    async fn replaces_a_config_that_cannot_be_trusted() {
        let port = free_port().await;
        let good = "A".repeat(22);
        let texts = [
            "".to_owned(),
            "not json".to_owned(),
            "{}".to_owned(),
            // An empty token would match a missing one
            format!(
                "{{\"enabled\":true,\"port\":{port},\"viewToken\":\"\",\"apiToken\":\"{good}\"}}"
            ),
            format!(
                "{{\"enabled\":true,\"port\":{port},\"viewToken\":\"{good}\",\"apiToken\":\"short\"}}"
            ),
            format!(
                "{{\"enabled\":true,\"port\":{port},\"viewToken\":\"{}\",\"apiToken\":\"{good}\"}}",
                "a/b".repeat(7) + "c"
            ),
            format!(
                "{{\"enabled\":true,\"port\":0,\"viewToken\":\"{good}\",\"apiToken\":\"{good}\"}}"
            ),
        ];
        for text in texts {
            let dir = Scratch::new();
            std::fs::create_dir_all(&dir.0).unwrap();
            std::fs::write(dir.file(), &text).unwrap();
            let (stream, _) = stream(&dir, port, &RunFeed::new());

            // The switch of a damaged file is off: nothing starts at launch
            assert!(stream.resume().await.unwrap().is_none(), "{text}");
            let started = stream.start().await.unwrap();

            assert_eq!(started.port, port, "{text}");
            assert_ne!(started.token, good, "{text}");
            assert_eq!(dir.saved().view_token, started.token, "{text}");
            // What was there is kept, not lost
            let bad = dir.0.join("stream.json.bad");
            assert_eq!(std::fs::read_to_string(bad).unwrap(), text, "{text}");
            stream.stop().await;
        }
    }

    #[tokio::test]
    async fn takes_a_free_port_and_says_so_when_the_saved_one_is_held() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let held = TcpListener::bind(("0.0.0.0", 0)).await.unwrap();
        let taken = held.local_addr().unwrap().port();
        let (stream, _) = stream(&dir, taken, &feed);

        let started = stream.start().await.unwrap();

        assert_ne!(started.port, taken);
        assert!(started.moved);
        // The address the source needs is kept, so the next launch holds it
        assert_eq!(dir.saved().port, started.port);
        let mut source = watch_with(&started).await;
        feed.publish("sm", "k", "{}", 1).unwrap();
        assert_eq!(snapshot(&mut source).await["game"], "sm");
        // The notice stays while the session runs
        assert!(stream.running().await.unwrap().moved);
        stream.shutdown().await;

        let (next, _) = self::stream(&dir, taken, &feed);
        let again = next.resume().await.unwrap().unwrap();
        assert_eq!(again.port, started.port);
        assert!(!again.moved);
        next.shutdown().await;
    }

    #[tokio::test]
    async fn refuses_a_source_without_the_token_and_the_one_of_live_follow() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let (stream, counts) = stream(&dir, free_port().await, &feed);
        let started = stream.start().await.unwrap();
        let api = dir.saved().api_token;
        // The overlay's token opens nothing here
        for query in [
            "".to_owned(),
            "?token=".to_owned(),
            "?token=nope".to_owned(),
            format!("?token={}", "A".repeat(22)),
            format!("?token={api}"),
        ] {
            let mut source = connect(started.port, &query).await;
            assert_eq!(close_code(&mut source).await, close::TOKEN, "{query}");
        }
        assert!(counts.lock().unwrap().is_empty());
        stream.stop().await;
    }

    #[tokio::test]
    async fn one_publish_reaches_both_servers_and_each_stops_alone() {
        use crate::follow::Relay;
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let (stream, _) = stream(&dir, free_port().await, &feed);
        let relay = Relay::new(feed.clone(), assets(), Arc::new(|_| {}));
        let streamed = stream.start().await.unwrap();
        let followed = relay.start(0).await.unwrap();
        let follow_token = followed.url.split("token=").nth(1).unwrap().to_owned();
        let mut source = watch_with(&streamed).await;
        let mut phone = connect(followed.port, &format!("?token={follow_token}")).await;
        // Each server's token opens that server alone
        let mut across = connect(followed.port, &format!("?token={}", streamed.token)).await;
        assert_eq!(close_code(&mut across).await, close::TOKEN);
        let mut other = connect(streamed.port, &format!("?token={follow_token}")).await;
        assert_eq!(close_code(&mut other).await, close::TOKEN);

        feed.publish("alttpr", "k", "{\"a\":1}", 7).unwrap();
        assert_eq!(snapshot(&mut source).await["value"], "{\"a\":1}");
        assert_eq!(snapshot(&mut phone).await["value"], "{\"a\":1}");

        // Live follow stops: the stream goes on
        relay.stop().await;
        assert_eq!(close_code(&mut phone).await, close::STOPPED);
        feed.publish("alttpr", "k", "{\"a\":2}", 8).unwrap();
        assert_eq!(snapshot(&mut source).await["value"], "{\"a\":2}");

        // The stream stops: live follow can start again, the run still there
        let again = relay.start(0).await.unwrap();
        stream.stop().await;
        assert_eq!(close_code(&mut source).await, close::STOPPED);
        let token = again.url.split("token=").nth(1).unwrap();
        let mut late = connect(again.port, &format!("?token={token}")).await;
        assert_eq!(snapshot(&mut late).await["value"], "{\"a\":2}");
        relay.stop().await;
    }

    #[tokio::test]
    async fn closes_the_sources_when_the_switch_goes_off_and_frees_the_port() {
        let dir = Scratch::new();
        let (stream, counts) = stream(&dir, free_port().await, &RunFeed::new());
        let started = stream.start().await.unwrap();
        let mut source = watch_with(&started).await;

        stream.stop().await;

        assert_eq!(close_code(&mut source).await, close::STOPPED);
        assert!(
            TcpStream::connect(("127.0.0.1", started.port))
                .await
                .is_err()
        );
        assert!(stream.running().await.is_none());
        assert!(!dir.saved().enabled);
        assert_eq!(*counts.lock().unwrap(), [1]);
    }

    #[tokio::test]
    async fn a_new_address_closes_the_sources_and_refuses_the_old_one() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let (stream, _) = stream(&dir, free_port().await, &feed);
        let before = stream.start().await.unwrap();
        let api = dir.saved().api_token;
        let mut source = watch_with(&before).await;

        let after = stream.new_tokens().await.unwrap().unwrap();

        // The source is told the player stopped it, then holds an old token
        assert_eq!(close_code(&mut source).await, close::STOPPED);
        assert_eq!(after.port, before.port);
        assert!(!after.moved);
        assert_ne!(after.token, before.token);
        let mut old = watch_with(&before).await;
        assert_eq!(close_code(&mut old).await, close::TOKEN);
        feed.publish("alttpr", "k", "1", 1).unwrap();
        let mut fresh = watch_with(&after).await;
        assert_eq!(snapshot(&mut fresh).await["value"], "1");
        // Both tokens are new, and kept
        let saved = dir.saved();
        assert_eq!(saved.view_token, after.token);
        assert_ne!(saved.api_token, api);
        assert!(saved.enabled);
        stream.shutdown().await;
    }

    #[tokio::test]
    async fn new_addresses_while_off_are_kept_and_start_nothing() {
        let dir = Scratch::new();
        let port = free_port().await;
        let (stream, _) = stream(&dir, port, &RunFeed::new());
        let first = stream.start().await.unwrap();
        stream.stop().await;

        assert!(stream.new_tokens().await.unwrap().is_none());

        assert!(stream.running().await.is_none());
        assert!(!dir.saved().enabled);
        let again = stream.start().await.unwrap();
        assert_ne!(again.token, first.token);
        assert_eq!(again.token, dir.saved().view_token);
        stream.stop().await;
    }

    #[tokio::test]
    async fn a_config_that_cannot_be_written_starts_nothing() {
        let dir = Scratch::new();
        let port = free_port().await;
        // A file where the config directory should be
        std::fs::write(&dir.0, b"in the way").unwrap();
        let (stream, _) = stream(&dir, port, &RunFeed::new());

        assert!(stream.start().await.is_err());

        assert!(stream.running().await.is_none());
        assert!(
            TcpStream::connect(("127.0.0.1", port)).await.is_err(),
            "the port was left open"
        );
        let _ = std::fs::remove_file(&dir.0);
    }

    #[tokio::test]
    async fn start_while_running_hands_back_the_session() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        let first = stream.start().await.unwrap();
        let second = stream.start().await.unwrap();
        assert_eq!(first.token, second.token);
        assert_eq!(first.port, second.port);
        assert!(stream.resume().await.unwrap().is_none());
        stream.stop().await;
    }

    #[tokio::test]
    async fn holds_sixteen_sources_and_refuses_the_next() {
        let dir = Scratch::new();
        let (stream, counts) = stream(&dir, free_port().await, &RunFeed::new());
        let started = stream.start().await.unwrap();
        let mut sources = Vec::new();
        for _ in 0..MAX_VIEWERS {
            sources.push(watch_with(&started).await);
        }
        let mut extra = watch_with(&started).await;
        assert_eq!(close_code(&mut extra).await, close::FULL);
        assert_eq!(
            *counts.lock().unwrap(),
            (1..=MAX_VIEWERS).collect::<Vec<_>>()
        );
        assert_eq!(stream.running().await.unwrap().viewers, MAX_VIEWERS);
        stream.stop().await;
    }

    #[tokio::test]
    async fn serves_the_app_files_to_the_source() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        let started = stream.start().await.unwrap();

        let (status, response) = request(started.port, "GET", "/?view=obs&token=x").await;
        assert_eq!(status, 200);
        assert!(response.ends_with("index.html"));
        assert_eq!(
            request(started.port, "GET", "/assets/app-1a2b.js").await.0,
            200
        );
        assert_eq!(request(started.port, "GET", "/missing.js").await.0, 404);
        assert_eq!(request(started.port, "POST", "/").await.0, 405);
        // No route for the overlay yet
        assert_ne!(request(started.port, "GET", "/overlay").await.0, 101);
        stream.stop().await;
    }

    #[tokio::test]
    async fn a_missing_config_is_replaced_without_keeping_anything() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        stream.start().await.unwrap();
        assert!(!dir.0.join("stream.json.bad").exists());
        stream.stop().await;
    }

    #[tokio::test]
    async fn a_config_that_cannot_be_read_is_left_alone_and_asked_again_later() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        // Not a missing file: a directory where the file should be
        std::fs::create_dir_all(dir.file().join("inside")).unwrap();

        assert!(stream.resume().await.is_err());
        assert!(stream.start().await.is_err());
        stream.stop().await;
        assert!(stream.new_tokens().await.is_err());

        assert!(stream.running().await.is_none());
        assert!(dir.file().join("inside").is_dir(), "it was overwritten");
        assert!(!dir.0.join("stream.json.bad").exists());

        // The failure was not remembered: once the file can be read, it starts
        std::fs::remove_dir_all(dir.file()).unwrap();
        assert!(stream.start().await.is_ok());
        stream.stop().await;
    }

    #[tokio::test]
    async fn without_a_config_directory_the_stream_refuses_to_start() {
        let counts: Counts = Arc::new(StdMutex::new(Vec::new()));
        let on_viewers: OnViewers = Arc::new(move |count| counts.lock().unwrap().push(count));
        let stream = Stream::new(
            None,
            free_port().await,
            RunFeed::new(),
            assets(),
            on_viewers,
        );

        assert!(stream.start().await.is_err());
        assert!(stream.resume().await.is_err());

        assert!(stream.running().await.is_none());
        stream.stop().await;
        stream.shutdown().await;
    }

    /// Holds `ports` until dropped, and says which of them it got.
    async fn hold(ports: &[u16]) -> Vec<TcpListener> {
        let mut held = Vec::new();
        for port in ports {
            held.push(TcpListener::bind(("0.0.0.0", *port)).await.unwrap());
        }
        held
    }

    #[tokio::test]
    async fn tries_the_preferred_port_when_the_saved_one_is_taken() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let saved = free_port().await;
        let (first, _) = stream(&dir, saved, &feed);
        first.start().await.unwrap();
        first.stop().await;
        // The saved port is taken now; the app's own port is free
        let preferred = free_port().await;
        let _held = hold(&[saved]).await;
        let (second, _) = self::stream(&dir, preferred, &feed);

        let started = second.start().await.unwrap();

        assert_eq!(started.port, preferred);
        assert!(started.moved);
        assert_eq!(dir.saved().port, preferred);
        second.stop().await;
    }

    #[tokio::test]
    async fn tries_the_few_ports_after_the_preferred_one_before_any_free_port() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let saved = free_port().await;
        let (first, _) = stream(&dir, saved, &feed);
        first.start().await.unwrap();
        first.stop().await;
        let preferred = free_port().await;
        // The saved port, the preferred one and the next are all taken
        let _held = hold(&[saved, preferred]).await;
        let next = preferred + 1;
        let _next = TcpListener::bind(("0.0.0.0", next)).await;
        let (second, _) = self::stream(&dir, preferred, &feed);

        let started = second.start().await.unwrap();

        assert!(started.moved);
        assert!(
            (preferred + 2..=preferred + FALLBACK_PORTS).contains(&started.port),
            "{} is not in the fixed range",
            started.port
        );
        second.stop().await;
    }

    #[tokio::test]
    async fn falls_back_to_any_free_port_when_the_whole_range_is_taken() {
        let dir = Scratch::new();
        let preferred = free_port().await;
        let mut held = hold(&[preferred]).await;
        for port in preferred + 1..=preferred + FALLBACK_PORTS {
            // A port of the range that something else holds is as good
            if let Ok(listener) = TcpListener::bind(("0.0.0.0", port)).await {
                held.push(listener);
            }
        }
        let (stream, _) = stream(&dir, preferred, &RunFeed::new());

        let started = stream.start().await.unwrap();

        assert!(started.moved);
        assert!(!(preferred..=preferred + FALLBACK_PORTS).contains(&started.port));
        stream.stop().await;
    }

    #[tokio::test]
    async fn listens_on_this_computer_alone_unless_the_network_is_allowed() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let (stream, _) = stream(&dir, free_port().await, &feed);

        let started = stream.start().await.unwrap();

        assert!(!started.lan);
        assert!(started.lan_address.is_none());
        assert!(!dir.saved().lan);
        // Loopback answers
        let mut source = watch_with(&started).await;
        feed.publish("alttpr", "k", "1", 1).unwrap();
        assert_eq!(snapshot(&mut source).await["value"], "1");
        // The network's address does not: nothing listens there
        if let Some(ip) = relay::lan_address() {
            assert!(
                TcpStream::connect((ip, started.port)).await.is_err(),
                "{ip} reached a stream that was not opened to the network"
            );
        }
        stream.stop().await;
    }

    #[tokio::test]
    async fn allowing_the_network_opens_the_same_port_with_the_same_tokens() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let (stream, _) = stream(&dir, free_port().await, &feed);
        let before = stream.start().await.unwrap();
        let mut source = watch_with(&before).await;

        let after = stream.set_lan(true).await.unwrap().unwrap();

        // The restart closes the sources, which come back on the same address
        assert_eq!(close_code(&mut source).await, close::STOPPED);
        assert_eq!(after.port, before.port);
        assert_eq!(after.token, before.token);
        assert!(!after.moved);
        assert!(after.lan);
        assert!(dir.saved().lan);
        assert_eq!(dir.saved().view_token, before.token);
        if let Some(ip) = relay::lan_address() {
            assert_eq!(
                after.lan_address.as_deref(),
                Some(format!("http://{ip}:{}/", after.port).as_str())
            );
            assert!(TcpStream::connect((ip, after.port)).await.is_ok());
            let mut other = connect_to(ip, after.port, &after.token).await;
            feed.publish("alttpr", "k", "2", 2).unwrap();
            assert_eq!(snapshot(&mut other).await["value"], "2");
        }
        let mut again = watch_with(&after).await;
        assert_eq!(snapshot(&mut again).await["value"], "2");

        // And back: loopback only, the same port and tokens again
        let back = stream.set_lan(false).await.unwrap().unwrap();
        assert!(!back.lan);
        assert_eq!(back.port, before.port);
        assert_eq!(back.token, before.token);
        if let Some(ip) = relay::lan_address() {
            assert!(TcpStream::connect((ip, back.port)).await.is_err());
        }
        stream.stop().await;
    }

    #[tokio::test]
    async fn the_network_choice_outlives_a_launch_and_an_off_switch() {
        let dir = Scratch::new();
        let feed = RunFeed::new();
        let port = free_port().await;
        let (first, _) = stream(&dir, port, &feed);
        // Chosen while the stream is off: kept, nothing opens
        assert!(first.set_lan(true).await.unwrap().is_none());
        assert!(first.running().await.is_none());
        assert!(dir.saved().lan);
        assert!(!dir.saved().enabled);
        let started = first.start().await.unwrap();
        assert!(started.lan);
        first.shutdown().await;

        let (second, _) = self::stream(&dir, port, &feed);
        let resumed = second.resume().await.unwrap().unwrap();
        assert!(resumed.lan);
        assert_eq!(resumed.token, started.token);
        // Setting it again changes nothing, and answers with the running session
        let same = second.set_lan(true).await.unwrap().unwrap();
        assert_eq!(same.port, resumed.port);
        second.stop().await;
        assert!(dir.saved().lan, "turning the stream off forgot the choice");
    }

    #[tokio::test]
    async fn a_config_from_before_the_network_choice_listens_on_this_computer_alone() {
        let dir = Scratch::new();
        let port = free_port().await;
        let (token, api) = ("A".repeat(22), "B".repeat(22));
        std::fs::create_dir_all(&dir.0).unwrap();
        std::fs::write(
            dir.file(),
            format!(
                "{{\"enabled\":true,\"port\":{port},\"viewToken\":\"{token}\",\"apiToken\":\"{api}\"}}"
            ),
        )
        .unwrap();
        let (stream, _) = stream(&dir, port, &RunFeed::new());

        let started = stream.resume().await.unwrap().unwrap();

        // Trusted as it was: its tokens kept, nothing set aside
        assert_eq!(started.token, token);
        assert!(!started.lan);
        assert!(!dir.0.join("stream.json.bad").exists());
        if let Some(ip) = relay::lan_address() {
            assert!(TcpStream::connect((ip, port)).await.is_err());
        }
        assert!(!dir.saved().lan);
        stream.stop().await;
    }

    #[tokio::test]
    async fn the_network_is_not_allowed_by_a_new_config() {
        let dir = Scratch::new();
        let (stream, _) = stream(&dir, free_port().await, &RunFeed::new());
        assert!(!stream.start().await.unwrap().lan);
        stream.stop().await;
        assert!(!dir.saved().lan);
    }
}

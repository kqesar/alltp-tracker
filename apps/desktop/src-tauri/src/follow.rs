// Live follow on the local network: while the player has it on, the app
// serves its own page and a WebSocket that relays the run, so a phone or a
// second computer on the same network watches the tracker update live
// (docs/desktop.md, "Live follow on the LAN").
//
//   GET /follow?token=…  the stream: the run as the page last published it,
//                        at once, then each change
//   GET /<file>          the app's embedded files (the page the viewer opens)
//
// The relay only relays: nothing a viewer sends is acted on, there is no
// other route, and no port is open while the feature is off. A random token,
// new at each start, gates the stream; at most MAX_VIEWERS watch at once,
// over at most MAX_CONNECTIONS connections still in HTTP, each with a header
// timeout; a viewer that stops answering pings loses its seat. The server
// itself (lifecycle, seats, pump, file routes) is relay.rs and the run it
// streams is feed.rs's; this module is live follow's settings and session.
//
// This module knows nothing of Tauri: the app's files come through an
// `Assets` lookup and the viewer count goes out through `OnViewers`, so the
// tests run the real server without an app.

use crate::feed::{Follow, RunFeed, follow};
use crate::relay::{
    self, Asset, Assets, OnViewers, Session, TIMING, Timing, lan_address, with_assets,
};
use axum::Router;
use axum::routing::get;
use serde::Serialize;
use std::io;
use std::net::Ipv4Addr;
use std::sync::Arc;
use tokio::sync::Mutex;

/// The port the relay asks for first; a free one when it is taken or refused.
pub const PORT: u16 = 23075;

/// The most viewers at once. Each one costs a socket, a task and a write
/// buffer as large as the largest update it was sent.
pub const MAX_VIEWERS: usize = 8;

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

/// The relay: the server while it runs, over the run the page published.
pub struct Relay {
    feed: RunFeed,
    session: Mutex<Option<Running>>,
    assets: Assets,
    on_viewers: OnViewers,
    timing: Timing,
}

/// A started server, and the answer `start` gave for it.
struct Running {
    session: Session,
    started: Started,
}

impl Relay {
    pub fn new(feed: RunFeed, assets: Assets, on_viewers: OnViewers) -> Self {
        Relay {
            assets,
            feed,
            on_viewers,
            session: Mutex::new(None),
            timing: TIMING,
        }
    }

    /// Opens the relay on `port`, or on a free port when that one fails
    /// (taken, or refused), with a new token. While it runs, hands back the
    /// running session unchanged.
    pub async fn start(&self, port: u16) -> io::Result<Started> {
        let mut running = self.session.lock().await;
        if let Some(running) = running.as_ref() {
            return Ok(running.now());
        }
        let token = relay::token()?;
        let assets = Arc::clone(&self.assets);
        let session = Session::open(
            Ipv4Addr::UNSPECIFIED,
            port,
            MAX_VIEWERS,
            self.timing,
            Arc::clone(&self.on_viewers),
            |gate| {
                with_assets(Router::new().route("/follow", get(follow)), assets)
                    .with_state(Follow::new(gate, &token, &self.feed))
            },
        )
        .await?;
        let (lan_found, address) = match lan_address() {
            Some(address) => (true, address),
            None => (false, Ipv4Addr::LOCALHOST),
        };
        let port = session.port();
        let started = Started {
            lan_found,
            port,
            url: format!("http://{address}:{port}/?view=follow&token={token}"),
            viewers: 0,
        };
        *running = Some(Running {
            session,
            started: started.clone(),
        });
        Ok(started)
    }

    /// The running session, or `None` while the relay is off: what a page
    /// that loads again (a game switch reloads it) reads to pick it up.
    pub async fn running(&self) -> Option<Started> {
        self.session.lock().await.as_ref().map(Running::now)
    }

    /// Closes the port and every connection: the viewers' with 4410, the
    /// others at once. Does nothing when the relay is off.
    pub async fn stop(&self) {
        let Some(running) = self.session.lock().await.take() else {
            return;
        };
        running.session.stop().await;
    }
}

impl Running {
    /// The session as `start` handed it, with the viewers watching now.
    fn now(&self) -> Started {
        let mut started = self.started.clone();
        started.viewers = self.session.viewers();
        started
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
    use crate::relay::{BEAT, close};
    use crate::test_support::{
        Viewer, WAIT, assets, close_code, connect, next_any, request, snapshot,
    };
    use futures_util::SinkExt;
    use std::sync::Mutex as StdMutex;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use tokio::net::TcpStream;
    use tokio_tungstenite::tungstenite::Message as WsMessage;

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

    /// A relay over two files, and the viewer counts it reported.
    fn relay() -> (Relay, Arc<StdMutex<Vec<usize>>>) {
        let counts = Arc::new(StdMutex::new(Vec::new()));
        let seen = Arc::clone(&counts);
        let on_viewers: OnViewers = Arc::new(move |count| seen.lock().unwrap().push(count));
        (Relay::new(RunFeed::new(), assets(), on_viewers), counts)
    }

    fn token_of(started: &Started) -> &str {
        started.url.split("token=").nth(1).unwrap()
    }

    async fn watch_with(started: &Started) -> Viewer {
        connect(started.port, &format!("?token={}", token_of(started))).await
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
            .feed
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
            .feed
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
        relay
            .feed
            .publish("sm", "alltp-tracker-sm", "{}", 1)
            .unwrap();
        assert_eq!(snapshot(&mut viewer).await["game"], "sm");
        relay.stop().await;
    }

    #[tokio::test]
    async fn ignores_what_a_viewer_sends() {
        let (relay, _) = relay();
        relay.feed.publish("alttpr", "k", "1", 1).unwrap();
        let started = relay.start(0).await.unwrap();
        let mut viewer = watch_with(&started).await;
        snapshot(&mut viewer).await;
        viewer.send(WsMessage::text("reset")).await.unwrap();
        viewer.send(WsMessage::binary(vec![0; 16])).await.unwrap();
        viewer
            .send(WsMessage::Ping(b"hi".to_vec().into()))
            .await
            .unwrap();
        let pong = loop {
            match next_any(&mut viewer).await {
                WsMessage::Pong(pong) => break pong,
                WsMessage::Ping(_) => {}
                WsMessage::Text(text) if text.as_str() == BEAT => {}
                other => panic!("expected a pong, got {other:?}"),
            }
        };
        assert_eq!(pong, b"hi".to_vec());
        relay.feed.publish("alttpr", "k", "2", 2).unwrap();
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
        relay.feed.publish("alttpr", "k", "1", 1).unwrap();
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
        // A stopped session tells no count: the page has let it go, and a
        // late one would land on the next session
        assert_eq!(*counts.lock().unwrap(), [1, 2]);
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
    async fn stop_closes_a_half_sent_request_which_never_reaches_the_next_session() {
        let (relay, counts) = relay();
        let first = relay.start(0).await.unwrap();
        let port = first.port;
        // An old link's upgrade, sent all but its last line before the stop
        let mut early = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        let head = format!(
            "GET /follow?token={} HTTP/1.1\r\nHost: tracker\r\nConnection: Upgrade\r\n\
             Upgrade: websocket\r\nSec-WebSocket-Version: 13\r\n\
             Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n",
            token_of(&first)
        );
        early.write_all(head.as_bytes()).await.unwrap();
        let mut page = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        page.write_all(b"GET / HTTP/1.1\r\nHost: tracker\r\n")
            .await
            .unwrap();

        relay.stop().await;
        assert!(closed_by_server(&mut page).await);
        // The port is free at once: a plain listener takes it
        drop(
            TcpListener::bind((Ipv4Addr::UNSPECIFIED, port))
                .await
                .unwrap(),
        );

        // Restarted, with a run published: the old request, finished, gets
        // nothing from it
        let second = relay.start(port).await.unwrap();
        assert_eq!(second.port, port);
        relay.feed.publish("alttpr", "k", "secret", 1).unwrap();
        let _ = early.write_all(b"\r\n").await;
        let mut response = Vec::new();
        let read = tokio::time::timeout(WAIT, early.read_to_end(&mut response)).await;
        assert!(read.is_ok(), "the old connection is still open");
        assert!(!String::from_utf8_lossy(&response).contains("secret"));
        assert!(counts.lock().unwrap().is_empty());
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
    async fn tells_whether_it_runs() {
        let (relay, _) = relay();
        assert!(relay.running().await.is_none());
        let started = relay.start(0).await.unwrap();
        let _viewer = watch_with(&started).await;
        let running = relay.running().await.unwrap();
        assert_eq!(running.url, started.url);
        // The count goes up once the server has the viewer's seat
        tokio::time::timeout(WAIT, async {
            while relay.running().await.unwrap().viewers != 1 {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        relay.stop().await;
        assert!(relay.running().await.is_none());
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
}

// The run the page last published, and the route that streams it. One feed
// serves every server the app runs for other devices (live follow, follow.rs;
// the stream view for OBS, stream.rs): the page publishes once, and each
// server hands the run to its own viewers.
//
//   GET /follow?token=…  the run at once, then each change (a WebSocket)
//
// A feed outlives the servers: it keeps the run while all of them are off, so
// a viewer gets it at once when one starts.
//
// This module knows nothing of Tauri, so the tests run the real route.

use crate::relay::{Gate, relay_to};
use axum::extract::ws::{Utf8Bytes, WebSocketUpgrade};
use axum::extract::{RawQuery, State};
use axum::response::Response;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::watch;

/// The largest run the page may publish. A full ALttPR run is a few kB.
pub const MAX_VALUE: usize = 1 << 20;

/// The longest a game id or a storage key may be.
const MAX_NAME: usize = 64;

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

/// The latest run, shared by every server: cloning it shares the run.
#[derive(Clone)]
pub struct RunFeed {
    latest: Arc<watch::Sender<Option<Utf8Bytes>>>,
}

impl RunFeed {
    pub fn new() -> Self {
        RunFeed {
            latest: Arc::new(watch::Sender::new(None)),
        }
    }

    /// Keeps the run the page just saved, and sends it to every viewer of
    /// every server. It is kept while the servers are off.
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

    fn subscribe(&self) -> watch::Receiver<Option<Utf8Bytes>> {
        self.latest.subscribe()
    }
}

/// What the `/follow` route of one session reads.
#[derive(Clone)]
pub struct Follow {
    token: Arc<str>,
    latest: watch::Receiver<Option<Utf8Bytes>>,
    gate: Gate,
}

impl Follow {
    /// The route's state for a session whose viewers must give `token`.
    pub fn new(gate: Gate, token: &str, feed: &RunFeed) -> Self {
        Follow {
            gate,
            latest: feed.subscribe(),
            token: token.into(),
        }
    }
}

/// The stream. A refused viewer gets a socket closed at once with a code
/// that says why (see `Gate::admit`).
pub async fn follow(
    State(follow): State<Follow>,
    RawQuery(query): RawQuery,
    upgrade: WebSocketUpgrade,
) -> Response {
    let Follow {
        gate,
        latest,
        token,
    } = follow;
    let pump = gate.clone();
    gate.admit(upgrade, query.as_deref(), &token, move |socket| {
        relay_to(socket, latest, pump)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_a_run_too_large_to_relay() {
        let feed = RunFeed::new();
        let large = "x".repeat(MAX_VALUE + 1);
        assert!(feed.publish("alttpr", "k", &large, 0).is_err());
        assert!(
            feed.publish(&"g".repeat(MAX_NAME + 1), "k", "{}", 0)
                .is_err()
        );
        assert!(feed.publish("alttpr", "k", "{}", 0).is_ok());
    }

    #[test]
    fn keeps_the_run_for_a_server_that_starts_later() {
        let feed = RunFeed::new();
        feed.publish("sm", "k", "1", 5).unwrap();
        let late = feed.subscribe();
        let text = late.borrow().clone().unwrap();
        let run: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(run["game"], "sm");
        assert_eq!(run["sentAt"], 5);
    }
}

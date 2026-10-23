// The overlay API: a WebSocket that tells stream tools (a custom overlay in a
// Browser Source, Streamer.bot, a script) what the run holds and when it
// changes (docs/overlay-api.md). It is a route of the stream server
// (stream.rs), gated by its own token, and it carries only the whitelist
// the page computes (apps/web/src/overlay/): never a check, a chest or a
// seed.
//
//   GET /overlay?token=…  a `state` frame at once, then an `update` per
//                         change and a `beat` with each ping (a WebSocket)
//
// The page hands the app the new state and the events that led to it
// (`OverlayFeed::publish`); the app numbers each publication (`seq`, one
// sequence for all clients, 1 and up) and relays it. A client therefore sees
// every update in order, or, when it was too slow, the state again and the
// updates after it, with no update twice (`seq` is the proof). The feed
// outlives the server, as the run feed does: a client that connects after a
// stream restart gets the last state at once.
//
// This module knows nothing of Tauri, so the tests run the real route.

use crate::relay::{Gate, Source, pump};
use axum::extract::ws::{Utf8Bytes, WebSocketUpgrade};
use axum::extract::{RawQuery, State};
use axum::http::{HeaderMap, header::SEC_WEBSOCKET_PROTOCOL};
use axum::response::Response;
use serde::Serialize;
use serde_json::value::RawValue;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, watch};

/// The protocol's version, the `v` of every frame. A change a client must
/// know about (a field's meaning, a frame removed) bumps it; new fields and
/// new event types do not (docs/overlay-api.md, "Compatibility").
pub const VERSION: u8 = 1;

/// The largest state or list of events the page may publish, each. The
/// whitelist is a few kB: this is a bound on a compromised page, not a
/// budget.
pub const MAX_INPUT: usize = 64 * 1024;

/// Updates kept for a slow client. One that falls further behind skips them
/// and gets the state again, so a stalled client costs a few frames of memory,
/// never a queue.
const CAPACITY: usize = 16;

/// The most recent state, as the `state` frame a new client gets.
#[derive(Clone)]
struct Latest {
    seq: u64,
    frame: Utf8Bytes,
}

/// An `update` frame, with the number it carries.
#[derive(Clone)]
struct Update {
    seq: u64,
    frame: Utf8Bytes,
}

#[derive(Serialize)]
struct Frame<'a> {
    v: u8,
    #[serde(rename = "type")]
    kind: &'static str,
    seq: u64,
    state: &'a RawValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    events: Option<&'a RawValue>,
}

#[derive(Serialize)]
struct Beat {
    v: u8,
    #[serde(rename = "type")]
    kind: &'static str,
    seq: u64,
    now: u64,
}

struct Inner {
    /// The last number given. Held while a publication is set and sent, so
    /// the numbers reach the clients in order.
    seq: Mutex<u64>,
    latest: watch::Sender<Option<Latest>>,
    updates: broadcast::Sender<Update>,
}

/// What the page last said about the run, shared by the servers' sessions:
/// cloning it shares it.
#[derive(Clone)]
pub struct OverlayFeed {
    inner: Arc<Inner>,
}

/// `text` as JSON of one kind: `open` is the character it must start with.
fn checked<'a>(what: &str, text: &'a str, open: char) -> Result<&'a RawValue, String> {
    if text.len() > MAX_INPUT {
        return Err(format!("the {what} is over {MAX_INPUT} bytes"));
    }
    let raw: &RawValue =
        serde_json::from_str(text).map_err(|error| format!("the {what} is not JSON: {error}"))?;
    if !raw.get().starts_with(open) {
        return Err(format!(
            "the {what} must be a JSON {}",
            if open == '{' { "object" } else { "array" }
        ));
    }
    Ok(raw)
}

impl OverlayFeed {
    pub fn new() -> Self {
        OverlayFeed {
            inner: Arc::new(Inner {
                latest: watch::Sender::new(None),
                seq: Mutex::new(0),
                updates: broadcast::Sender::new(CAPACITY),
            }),
        }
    }

    /// Keeps the new state and sends it, with the events that led to it, to
    /// every client. `state` is a JSON object and `events` a JSON array, each
    /// within MAX_INPUT; neither is read further, the page owns their
    /// shape. Refused otherwise, and nothing is kept.
    pub fn publish(&self, state: &str, events: &str) -> Result<(), String> {
        let state = checked("state", state, '{')?;
        let events = checked("events", events, '[')?;
        let mut seq = self.inner.seq.lock().map_err(|_| "poisoned".to_owned())?;
        let next = *seq + 1;
        let frame = |kind, events| {
            serde_json::to_string(&Frame {
                events,
                kind,
                seq: next,
                state,
                v: VERSION,
            })
            .map(Utf8Bytes::from)
            .map_err(|error| error.to_string())
        };
        let update = frame("update", Some(events))?;
        let at_once = frame("state", None)?;
        *seq = next;
        self.inner.latest.send_replace(Some(Latest {
            frame: at_once,
            seq: next,
        }));
        // No client is not an error
        let _ = self.inner.updates.send(Update {
            frame: update,
            seq: next,
        });
        Ok(())
    }

    /// A client's source. Subscribed to the updates here, and the state read
    /// on its first frame: an update published between the two is in both
    /// and skipped by its number, none is lost.
    fn source(&self) -> OverlaySource {
        OverlaySource {
            latest: self.inner.latest.subscribe(),
            sent: 0,
            started: false,
            updates: self.inner.updates.subscribe(),
        }
    }
}

/// What one client is sent: the state, then the updates after it.
struct OverlaySource {
    latest: watch::Receiver<Option<Latest>>,
    updates: broadcast::Receiver<Update>,
    /// The highest `seq` sent
    sent: u64,
    started: bool,
}

impl OverlaySource {
    /// The state frame, when it is newer than what was sent.
    fn state(&mut self) -> Option<Utf8Bytes> {
        let latest = self.latest.borrow();
        let latest = latest.as_ref().filter(|latest| latest.seq > self.sent)?;
        self.sent = latest.seq;
        Some(latest.frame.clone())
    }
}

impl Source for OverlaySource {
    async fn next(&mut self) -> Option<Utf8Bytes> {
        if !self.started {
            self.started = true;
            if let Some(frame) = self.state() {
                return Some(frame);
            }
        }
        loop {
            match self.updates.recv().await {
                Ok(update) if update.seq > self.sent => {
                    self.sent = update.seq;
                    return Some(update.frame);
                }
                // Already in the state a lag or the first read sent
                Ok(_) => {}
                // Too slow: the updates it missed are gone, the state is
                // the whole of them
                Err(broadcast::error::RecvError::Lagged(_)) => {
                    if let Some(frame) = self.state() {
                        return Some(frame);
                    }
                }
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    }

    /// The beat carries the last `seq` (a client that sees it ahead of its
    /// own missed something) and the app's clock, which the timer needs.
    fn beat(&mut self) -> Utf8Bytes {
        let seq = self.latest.borrow().as_ref().map_or(0, |latest| latest.seq);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |since| since.as_millis() as u64);
        serde_json::to_string(&Beat {
            kind: "beat",
            now,
            seq,
            v: VERSION,
        })
        .map_or_else(|_| Utf8Bytes::from_static("{}"), Utf8Bytes::from)
    }
}

/// What the `/overlay` route of one session reads.
#[derive(Clone)]
pub struct Overlay {
    token: Arc<str>,
    feed: OverlayFeed,
    gate: Gate,
}

impl Overlay {
    /// The route's state for a session whose clients must give `token`.
    pub fn new(gate: Gate, token: &str, feed: &OverlayFeed) -> Self {
        Overlay {
            feed: feed.clone(),
            gate,
            token: token.into(),
        }
    }
}

/// The API. A refused client gets a socket closed at once with a code that
/// says why (see `Gate::admit`).
pub async fn overlay(
    State(overlay): State<Overlay>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Response {
    let Overlay { feed, gate, token } = overlay;
    let seat = gate.clone();
    let protocols = headers
        .get(SEC_WEBSOCKET_PROTOCOL)
        .and_then(|value| value.to_str().ok());
    gate.admit(
        upgrade,
        query.as_deref(),
        protocols,
        &token,
        move |socket| pump(socket, seat, feed.source()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn json(frame: &Utf8Bytes) -> serde_json::Value {
        serde_json::from_str(frame).unwrap()
    }

    async fn next(source: &mut OverlaySource) -> serde_json::Value {
        let frame = tokio::time::timeout(Duration::from_secs(2), source.next())
            .await
            .expect("no frame")
            .expect("the source ended");
        json(&frame)
    }

    /// Nothing more is waiting.
    async fn quiet(source: &mut OverlaySource) -> bool {
        tokio::time::timeout(Duration::from_millis(100), source.next())
            .await
            .is_err()
    }

    #[tokio::test]
    async fn a_client_gets_the_last_state_then_each_update_in_order() {
        let feed = OverlayFeed::new();
        feed.publish(r#"{"items":[1]}"#, "[]").unwrap();
        let mut source = feed.source();

        let first = next(&mut source).await;
        assert_eq!(first["type"], "state");
        assert_eq!(first["v"], 1);
        assert_eq!(first["seq"], 1);
        assert_eq!(first["state"]["items"][0], 1);
        assert!(first.get("events").is_none());

        feed.publish(r#"{"items":[2]}"#, r#"[{"type":"item"}]"#)
            .unwrap();
        feed.publish(r#"{"items":[3]}"#, "[]").unwrap();
        let second = next(&mut source).await;
        let third = next(&mut source).await;
        assert_eq!(second["type"], "update");
        assert_eq!(second["seq"], 2);
        assert_eq!(second["events"][0]["type"], "item");
        assert_eq!(third["seq"], 3);
        assert_eq!(third["state"]["items"][0], 3);
        assert!(quiet(&mut source).await);
    }

    #[tokio::test]
    async fn a_client_with_no_state_to_get_waits_for_the_first_update() {
        let feed = OverlayFeed::new();
        let mut source = feed.source();
        assert!(quiet(&mut source).await);
        feed.publish("{}", "[]").unwrap();
        let frame = next(&mut source).await;
        assert_eq!(frame["type"], "update");
        assert_eq!(frame["seq"], 1);
    }

    #[tokio::test]
    async fn a_slow_client_gets_the_state_again_and_no_update_twice() {
        let feed = OverlayFeed::new();
        feed.publish(r#"{"n":0}"#, "[]").unwrap();
        let mut source = feed.source();
        assert_eq!(next(&mut source).await["seq"], 1);

        // Far more than the feed keeps, while the client reads nothing
        for n in 1..=(CAPACITY * 3) {
            feed.publish(&format!(r#"{{"n":{n}}}"#), "[]").unwrap();
        }
        let last = (CAPACITY * 3) as u64 + 1;
        let again = next(&mut source).await;
        assert_eq!(again["type"], "state");
        assert_eq!(again["seq"], last);
        assert_eq!(again["state"]["n"], CAPACITY * 3);
        // The updates it missed are not sent after the state
        assert!(quiet(&mut source).await);

        feed.publish(r#"{"n":99}"#, "[]").unwrap();
        let after = next(&mut source).await;
        assert_eq!(after["type"], "update");
        assert_eq!(after["seq"], last + 1);
    }

    #[tokio::test]
    async fn the_numbers_never_go_back_whatever_the_client_reads() {
        let feed = OverlayFeed::new();
        let mut source = feed.source();
        let mut seen = Vec::new();
        for n in 0..40 {
            feed.publish(&format!(r#"{{"n":{n}}}"#), "[]").unwrap();
            // Now and then the client reads one: it is neither always keeping
            // up nor always behind
            if n % 7 == 0
                && let Ok(Some(frame)) =
                    tokio::time::timeout(Duration::from_millis(50), source.next()).await
            {
                seen.push(json(&frame)["seq"].as_u64().unwrap());
            }
        }
        while let Ok(Some(frame)) =
            tokio::time::timeout(Duration::from_millis(100), source.next()).await
        {
            seen.push(json(&frame)["seq"].as_u64().unwrap());
        }
        assert!(seen.windows(2).all(|pair| pair[0] < pair[1]), "{seen:?}");
        assert_eq!(seen.last(), Some(&40));
    }

    #[tokio::test]
    async fn the_beat_carries_the_last_number_and_the_apps_clock() {
        let feed = OverlayFeed::new();
        let mut source = feed.source();
        let before = json(&source.beat());
        assert_eq!(before["type"], "beat");
        assert_eq!(before["v"], 1);
        assert_eq!(before["seq"], 0);
        feed.publish("{}", "[]").unwrap();
        feed.publish("{}", "[]").unwrap();
        let beat = json(&source.beat());
        assert_eq!(beat["seq"], 2);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        assert!(beat["now"].as_u64().unwrap().abs_diff(now) < 5_000);
    }

    #[test]
    fn refuses_what_is_not_a_state_and_a_list_of_events() {
        let feed = OverlayFeed::new();
        assert!(feed.publish("[]", "[]").is_err());
        assert!(feed.publish("1", "[]").is_err());
        assert!(feed.publish("{}", "{}").is_err());
        assert!(feed.publish("{", "[]").is_err());
        assert!(feed.publish("{}", "").is_err());
        assert!(feed.publish("not json", "[]").is_err());
        let long = format!(r#"{{"x":"{}"}}"#, "a".repeat(MAX_INPUT));
        assert!(feed.publish(&long, "[]").is_err());
        let events = format!(r#"["{}"]"#, "a".repeat(MAX_INPUT));
        assert!(feed.publish("{}", &events).is_err());
        // Nothing refused was kept or numbered
        assert!(feed.inner.latest.borrow().is_none());
        assert!(feed.publish("{}", "[]").is_ok());
        assert_eq!(feed.inner.latest.borrow().as_ref().unwrap().seq, 1);
    }

    #[test]
    fn takes_a_state_and_events_with_spaces_around_them() {
        let feed = OverlayFeed::new();
        assert!(feed.publish("  {} ", "\n[ ]\n").is_ok());
    }
}

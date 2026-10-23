// What the tests of the servers (follow.rs, stream.rs) share: the files they
// serve, and a viewer's side of the socket.

use crate::relay::{Asset, Assets, BEAT};
use futures_util::StreamExt;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

pub type Viewer = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub const WAIT: Duration = Duration::from_secs(2);

/// Two files, as the app would serve them.
pub fn assets() -> Assets {
    Arc::new(|path| {
        let mime = match path {
            "index.html" => "text/html",
            "assets/app-1a2b.js" => "text/javascript",
            _ => return None,
        };
        Some(Asset {
            bytes: path.as_bytes().to_vec(),
            mime: mime.to_owned(),
        })
    })
}

/// Connects to `/follow` on `port`; `query` is the part from `?`.
pub async fn connect(port: u16, query: &str) -> Viewer {
    let url = format!("ws://127.0.0.1:{port}/follow{query}");
    connect_async(url).await.unwrap().0
}

/// The next message, pings, pongs and beats included.
pub async fn next_any(viewer: &mut Viewer) -> WsMessage {
    tokio::time::timeout(WAIT, viewer.next())
        .await
        .expect("the relay said nothing")
        .expect("the relay hung up")
        .expect("the stream broke")
}

/// The next message, skipping the pings, pongs and beats.
pub async fn next(viewer: &mut Viewer) -> WsMessage {
    loop {
        let message = next_any(viewer).await;
        let chatter = match &message {
            WsMessage::Ping(_) | WsMessage::Pong(_) => true,
            WsMessage::Text(text) => text.as_str() == BEAT,
            _ => false,
        };
        if !chatter {
            return message;
        }
    }
}

pub async fn close_code(viewer: &mut Viewer) -> u16 {
    match next(viewer).await {
        WsMessage::Close(Some(frame)) => u16::from(frame.code),
        other => panic!("expected a close, got {other:?}"),
    }
}

pub async fn snapshot(viewer: &mut Viewer) -> serde_json::Value {
    match next(viewer).await {
        WsMessage::Text(text) => serde_json::from_str(&text).unwrap(),
        other => panic!("expected a snapshot, got {other:?}"),
    }
}

/// One plain HTTP request; the status and the whole response.
pub async fn request(port: u16, method: &str, path: &str) -> (u16, String) {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    let head = format!("{method} {path} HTTP/1.1\r\nHost: tracker\r\nConnection: close\r\n\r\n");
    stream.write_all(head.as_bytes()).await.unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    let status = response[9..12].parse().unwrap();
    (status, response)
}

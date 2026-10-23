// The desktop app: the tracker's web build in a native window (apps/web,
// built in its "desktop" mode), with what a browser cannot give it.
// Autotracking reads RetroArch through its network commands, links open in
// the system browser, exports go through the system's Save dialog, global
// shortcuts work while the emulator has the focus (shortcuts/, and the
// command line in cli.rs), an AppImage can add itself to the application menu
// (app_menu.rs, launcher.rs), the run can be followed live from another
// device on the local network (follow.rs) and shown to OBS (stream.rs), both
// served over relay.rs and feed.rs, and new versions come from GitHub
// Releases, signed with the project's updater key (docs/desktop.md).

mod app_menu;
mod cli;
mod feed;
mod files;
mod follow;
#[cfg(target_os = "linux")]
mod launcher;
mod relay;
mod retroarch;
mod shortcuts;
mod stream;
#[cfg(test)]
mod test_support;

use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Sends one of RetroArch's network commands and returns its reply, or
/// `None` when nothing answered within `timeout_ms` (see `retroarch.rs`).
#[tauri::command]
async fn retroarch(command: String, timeout_ms: u64) -> Result<Option<String>, String> {
    retroarch::exchange(
        retroarch::RETROARCH,
        &command,
        Duration::from_millis(timeout_ms),
    )
    .await
    .map_err(|error| error.to_string())
}

/// Saves a file where the player picks it, through the system's Save
/// dialog: the page can write nowhere else. `Ok(false)` when the player
/// cancels. Async, so the blocking dialog runs off the main thread.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, name: String, contents: String) -> Result<bool, String> {
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("Tracker save", &["json"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|error| error.to_string())?;
    std::fs::write(path, contents).map_err(|error| error.to_string())?;
    Ok(true)
}

/// Whether the AppImage can be added to the application menu, and whether it
/// is (see `launcher.rs`). Async, so the file reads run off the main thread.
#[tauri::command]
async fn app_menu_state() -> app_menu::State {
    app_menu::state()
}

/// Adds the AppImage to the application menu, or removes it, and returns how
/// it stands. Takes no path from the page: the entry always names the running
/// AppImage.
#[tauri::command]
async fn app_menu_set(added: bool) -> Result<app_menu::State, String> {
    app_menu::set_added(added)
}

/// Opens the live follow relay on the local network, or hands back the one
/// running (see `follow.rs`).
#[tauri::command]
async fn follow_start(relay: State<'_, follow::Relay>) -> Result<follow::Started, String> {
    relay
        .start(follow::PORT)
        .await
        .map_err(|error| error.to_string())
}

/// The running relay's session, or nothing while it is off.
#[tauri::command]
async fn follow_state(relay: State<'_, follow::Relay>) -> Result<Option<follow::Started>, String> {
    Ok(relay.running().await)
}

/// Closes the relay and every viewer's connection; nothing when it is off.
#[tauri::command]
async fn follow_stop(relay: State<'_, follow::Relay>) -> Result<(), String> {
    relay.stop().await;
    Ok(())
}

/// Hands the servers the run the page just saved: `value` is the game's
/// persisted state, `sent_at` the page's clock (ms). Live follow and the
/// stream view both send it on. Async, so a large run is copied off the main
/// thread.
#[tauri::command]
async fn run_publish(
    feed: State<'_, feed::RunFeed>,
    game: String,
    key: String,
    value: String,
    sent_at: u64,
) -> Result<(), String> {
    feed.publish(&game, &key, &value, sent_at)
}

/// Turns the stream view for OBS on, or hands back the running one (see
/// `stream.rs`). The switch is kept: the stream starts by itself at launch.
#[tauri::command]
async fn stream_start(stream: State<'_, stream::Stream>) -> Result<stream::Started, String> {
    stream.start().await.map_err(|error| error.to_string())
}

/// The running stream, or nothing while it is off.
#[tauri::command]
async fn stream_state(
    stream: State<'_, stream::Stream>,
) -> Result<Option<stream::Started>, String> {
    Ok(stream.running().await)
}

/// Turns the stream off until the player turns it on again.
#[tauri::command]
async fn stream_stop(stream: State<'_, stream::Stream>) -> Result<(), String> {
    stream.stop().await;
    Ok(())
}

/// Allows other devices on the network to reach the stream, or takes that
/// back (loopback only). A running stream opens again on the same port with
/// the same tokens: its new session, or nothing while the stream is off.
#[tauri::command]
async fn stream_set_lan(
    stream: State<'_, stream::Stream>,
    lan: bool,
) -> Result<Option<stream::Started>, String> {
    stream.set_lan(lan).await.map_err(|error| error.to_string())
}

/// Replaces the stream's tokens, which closes the sources that hold the old
/// address: the new session, or nothing while the stream is off.
#[tauri::command]
async fn stream_new_tokens(
    stream: State<'_, stream::Stream>,
) -> Result<Option<stream::Started>, String> {
    stream.new_tokens().await.map_err(|error| error.to_string())
}

#[derive(Clone, Serialize)]
struct ViewersPayload {
    count: usize,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First, as the plugin asks: a second launch hands its arguments to the
        // running app (`--step`) and exits, or brings its window forward
        .plugin(tauri_plugin_single_instance::init(cli::on_second_instance))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // A `--step` this launch was started with waits for the page to load
        .manage(shortcuts::GlobalShortcuts::new(cli::own_steps()))
        // An existing menu entry follows the AppImage if it moved
        .setup(|app| {
            app_menu::refresh_at_launch();
            let feed = feed::RunFeed::new();
            app.manage(feed.clone());
            let assets = follow::tauri_assets(app.handle().clone());
            let handle = app.handle().clone();
            let on_followers = Arc::new(move |count| {
                let _ = handle.emit("follow-viewers", ViewersPayload { count });
            });
            app.manage(follow::Relay::new(
                feed.clone(),
                Arc::clone(&assets),
                on_followers,
            ));
            let handle = app.handle().clone();
            let on_sources = Arc::new(move |count| {
                let _ = handle.emit("stream-viewers", ViewersPayload { count });
            });
            // Without a config directory nothing could be kept: the stream
            // is unavailable (it refuses to start) rather than the app
            let config_dir = app
                .path()
                .app_config_dir()
                .inspect_err(|error| eprintln!("the stream is unavailable: {error}"))
                .ok();
            app.manage(stream::Stream::new(
                config_dir,
                stream::PORT,
                feed,
                assets,
                on_sources,
            ));
            // A stream left on opens by itself: the address in OBS keeps
            // working. The page may load before or after it: it asks for the
            // stream when it loads, and hears this event if that was too early
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match handle.state::<stream::Stream>().resume().await {
                    Ok(Some(started)) => {
                        let _ = handle.emit("stream-started", started);
                    }
                    Ok(None) => {}
                    Err(error) => eprintln!("could not start the stream: {error}"),
                }
            });
            Ok(())
        })
        .on_page_load(shortcuts::on_page_load)
        .invoke_handler(tauri::generate_handler![
            app_menu_set,
            app_menu_state,
            follow_start,
            follow_state,
            follow_stop,
            retroarch,
            run_publish,
            save_file,
            shortcuts::global_shortcuts_ready,
            shortcuts::global_shortcuts_apply,
            shortcuts::global_shortcuts_configure,
            shortcuts::key_labels,
            stream_new_tokens,
            stream_set_lan,
            stream_start,
            stream_state,
            stream_stop
        ])
        .build(tauri::generate_context!())
        .expect("error while building the tracker")
        .run(|app, event| {
            // Viewers are told the servers stopped, rather than left to retry.
            // The stream's switch stays on: it opens again at the next launch
            if let tauri::RunEvent::Exit = event {
                // Both at once: each waits up to 2 s for its viewers to leave
                let relay = app.state::<follow::Relay>();
                let stream = app.state::<stream::Stream>();
                tauri::async_runtime::block_on(async {
                    tokio::join!(relay.stop(), stream.shutdown())
                });
            }
        });
}

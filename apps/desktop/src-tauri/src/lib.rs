// The desktop app: the tracker's web build in a native window (apps/web,
// built in its "desktop" mode), with what a browser cannot give it.
// Autotracking reads RetroArch through its network commands, links open in
// the system browser, exports go through the system's Save dialog, global
// shortcuts work while the emulator has the focus (shortcuts/, and the
// command line in cli.rs), an AppImage can add itself to the application menu
// (app_menu.rs, launcher.rs), the run can be followed live from another
// device on the local network (follow.rs, relay.rs), and new versions come
// from GitHub Releases, signed with the project's updater key (docs/desktop.md).

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
/// persisted state, `sent_at` the page's clock (ms). Every server streams it
/// (live follow today). Async, so a large run is copied off the main thread.
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
            let handle = app.handle().clone();
            let on_viewers = Arc::new(move |count| {
                let _ = handle.emit("follow-viewers", ViewersPayload { count });
            });
            let feed = feed::RunFeed::new();
            app.manage(feed.clone());
            app.manage(follow::Relay::new(
                feed,
                follow::tauri_assets(app.handle().clone()),
                on_viewers,
            ));
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
            shortcuts::key_labels
        ])
        .build(tauri::generate_context!())
        .expect("error while building the tracker")
        .run(|app, event| {
            // Viewers are told the relay stopped, rather than left to retry
            if let tauri::RunEvent::Exit = event {
                tauri::async_runtime::block_on(app.state::<follow::Relay>().stop());
            }
        });
}

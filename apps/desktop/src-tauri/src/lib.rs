// The desktop app: the tracker's web build in a native window (apps/web,
// built in its "desktop" mode), with what a browser cannot give it.
// Autotracking reads RetroArch through its network commands, links open in
// the system browser, exports go through the system's Save dialog, and new
// versions come from GitHub Releases, signed with the project's updater key
// (docs/desktop.md).

mod retroarch;

use std::time::Duration;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![retroarch, save_file])
        .run(tauri::generate_context!())
        .expect("error while running the tracker");
}

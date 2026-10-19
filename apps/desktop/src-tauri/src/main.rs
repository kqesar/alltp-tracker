// No console window beside the app on Windows, in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    alltp_tracker_lib::run();
}

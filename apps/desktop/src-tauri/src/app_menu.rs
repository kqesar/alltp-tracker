// The application menu entry for a downloaded AppImage, which installs none.
// Linux only: the page asks for the state and for a change, and
// `launcher.rs` writes the desktop file and icons. Everywhere else the app
// offers nothing (Windows and macOS installers add their own entry, as do
// the .deb and .rpm).

use serde::Serialize;

/// What the page learns about the entry.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct State {
    /// Whether the app can offer the entry at all: running as an AppImage
    pub available: bool,
    /// Whether the entry is in the menu now
    pub added: bool,
}

#[cfg(target_os = "linux")]
pub use crate::launcher::{refresh_at_launch, set_added, state};

#[cfg(not(target_os = "linux"))]
pub fn state() -> State {
    State::default()
}

#[cfg(not(target_os = "linux"))]
pub fn set_added(_added: bool) -> Result<State, String> {
    Err("only an AppImage has a menu entry to add".into())
}

#[cfg(not(target_os = "linux"))]
pub fn refresh_at_launch() {}

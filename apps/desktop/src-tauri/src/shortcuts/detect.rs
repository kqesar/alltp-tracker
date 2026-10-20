// Which way this system can register global shortcuts. A pure function over
// a snapshot of the environment, so every rule is tested.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Os {
    Windows,
    Macos,
    Linux,
}

impl Os {
    pub fn current() -> Os {
        if cfg!(windows) {
            Os::Windows
        } else if cfg!(target_os = "macos") {
            Os::Macos
        } else {
            Os::Linux
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Os::Windows => "windows",
            Os::Macos => "macos",
            Os::Linux => "linux",
        }
    }
}

/// What the desktop session tells.
#[derive(Clone, Debug, Default)]
pub struct Env {
    /// `XDG_SESSION_TYPE`
    pub session_type: Option<String>,
    pub wayland_display: bool,
    pub display: bool,
    /// `ALLTP_GLOBAL_SHORTCUTS`: `hotkeys`, `portal` or `command`
    pub forced: Option<String>,
}

fn non_empty(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

impl Env {
    pub fn current() -> Env {
        Env {
            display: non_empty("DISPLAY").is_some(),
            forced: non_empty("ALLTP_GLOBAL_SHORTCUTS"),
            session_type: non_empty("XDG_SESSION_TYPE"),
            wayland_display: non_empty("WAYLAND_DISPLAY").is_some(),
        }
    }

    /// Whether the player's session is Wayland. The session decides, not the
    /// app's own GDK backend: what matters is where the emulator's key events
    /// go, and a native Wayland client never shows its keys to an X11 grab.
    pub fn is_wayland(&self) -> bool {
        self.session_type.as_deref() == Some("wayland") || self.wayland_display
    }
}

/// How global shortcuts are registered.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// The system's own hotkeys: Windows, macOS, X11 (global-hotkey)
    Hotkeys,
    /// The desktop's GlobalShortcuts portal (Wayland)
    Portal,
    /// The command line `alltp-tracker --step ...`, bound in the window manager
    Command,
}

fn forced(os: Os, name: &str) -> Option<Kind> {
    match name {
        "hotkeys" => Some(Kind::Hotkeys),
        "command" => Some(Kind::Command),
        "portal" if os == Os::Linux => Some(Kind::Portal),
        _ => None,
    }
}

/// The mechanism for this system. `portal` is the GlobalShortcuts portal's
/// version when the desktop has one (probed only on a Wayland session).
pub fn pick(os: Os, env: &Env, portal: Option<u32>) -> Kind {
    if let Some(kind) = env.forced.as_deref().and_then(|name| forced(os, name)) {
        return kind;
    }
    match os {
        Os::Windows | Os::Macos => Kind::Hotkeys,
        Os::Linux if env.is_wayland() => match portal {
            Some(version) if version >= 1 => Kind::Portal,
            _ => Kind::Command,
        },
        Os::Linux if env.display => Kind::Hotkeys,
        Os::Linux => Kind::Command,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linux(session: Option<&str>, wayland: bool, display: bool) -> Env {
        Env {
            display,
            forced: None,
            session_type: session.map(str::to_owned),
            wayland_display: wayland,
        }
    }

    #[test]
    fn windows_and_macos_use_the_systems_hotkeys() {
        let env = Env::default();
        assert_eq!(pick(Os::Windows, &env, None), Kind::Hotkeys);
        assert_eq!(pick(Os::Macos, &env, Some(2)), Kind::Hotkeys);
    }

    #[test]
    fn a_wayland_session_with_a_portal_uses_it() {
        let env = linux(Some("wayland"), true, true);
        assert_eq!(pick(Os::Linux, &env, Some(1)), Kind::Portal);
        assert_eq!(pick(Os::Linux, &env, Some(2)), Kind::Portal);
    }

    #[test]
    fn a_wayland_session_without_a_portal_falls_to_the_command() {
        let env = linux(Some("wayland"), true, true);
        assert_eq!(pick(Os::Linux, &env, None), Kind::Command);
        assert_eq!(pick(Os::Linux, &env, Some(0)), Kind::Command);
    }

    #[test]
    fn the_session_decides_not_the_display_variable() {
        // XWayland leaves DISPLAY set: X11 grabs would miss a Wayland emulator
        assert_eq!(
            pick(Os::Linux, &linux(Some("wayland"), false, true), None),
            Kind::Command
        );
        assert_eq!(
            pick(Os::Linux, &linux(None, true, true), None),
            Kind::Command
        );
        assert_eq!(
            pick(Os::Linux, &linux(Some("wayland"), false, true), Some(1)),
            Kind::Portal
        );
    }

    #[test]
    fn an_x11_session_uses_hotkeys() {
        assert_eq!(
            pick(Os::Linux, &linux(Some("x11"), false, true), None),
            Kind::Hotkeys
        );
        // No session type told, only a display
        assert_eq!(
            pick(Os::Linux, &linux(None, false, true), Some(2)),
            Kind::Hotkeys
        );
    }

    #[test]
    fn a_session_with_no_display_has_only_the_command() {
        assert_eq!(
            pick(Os::Linux, &linux(Some("tty"), false, false), None),
            Kind::Command
        );
    }

    #[test]
    fn the_override_wins() {
        let mut env = linux(Some("wayland"), true, true);
        env.forced = Some("hotkeys".into());
        assert_eq!(pick(Os::Linux, &env, Some(2)), Kind::Hotkeys);
        env.forced = Some("command".into());
        assert_eq!(pick(Os::Linux, &env, Some(2)), Kind::Command);
        env.forced = Some("portal".into());
        assert_eq!(pick(Os::Linux, &env, None), Kind::Portal);

        // The portal is Linux's: elsewhere that override means nothing
        let mut windows = Env {
            forced: Some("portal".into()),
            ..Env::default()
        };
        assert_eq!(pick(Os::Windows, &windows, None), Kind::Hotkeys);
        // An unknown override is ignored
        windows.forced = Some("telepathy".into());
        assert_eq!(pick(Os::Windows, &windows, None), Kind::Hotkeys);
    }
}

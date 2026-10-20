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

/// The mechanism for this system. A Wayland session is `Portal` on the
/// session's word alone: whether the desktop really has the GlobalShortcuts
/// portal is probed at the first binding, never at launch (the probe writes a
/// file and registers with the desktop), and a probe that finds none gives the
/// mechanism up to `Command`.
pub fn pick(os: Os, env: &Env) -> Kind {
    if let Some(kind) = env.forced.as_deref().and_then(|name| forced(os, name)) {
        return kind;
    }
    match os {
        Os::Windows | Os::Macos => Kind::Hotkeys,
        Os::Linux if env.is_wayland() => Kind::Portal,
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
        assert_eq!(pick(Os::Windows, &env), Kind::Hotkeys);
        assert_eq!(pick(Os::Macos, &env), Kind::Hotkeys);
    }

    #[test]
    fn a_wayland_session_is_the_portals_before_anything_is_probed() {
        let env = linux(Some("wayland"), true, true);
        assert_eq!(pick(Os::Linux, &env), Kind::Portal);
    }

    #[test]
    fn the_session_decides_not_the_display_variable() {
        // XWayland leaves DISPLAY set: X11 grabs would miss a Wayland emulator
        assert_eq!(
            pick(Os::Linux, &linux(Some("wayland"), false, true)),
            Kind::Portal
        );
        assert_eq!(pick(Os::Linux, &linux(None, true, true)), Kind::Portal);
    }

    #[test]
    fn an_x11_session_uses_hotkeys() {
        assert_eq!(
            pick(Os::Linux, &linux(Some("x11"), false, true)),
            Kind::Hotkeys
        );
        // No session type told, only a display
        assert_eq!(pick(Os::Linux, &linux(None, false, true)), Kind::Hotkeys);
    }

    #[test]
    fn a_session_with_no_display_has_only_the_command() {
        assert_eq!(
            pick(Os::Linux, &linux(Some("tty"), false, false)),
            Kind::Command
        );
    }

    #[test]
    fn the_override_wins() {
        let mut env = linux(Some("wayland"), true, true);
        env.forced = Some("hotkeys".into());
        assert_eq!(pick(Os::Linux, &env), Kind::Hotkeys);
        env.forced = Some("command".into());
        assert_eq!(pick(Os::Linux, &env), Kind::Command);
        env.forced = Some("portal".into());
        assert_eq!(pick(Os::Linux, &env), Kind::Portal);

        // The portal is Linux's: elsewhere that override means nothing
        let mut windows = Env {
            forced: Some("portal".into()),
            ..Env::default()
        };
        assert_eq!(pick(Os::Windows, &windows), Kind::Hotkeys);
        // An unknown override is ignored
        windows.forced = Some("telepathy".into());
        assert_eq!(pick(Os::Windows, &windows), Kind::Hotkeys);
    }
}

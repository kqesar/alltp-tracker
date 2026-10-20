// Physical keys and layouts. The page stores a chord by physical key (a
// `KeyboardEvent.code`: `KeyQ` is the key left of W on any keyboard), so a
// binding stays on the same key whatever the layout. The grabbing backends do
// not all mean the same by a key:
//
//   macOS    Carbon's kVK_ANSI_* are physical positions: nothing to do.
//   Windows  RegisterHotKey takes a virtual key, which follows the layout:
//            VK_Q is the key labelled Q, at KeyA's place on AZERTY.
//   X11      global-hotkey grabs the first keycode whose keysyms hold the
//            key's letter, again by label.
//
// So `KeyQ` must be handed to global-hotkey as the Code that grabs the
// physical key left of W on this layout: `KeyA` on AZERTY. The decision
// tables are pure and tested; only the reading of the layout is per system.

// Each table is read by the system it describes (the tests read them all
// everywhere): X11's keysyms on Linux, Windows' virtual keys on Windows.
// macOS grabs physical positions as they are.
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use super::chord::CODES;

/// A key whose meaning depends on the layout, with what each system calls it.
struct Key {
    code: &'static str,
    /// The Linux evdev code, which is also the Windows set 1 scancode for the
    /// main block. The X keycode is this plus 8.
    scancode: u16,
    /// The keysym global-hotkey's X11 backend looks for (uppercase letters).
    keysym: u32,
    /// The virtual key global-hotkey's Windows backend registers.
    vk: u32,
}

const fn key(code: &'static str, scancode: u16, keysym: u32, vk: u32) -> Key {
    Key {
        code,
        keysym,
        scancode,
        vk,
    }
}

/// A letter: its keysym and virtual key are the ASCII capital.
const fn letter(code: &'static str, scancode: u16, capital: u8) -> Key {
    key(code, scancode, capital as u32, capital as u32)
}

/// A digit of the top row: keysym and virtual key are the ASCII digit.
const fn digit(code: &'static str, scancode: u16, ascii: u8) -> Key {
    key(code, scancode, ascii as u32, ascii as u32)
}

const LAYOUT_KEYS: &[Key] = &[
    letter("KeyQ", 16, b'Q'),
    letter("KeyW", 17, b'W'),
    letter("KeyE", 18, b'E'),
    letter("KeyR", 19, b'R'),
    letter("KeyT", 20, b'T'),
    letter("KeyY", 21, b'Y'),
    letter("KeyU", 22, b'U'),
    letter("KeyI", 23, b'I'),
    letter("KeyO", 24, b'O'),
    letter("KeyP", 25, b'P'),
    letter("KeyA", 30, b'A'),
    letter("KeyS", 31, b'S'),
    letter("KeyD", 32, b'D'),
    letter("KeyF", 33, b'F'),
    letter("KeyG", 34, b'G'),
    letter("KeyH", 35, b'H'),
    letter("KeyJ", 36, b'J'),
    letter("KeyK", 37, b'K'),
    letter("KeyL", 38, b'L'),
    letter("KeyZ", 44, b'Z'),
    letter("KeyX", 45, b'X'),
    letter("KeyC", 46, b'C'),
    letter("KeyV", 47, b'V'),
    letter("KeyB", 48, b'B'),
    letter("KeyN", 49, b'N'),
    letter("KeyM", 50, b'M'),
    digit("Digit1", 2, b'1'),
    digit("Digit2", 3, b'2'),
    digit("Digit3", 4, b'3'),
    digit("Digit4", 5, b'4'),
    digit("Digit5", 6, b'5'),
    digit("Digit6", 7, b'6'),
    digit("Digit7", 8, b'7'),
    digit("Digit8", 9, b'8'),
    digit("Digit9", 10, b'9'),
    digit("Digit0", 11, b'0'),
    key("Minus", 12, 0x2d, 0xBD),
    key("Equal", 13, 0x3d, 0xBB),
    key("BracketLeft", 26, 0x5b, 0xDB),
    key("BracketRight", 27, 0x5d, 0xDD),
    key("Semicolon", 39, 0x3b, 0xBA),
    // global-hotkey 0.8 looks for U+2018, which no layout puts on a key: this
    // one cannot be grabbed on X11 (it can on Windows and macOS)
    key("Quote", 40, 0x0ad0, 0xDE),
    key("Backquote", 41, 0x60, 0xC0),
    key("Backslash", 43, 0x5c, 0xDC),
    key("Comma", 51, 0x2c, 0xBC),
    key("Period", 52, 0x2e, 0xBE),
    key("Slash", 53, 0x2f, 0xBF),
];

/// The static spelling of a supported code.
pub fn identity(code: &str) -> Option<&'static str> {
    CODES.iter().copied().find(|known| *known == code)
}

/// Whether the key means something else on another layout: the numpad and the
/// function keys do not.
pub fn follows_layout(code: &str) -> bool {
    LAYOUT_KEYS.iter().any(|key| key.code == code)
}

/// The evdev code of a layout-dependent key.
pub fn scancode(code: &str) -> Option<u16> {
    LAYOUT_KEYS
        .iter()
        .find(|key| key.code == code)
        .map(|key| key.scancode)
}

/// A keysym with a lowercase letter folded to the capital global-hotkey looks for.
fn folded(keysym: u32) -> u32 {
    if (0x61..=0x7a).contains(&keysym) {
        keysym - 0x20
    } else {
        keysym
    }
}

/// The Code to hand global-hotkey's X11 backend so that it grabs the physical
/// key `code`, given what the layout puts on that key (`keysyms`: keyvals of
/// the key, level 0 first). The first keysym that global-hotkey knows wins, so
/// the key's own letter or digit does. `None` when the key holds none of them.
pub fn code_for_keysyms(code: &str, keysyms: &[u32]) -> Option<&'static str> {
    if !follows_layout(code) {
        return identity(code);
    }
    keysyms.iter().find_map(|keysym| {
        let wanted = folded(*keysym);
        LAYOUT_KEYS
            .iter()
            .find(|key| key.keysym == wanted)
            .map(|key| key.code)
    })
}

/// The Code that global-hotkey's Windows backend registers as `vk`: the one
/// whose virtual key it is. `None` for a virtual key it has no Code for.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn code_for_vk(vk: u32) -> Option<&'static str> {
    LAYOUT_KEYS
        .iter()
        .find(|key| key.vk == vk)
        .map(|key| key.code)
}

/// A key grabbed under another Code than the one the player pressed, and a
/// note when the layout could not be read.
#[derive(Debug, PartialEq, Eq)]
pub struct Grab {
    pub code: &'static str,
    pub note: Option<&'static str>,
}

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use tauri::{AppHandle, Runtime};

    const UNREAD: &str =
        "Your keyboard layout could not be read: the key is the one labelled as on a US keyboard.";

    /// The keyvals GDK gives each key, in layout group 0, level 0 first.
    /// Read on the main thread, where GDK lives. Empty for a key it cannot
    /// read (no display, a key the layout lacks).
    pub fn keyvals<R: Runtime>(app: &AppHandle<R>, codes: &[String]) -> Vec<Vec<u32>> {
        let (tx, rx) = std::sync::mpsc::channel();
        let wanted = codes.to_vec();
        let sent = app.run_on_main_thread(move || {
            let _ = tx.send(read(&wanted));
        });
        match sent.ok().and_then(|()| rx.recv().ok()) {
            Some(read) => read,
            None => vec![Vec::new(); codes.len()],
        }
    }

    fn read(codes: &[String]) -> Vec<Vec<u32>> {
        let keymap = gdk::Display::default().and_then(|display| gdk::Keymap::for_display(&display));
        codes
            .iter()
            .map(|code| {
                let (Some(keymap), Some(scancode)) = (&keymap, scancode(code)) else {
                    return Vec::new();
                };
                let mut entries = keymap.entries_for_keycode(u32::from(scancode) + 8);
                entries.retain(|(key, keyval)| key.group() == 0 && *keyval != 0);
                entries.sort_by_key(|(key, _)| key.level());
                entries.into_iter().map(|(_, keyval)| keyval).collect()
            })
            .collect()
    }

    /// What to hand global-hotkey for each physical key, on X11.
    pub fn grabs<R: Runtime>(app: &AppHandle<R>, codes: &[String]) -> Vec<Result<Grab, String>> {
        let layout = keyvals(app, codes);
        codes
            .iter()
            .zip(layout)
            .map(|(code, keyvals)| {
                if !follows_layout(code) {
                    return identity(code)
                        .map(|code| Grab { code, note: None })
                        .ok_or_else(|| format!("{code} cannot be a global shortcut"));
                }
                if keyvals.is_empty() {
                    return identity(code)
                        .map(|code| Grab {
                            code,
                            note: Some(UNREAD),
                        })
                        .ok_or_else(|| format!("{code} cannot be a global shortcut"));
                }
                code_for_keysyms(code, &keyvals)
                    .map(|code| Grab { code, note: None })
                    .ok_or_else(|| {
                        "Your layout puts nothing the system can grab on this key.".into()
                    })
            })
            .collect()
    }

    /// The keysym name of what each physical key types at level 0 of the
    /// layout (`a` for the Q key on AZERTY), for the portal's triggers.
    pub fn keysym_names<R: Runtime>(app: &AppHandle<R>, codes: &[String]) -> Vec<Option<String>> {
        keyvals(app, codes)
            .into_iter()
            .map(|keyvals| {
                keyvals
                    .first()
                    .and_then(|keyval| gdk::keys::Key::from(*keyval).name())
                    .map(|name| name.to_string())
            })
            .collect()
    }
}

#[cfg(windows)]
mod platform {
    use super::*;
    use tauri::{AppHandle, Runtime};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{MAPVK_VSC_TO_VK, MapVirtualKeyW};

    /// What to hand global-hotkey for each physical key: the Code whose
    /// virtual key the layout gives the key's scancode. The thread's layout is
    /// the process default, so a layout picked per window is not seen.
    pub fn grabs<R: Runtime>(_app: &AppHandle<R>, codes: &[String]) -> Vec<Result<Grab, String>> {
        codes
            .iter()
            .map(|code| {
                if !follows_layout(code) {
                    return identity(code)
                        .map(|code| Grab { code, note: None })
                        .ok_or_else(|| format!("{code} cannot be a global shortcut"));
                }
                let scancode = scancode(code).map(u32::from).unwrap_or_default();
                // SAFETY: MapVirtualKeyW only reads the keyboard layout
                let vk = unsafe { MapVirtualKeyW(scancode, MAPVK_VSC_TO_VK) };
                code_for_vk(vk)
                    .map(|code| Grab { code, note: None })
                    .ok_or_else(|| {
                        "Your layout puts nothing the system can grab on this key.".into()
                    })
            })
            .collect()
    }
}

#[cfg(not(any(target_os = "linux", windows)))]
mod platform {
    use super::*;
    use tauri::{AppHandle, Runtime};

    /// macOS grabs physical positions: the code is the key.
    pub fn grabs<R: Runtime>(_app: &AppHandle<R>, codes: &[String]) -> Vec<Result<Grab, String>> {
        codes
            .iter()
            .map(|code| {
                identity(code)
                    .map(|code| Grab { code, note: None })
                    .ok_or_else(|| format!("{code} cannot be a global shortcut"))
            })
            .collect()
    }
}

pub use platform::grabs;
#[cfg(target_os = "linux")]
pub use platform::keysym_names;

#[cfg(test)]
mod tests {
    use super::*;

    // Keyvals as GDK lists them (group 0, level 0 first), from xkb's symbols
    // for `fr` (AZERTY): keycode 24 holds [a A], 38 [q Q], 10 [ampersand 1],
    // 47 [m M], 20 [parenright degree bracketright], 15 [underscore 8]
    const A: u32 = 0x61;
    const CAPITAL_A: u32 = 0x41;
    const Q: u32 = 0x71;
    const CAPITAL_Q: u32 = 0x51;
    const M: u32 = 0x6d;
    const CAPITAL_M: u32 = 0x4d;
    const AMPERSAND: u32 = 0x26;
    const ONE: u32 = 0x31;

    #[test]
    fn numbers_the_keys_as_evdev_does() {
        // X keycode = evdev + 8: q is 24, a is 38, 1 is 10 (checked with
        // `xmodmap -pk` under `setxkbmap us`)
        assert_eq!(scancode("KeyQ"), Some(16));
        assert_eq!(scancode("KeyA"), Some(30));
        assert_eq!(scancode("KeyZ"), Some(44));
        assert_eq!(scancode("Digit1"), Some(2));
        assert_eq!(scancode("Digit0"), Some(11));
        assert_eq!(scancode("Backquote"), Some(41));
        assert_eq!(scancode("Backslash"), Some(43));
        assert_eq!(scancode("Numpad1"), None);
    }

    #[test]
    fn keeps_every_scancode_and_every_code_once() {
        for (index, key) in LAYOUT_KEYS.iter().enumerate() {
            for other in &LAYOUT_KEYS[index + 1..] {
                assert_ne!(key.code, other.code);
                assert_ne!(key.scancode, other.scancode, "{}", key.code);
                assert_ne!(key.keysym, other.keysym, "{}", key.code);
                assert_ne!(key.vk, other.vk, "{}", key.code);
            }
            assert!(CODES.contains(&key.code), "{}", key.code);
        }
    }

    #[test]
    fn grabs_the_same_key_on_qwerty() {
        assert_eq!(code_for_keysyms("KeyQ", &[Q, CAPITAL_Q]), Some("KeyQ"));
        assert_eq!(code_for_keysyms("Digit1", &[ONE, 0x21]), Some("Digit1"));
        assert_eq!(
            code_for_keysyms("Semicolon", &[0x3b, 0x3a]),
            Some("Semicolon")
        );
    }

    #[test]
    fn grabs_the_physical_key_by_what_azerty_prints_on_it() {
        // The physical Q key (keycode 24) prints a on AZERTY: grab "KeyA"
        assert_eq!(code_for_keysyms("KeyQ", &[A, CAPITAL_A]), Some("KeyA"));
        // The physical A key (keycode 38) prints q
        assert_eq!(code_for_keysyms("KeyA", &[Q, CAPITAL_Q]), Some("KeyQ"));
        // The physical semicolon key (keycode 47) prints m
        assert_eq!(code_for_keysyms("Semicolon", &[M, CAPITAL_M]), Some("KeyM"));
        // Level 0 alone is enough: a key listing only its lowercase letter
        assert_eq!(code_for_keysyms("KeyQ", &[A]), Some("KeyA"));
        // The digit row prints & and the digit on level 1: the digit matches
        assert_eq!(
            code_for_keysyms("Digit1", &[AMPERSAND, ONE]),
            Some("Digit1")
        );
    }

    #[test]
    fn is_the_identity_for_keys_a_layout_does_not_move() {
        for code in ["Numpad1", "NumpadAdd", "F1", "F13", "F24"] {
            assert_eq!(code_for_keysyms(code, &[0x41]), Some(code), "{code}");
            assert_eq!(code_for_keysyms(code, &[]), Some(code), "{code}");
        }
        assert_eq!(code_for_keysyms("Tab", &[]), None);
    }

    #[test]
    fn grabs_nothing_for_a_key_that_prints_nothing_it_knows() {
        // A key whose keysyms are accents and dead keys only
        assert_eq!(code_for_keysyms("Backquote", &[0xfe50, 0xfe51]), None);
        assert_eq!(code_for_keysyms("KeyQ", &[]), None);
    }

    #[test]
    fn maps_a_windows_virtual_key_back_to_the_code_global_hotkey_registers() {
        // VK_A on AZERTY is at the physical Q key's scancode (16)
        assert_eq!(code_for_vk(0x41), Some("KeyA"));
        assert_eq!(code_for_vk(0x31), Some("Digit1"));
        assert_eq!(code_for_vk(0xBA), Some("Semicolon"));
        assert_eq!(code_for_vk(0xDE), Some("Quote"));
        assert_eq!(code_for_vk(0x08), None);
    }
}

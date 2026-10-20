// What the page may ask to grab globally, checked here and not only on the
// page: a chord (`Control+Alt+KeyQ`: modifiers in the page's order, then a
// `KeyboardEvent.code`), the action it steps (`advance:hookshot`) and the
// names the desktop's portal knows them by. Pure functions, no system call.
//
// The floor below is the one rule that lives in Rust on purpose. Whatever the
// page sends, even a compromised one, the app never grabs a bare or
// Shift-only typing key in every app, which would make it a keylogger.

// The portal's names are read by the Linux backend alone (the tests read them
// everywhere).
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

/// The modifiers of a chord, in the page's spelling order.
const MODIFIERS: [&str; 4] = ["Control", "Alt", "Shift", "Meta"];

/// The most bindings one apply may carry: the page has fewer than 150
/// controls, two directions each.
pub const MAX_BINDINGS: usize = 256;

/// The keys that can be grabbed: the same list as the page's
/// `desktop/globalKeymap.ts`. `Intl*` codes are left out (global-hotkey 0.8
/// cannot register them), as is `NumpadEqual` (it registers the letter E on
/// Windows) and every key that keeps its own job (Tab, Enter, arrows...).
pub const CODES: &[&str] = &[
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyD",
    "KeyE",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyM",
    "KeyN",
    "KeyO",
    "KeyP",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyU",
    "KeyV",
    "KeyW",
    "KeyX",
    "KeyY",
    "KeyZ",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Minus",
    "Equal",
    "BracketLeft",
    "BracketRight",
    "Backslash",
    "Semicolon",
    "Quote",
    "Backquote",
    "Comma",
    "Period",
    "Slash",
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadAdd",
    "NumpadSubtract",
    "NumpadMultiply",
    "NumpadDivide",
    "NumpadDecimal",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
    "F13",
    "F14",
    "F15",
    "F16",
    "F17",
    "F18",
    "F19",
    "F20",
    "F21",
    "F22",
    "F23",
    "F24",
];

/// A chord taken apart.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Chord {
    pub control: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
    pub code: String,
}

/// Whether `code` is a key that can be grabbed.
pub fn supported(code: &str) -> bool {
    CODES.contains(&code)
}

/// Keys that type a character (or F1 to F12, which programs claim): the floor
/// asks a Control, Alt or Meta with them. The numpad and F13 to F24 type
/// nothing and are free.
fn types_a_character(code: &str) -> bool {
    if code.starts_with("Numpad") {
        return false;
    }
    match code.strip_prefix('F').and_then(|n| n.parse::<u8>().ok()) {
        Some(n) => n <= 12,
        None => true,
    }
}

/// A chord's parts, or why it cannot be grabbed: written wrongly, a key that
/// cannot be grabbed, or under the floor.
pub fn parse(chord: &str) -> Result<Chord, &'static str> {
    let mut parts: Vec<&str> = chord.split('+').collect();
    let code = parts.pop().unwrap_or_default();
    let mut held = [false; 4];
    let mut previous = None;
    for part in parts {
        let index = MODIFIERS
            .iter()
            .position(|modifier| *modifier == part)
            .ok_or("not a chord")?;
        if previous.is_some_and(|before| index <= before) {
            return Err("not a chord");
        }
        previous = Some(index);
        held[index] = true;
    }
    if !supported(code) {
        return Err("not a key that can be a global shortcut");
    }
    let [control, alt, shift, meta] = held;
    if types_a_character(code) && !(control || alt || meta) {
        return Err(
            "needs Ctrl, Alt or Win/Cmd with it, or it would stop you typing it everywhere",
        );
    }
    Ok(Chord {
        alt,
        code: code.to_owned(),
        control,
        meta,
        shift,
    })
}

/// Whether `action` is a tracker action: `advance:hookshot`, `back:chest3`.
/// The page's `ActionId` shape, without its list of controls.
pub fn valid_action(action: &str) -> bool {
    let Some((direction, control)) = action.split_once(':') else {
        return false;
    };
    let letters = control.trim_end_matches(|c: char| c.is_ascii_digit());
    matches!(direction, "advance" | "back")
        && !letters.is_empty()
        && letters.chars().all(|c| c.is_ascii_lowercase())
}

/// The accelerator global-hotkey parses, with `code` as the key to grab
/// (translated for the layout by `keys`). `Meta` is its `Super`.
pub fn accelerator(chord: &Chord, code: &str) -> String {
    let mut parts = Vec::with_capacity(5);
    if chord.control {
        parts.push("Control");
    }
    if chord.alt {
        parts.push("Alt");
    }
    if chord.shift {
        parts.push("Shift");
    }
    if chord.meta {
        parts.push("Super");
    }
    parts.push(code);
    parts.join("+")
}

/// The portal's id for an action. Hyprland's `global` dispatcher splits
/// `appid:id` on the colon, so the action's own colon becomes a dot.
pub fn portal_id(action: &str) -> String {
    action.replacen(':', ".", 1)
}

/// The action behind a portal id, if it is one of ours.
pub fn action_of_portal_id(id: &str) -> Option<String> {
    let action = id.replacen('.', ":", 1);
    valid_action(&action).then_some(action)
}

/// The keysym a key without a layout name is called by in the shortcuts
/// specification: the numpad and function keys, the same on every layout.
fn fixed_keysym(code: &str) -> Option<String> {
    if let Some(digit) = code.strip_prefix("Numpad").filter(|d| d.len() == 1) {
        return Some(format!("KP_{digit}"));
    }
    match code {
        "NumpadAdd" => Some("KP_Add".into()),
        "NumpadSubtract" => Some("KP_Subtract".into()),
        "NumpadMultiply" => Some("KP_Multiply".into()),
        "NumpadDivide" => Some("KP_Divide".into()),
        "NumpadDecimal" => Some("KP_Decimal".into()),
        _ if code.starts_with('F') && code[1..].chars().all(|c| c.is_ascii_digit()) => {
            Some(code.to_owned())
        }
        _ => None,
    }
}

/// The preferred trigger of a chord, in the XDG shortcuts specification's
/// words (`CTRL+ALT+a`): its modifiers, then the keysym name of the physical
/// key. `layout_keysym` is that name from the layout, used for the keys that
/// differ between layouts; `None` when there is none, and then no trigger is
/// proposed (the desktop asks).
pub fn portal_trigger(chord: &Chord, layout_keysym: Option<&str>) -> Option<String> {
    let key = fixed_keysym(&chord.code).or_else(|| layout_keysym.map(str::to_owned))?;
    let mut parts = Vec::with_capacity(5);
    if chord.control {
        parts.push("CTRL".to_owned());
    }
    if chord.alt {
        parts.push("ALT".to_owned());
    }
    if chord.shift {
        parts.push("SHIFT".to_owned());
    }
    if chord.meta {
        parts.push("LOGO".to_owned());
    }
    parts.push(key);
    Some(parts.join("+"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_chord_in_the_pages_order() {
        let chord = parse("Alt+Shift+KeyQ").unwrap();
        assert_eq!(
            chord,
            Chord {
                alt: true,
                code: "KeyQ".into(),
                control: false,
                meta: false,
                shift: true
            }
        );
        assert!(parse("Control+Alt+Shift+Meta+Digit1").unwrap().meta);
    }

    #[test]
    fn refuses_what_the_page_never_writes() {
        for chord in [
            "",
            "Alt+",
            "Shift+Alt+KeyQ", // out of order
            "Alt+Alt+KeyQ",
            "Hyper+KeyQ",
            "Alt+keyq",
            "Alt+KeyQ+KeyW",
        ] {
            assert!(parse(chord).is_err(), "{chord}");
        }
    }

    #[test]
    fn refuses_keys_that_cannot_be_grabbed() {
        for code in [
            "IntlRo",
            "IntlYen",
            "IntlBackslash",
            "NumpadEqual",
            "Tab",
            "Enter",
            "Space",
            "Escape",
            "ArrowUp",
            "F25",
            "F0",
        ] {
            assert!(parse(&format!("Control+Alt+{code}")).is_err(), "{code}");
        }
        for code in ["F17", "F24", "NumpadDecimal", "Quote", "Backquote"] {
            assert!(parse(&format!("Control+{code}")).is_ok(), "{code}");
        }
    }

    #[test]
    fn the_floor_keeps_typing_keys_out_of_bare_and_shift_only_grabs() {
        assert!(parse("KeyQ").is_err());
        assert!(parse("Shift+KeyQ").is_err());
        assert!(parse("Digit1").is_err());
        assert!(parse("F5").is_err());
        assert!(parse("Shift+Semicolon").is_err());
        assert!(parse("Control+KeyQ").is_ok());
        assert!(parse("Alt+KeyQ").is_ok());
        assert!(parse("Meta+KeyQ").is_ok());
        assert!(parse("Control+Alt+KeyQ").is_ok());
    }

    #[test]
    fn the_floor_leaves_the_numpad_and_the_high_function_keys_free() {
        for chord in ["Numpad1", "NumpadAdd", "Shift+Numpad7", "F13", "Shift+F24"] {
            assert!(parse(chord).is_ok(), "{chord}");
        }
    }

    #[test]
    fn checks_an_action_by_its_shape() {
        for action in ["advance:hookshot", "back:chest3", "advance:smallkey12"] {
            assert!(valid_action(action), "{action}");
        }
        for action in [
            "",
            "advance",
            "advance:",
            "advance:3",
            "forward:hookshot",
            "x:hookshot",
            "Advance:hookshot",
            "advance:Hookshot",
            "advance:hook-shot",
            "advance:chest3x",
            "advance:hookshot:1",
            "advance: hookshot",
        ] {
            assert!(!valid_action(action), "{action}");
        }
    }

    #[test]
    fn spells_the_accelerator_global_hotkey_reads() {
        let chord = parse("Control+Alt+Shift+Meta+KeyQ").unwrap();
        assert_eq!(accelerator(&chord, "KeyA"), "Control+Alt+Shift+Super+KeyA");
        assert_eq!(
            accelerator(&parse("Alt+Digit1").unwrap(), "Digit1"),
            "Alt+Digit1"
        );
    }

    #[test]
    fn replaces_the_colon_for_the_portal_and_back() {
        assert_eq!(portal_id("advance:hookshot"), "advance.hookshot");
        assert_eq!(
            action_of_portal_id("advance.hookshot").as_deref(),
            Some("advance:hookshot")
        );
        assert_eq!(
            action_of_portal_id("back.chest3").as_deref(),
            Some("back:chest3")
        );
        assert_eq!(action_of_portal_id("hookshot"), None);
        assert_eq!(action_of_portal_id("other.thing!"), None);
    }

    #[test]
    fn proposes_the_trigger_with_the_layouts_name_for_the_key() {
        // KeyQ is where the layout puts "a": AZERTY
        let chord = parse("Control+Alt+Shift+KeyQ").unwrap();
        assert_eq!(
            portal_trigger(&chord, Some("a")).as_deref(),
            Some("CTRL+ALT+SHIFT+a")
        );
        assert_eq!(portal_trigger(&chord, None), None);
        let meta = parse("Meta+KeyQ").unwrap();
        assert_eq!(portal_trigger(&meta, Some("q")).as_deref(), Some("LOGO+q"));
    }

    #[test]
    fn names_the_numpad_and_function_keys_the_same_on_every_layout() {
        for (chord, trigger) in [
            ("Numpad1", "KP_1"),
            ("Shift+NumpadAdd", "SHIFT+KP_Add"),
            ("NumpadDecimal", "KP_Decimal"),
            ("F13", "F13"),
            ("Control+F5", "CTRL+F5"),
        ] {
            // The layout's own name must not win over the fixed one
            assert_eq!(
                portal_trigger(&parse(chord).unwrap(), Some("zzz")).as_deref(),
                Some(trigger),
                "{chord}"
            );
        }
    }
}

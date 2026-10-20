// The system's own hotkeys (Windows RegisterHotKey, macOS Carbon, X11
// XGrabKey) through tauri-plugin-global-shortcut, which wraps global-hotkey.
//
// The plugin starts lazily, at the first binding. Starting it creates the
// platform manager: on X11 a thread that polls every 50 ms, on Windows a
// hidden message window. A player who never turns global shortcuts on pays
// none of that. Once added it stays until quit (a removed plugin would not
// drop its managed state).
//
// Nothing is unregistered at quit, on purpose: unregistering blocks on the
// main thread, which is running the exit. The system frees the grabs with
// the process (X11 closes the connection, Windows ties hotkeys to the
// plugin's window, Carbon to the process).

use std::collections::BTreeMap;
use std::str::FromStr;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::emit_step;

/// Why a key could not be registered.
#[derive(Debug, PartialEq, Eq)]
pub enum Failure {
    /// Another app, or the system, holds the key
    Taken(String),
    /// The key cannot be registered at all
    Invalid(String),
}

/// What differs between the keys registered and the keys wanted, by action.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Plan {
    pub unregister: Vec<String>,
    pub register: Vec<String>,
}

/// The accelerators to drop and to add: an action whose key changed is both.
/// Unregistering comes first in the caller, so two actions swapping keys work.
pub fn plan(current: &BTreeMap<String, String>, desired: &BTreeMap<String, String>) -> Plan {
    Plan {
        register: desired
            .iter()
            .filter(|(action, accelerator)| current.get(*action) != Some(*accelerator))
            .map(|(action, _)| action.clone())
            .collect(),
        unregister: current
            .iter()
            .filter(|(action, accelerator)| desired.get(*action) != Some(*accelerator))
            .map(|(action, _)| action.clone())
            .collect(),
    }
}

/// Reads what the platform said about a refused registration. global-hotkey
/// words it: "HotKey already registered" (X11 says so for a key another
/// client grabbed), "Unable to register hotkey" (Windows and macOS, when the
/// system refuses). A key with no keycode on this layout is not "taken".
pub fn classify(message: &str) -> Failure {
    let unfindable =
        message.contains("Unable to find keycode") || message.contains("Unknown scancode");
    if unfindable {
        // F13 to F23 on most X11 layouts: they type XF86 keysyms instead
        Failure::Invalid("Your keyboard layout has no such key the system can grab.".to_owned())
    } else if message.starts_with("HotKey already registered")
        || message.starts_with("Unable to register hotkey")
    {
        Failure::Taken(message.to_owned())
    } else {
        Failure::Invalid(message.to_owned())
    }
}

/// Takes the keys of the actions to release out of `current`, in the plan's
/// order, so they can be released in one request.
fn take_released(current: &mut BTreeMap<String, String>, actions: &[String]) -> Vec<String> {
    actions
        .iter()
        .filter_map(|action| current.remove(action))
        .collect()
}

#[derive(Default)]
pub struct Hotkeys {
    started: bool,
    /// What is registered now: action → accelerator
    current: BTreeMap<String, String>,
}

impl Hotkeys {
    /// Adds the plugin on the main thread (macOS creates its manager there).
    fn start(&mut self, app: &AppHandle) -> Result<(), String> {
        if self.started {
            return Ok(());
        }
        let (tx, rx) = std::sync::mpsc::channel();
        let handle = app.clone();
        app.run_on_main_thread(move || {
            let added = handle.plugin(tauri_plugin_global_shortcut::Builder::new().build());
            let _ = tx.send(added.map_err(|error| error.to_string()));
        })
        .map_err(|error| error.to_string())?;
        rx.recv().map_err(|error| error.to_string())??;
        self.started = true;
        Ok(())
    }

    /// Makes the registered keys the wanted ones and says how each fared.
    /// Blocking: every registration waits for the main thread, so this runs
    /// off it (`spawn_blocking`), never from it.
    pub fn apply(
        &mut self,
        app: &AppHandle,
        desired: &BTreeMap<String, String>,
    ) -> Result<BTreeMap<String, Result<(), Failure>>, String> {
        if desired.is_empty() && !self.started {
            return Ok(BTreeMap::new());
        }
        self.start(app)?;
        let plan = plan(&self.current, desired);
        let shortcuts = app.global_shortcut();
        // One request for every key: on X11 each one waits for the X thread's
        // 50 ms loop, so one by one a long set stayed grabbed for seconds, and
        // the key pressed to capture a new one was eaten
        let released: Vec<Shortcut> = take_released(&mut self.current, &plan.unregister)
            .iter()
            .filter_map(|accelerator| Shortcut::from_str(accelerator).ok())
            .collect();
        if !released.is_empty() {
            if let Err(error) = shortcuts.unregister_multiple(released) {
                eprintln!("alltp-tracker: could not release the shortcuts: {error}");
            }
            flush(app);
        }
        let mut outcome = BTreeMap::new();
        for action in desired.keys() {
            if !plan.register.contains(action) {
                outcome.insert(action.clone(), Ok(()));
            }
        }
        for action in &plan.register {
            let accelerator = &desired[action];
            let result = Shortcut::from_str(accelerator)
                .map_err(|error| Failure::Invalid(error.to_string()))
                .and_then(|shortcut| {
                    let step = action.clone();
                    shortcuts
                        .on_shortcut(shortcut, move |app, _, event| {
                            if event.state == ShortcutState::Pressed {
                                emit_step(app, &step);
                            }
                        })
                        .map_err(|error| classify(&error.to_string()))
                });
            if result.is_ok() {
                self.current.insert(action.clone(), accelerator.clone());
            }
            outcome.insert(action.clone(), result);
        }
        // A refused grab can leave half of itself behind: global-hotkey grabs
        // the key's lock variants one at a time, and when a later one is
        // refused it buffers the ungrab of the first, which nothing sends if
        // this was the last registration
        if outcome.values().any(Result::is_err) {
            flush(app);
        }
        Ok(outcome)
    }

    /// Releases every key, for a page that is going away.
    pub fn clear(&mut self, app: &AppHandle) {
        if self.started && !self.current.is_empty() {
            // Our own keys, not `unregister_all`: that would release the flush
            // key too (see `flush`)
            let shortcuts: Vec<Shortcut> = self
                .current
                .values()
                .filter_map(|accelerator| Shortcut::from_str(accelerator).ok())
                .collect();
            if let Err(error) = app.global_shortcut().unregister_multiple(shortcuts) {
                eprintln!("alltp-tracker: could not release the shortcuts: {error}");
            }
            self.current.clear();
            flush(app);
        }
    }
}

/// A key nobody presses, registered once and never released: see `flush`.
#[cfg(target_os = "linux")]
const FLUSH_KEY: &str = "Control+Alt+Shift+Super+Escape";

/// X11: makes the grabs released so far really released. global-hotkey's X
/// thread buffers its "ungrab" requests and sends them with the next request
/// that waits for an answer, which only a registration is. Without one, the
/// last keys released stay grabbed (found on the bench: switching to another
/// game left one key of the two swallowed in every app). Registering the
/// flush key does it, whether it succeeds or is refused as already registered:
/// the thread flushes before it looks.
#[cfg(target_os = "linux")]
fn flush(app: &AppHandle) {
    if let Ok(shortcut) = Shortcut::from_str(FLUSH_KEY) {
        let _ = app.global_shortcut().on_shortcut(shortcut, |_, _, _| {});
    }
}

/// Windows and macOS release a key at once.
#[cfg(not(target_os = "linux"))]
fn flush(_app: &AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    fn map(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(action, key)| ((*action).to_owned(), (*key).to_owned()))
            .collect()
    }

    #[test]
    fn releases_every_key_of_the_plan_in_one_list() {
        let mut current = map(&[
            ("advance:bow", "Alt+KeyQ"),
            ("back:bow", "Alt+KeyW"),
            ("advance:hookshot", "Alt+KeyE"),
        ]);
        let released = take_released(
            &mut current,
            &["advance:bow".to_owned(), "advance:hookshot".to_owned()],
        );
        assert_eq!(released, ["Alt+KeyQ", "Alt+KeyE"]);
        assert_eq!(current, map(&[("back:bow", "Alt+KeyW")]));
        assert!(take_released(&mut current, &["back:nothing".to_owned()]).is_empty());
    }

    #[test]
    fn registers_what_is_new_and_drops_what_went() {
        let current = map(&[("advance:bow", "Alt+KeyQ"), ("back:bow", "Alt+KeyW")]);
        let desired = map(&[
            ("advance:bow", "Alt+KeyQ"),
            ("advance:hookshot", "Alt+KeyE"),
        ]);
        assert_eq!(
            plan(&current, &desired),
            Plan {
                register: vec!["advance:hookshot".into()],
                unregister: vec!["back:bow".into()],
            }
        );
    }

    #[test]
    fn a_changed_key_is_dropped_then_registered() {
        let current = map(&[("advance:bow", "Alt+KeyQ")]);
        let desired = map(&[("advance:bow", "Alt+KeyW")]);
        assert_eq!(
            plan(&current, &desired),
            Plan {
                register: vec!["advance:bow".into()],
                unregister: vec!["advance:bow".into()],
            }
        );
    }

    #[test]
    fn two_actions_swapping_keys_both_move() {
        let current = map(&[
            ("advance:bow", "Alt+KeyQ"),
            ("advance:hookshot", "Alt+KeyW"),
        ]);
        let desired = map(&[
            ("advance:bow", "Alt+KeyW"),
            ("advance:hookshot", "Alt+KeyQ"),
        ]);
        let plan = plan(&current, &desired);
        assert_eq!(plan.unregister.len(), 2);
        assert_eq!(plan.register.len(), 2);
    }

    #[test]
    fn nothing_to_do_when_nothing_changed() {
        let keys = map(&[("advance:bow", "Alt+KeyQ")]);
        assert_eq!(plan(&keys, &keys), Plan::default());
        assert_eq!(plan(&BTreeMap::new(), &BTreeMap::new()), Plan::default());
    }

    #[test]
    fn reads_a_held_key_as_taken() {
        assert!(matches!(
            classify("HotKey already registered: HotKey { mods: CONTROL }"),
            Failure::Taken(_)
        ));
        assert!(matches!(
            classify("Unable to register hotkey: Error code: 1409"),
            Failure::Taken(_)
        ));
    }

    #[test]
    fn says_so_when_the_layout_has_no_such_key() {
        assert_eq!(
            classify("Unable to register hotkey: Unable to find keycode for key: F13"),
            Failure::Invalid("Your keyboard layout has no such key the system can grab.".into())
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn the_flush_key_is_one_global_hotkey_can_register() {
        assert!(Shortcut::from_str(FLUSH_KEY).is_ok());
        // Nobody binds it: it is not a key the page can send
        assert!(super::super::chord::parse("Control+Alt+Shift+Meta+Escape").is_err());
    }

    #[test]
    fn reads_any_other_refusal_as_invalid() {
        for message in [
            "Unable to register hotkey: Unable to find keycode for key: KeyQ",
            "Unable to register hotkey: Unknown scancode for key: F1",
            "Couldn't recognize \"Foo\" as a valid HotKey Code",
            "something else",
        ] {
            assert!(
                matches!(classify(message), Failure::Invalid(_)),
                "{message}"
            );
        }
    }
}

// Global shortcuts: tracker actions bound to keys that work while the
// emulator has the focus. The page asks for a set of bindings; this side
// registers them with the system and turns each press into a `global-step`
// event, which the page runs exactly as a key press in its window.
//
// Three mechanisms, picked once per process (`detect.rs`):
//   hotkeys  the system's own hotkeys: Windows, macOS, X11 (`hotkeys.rs`)
//   portal   the desktop's GlobalShortcuts portal: Wayland (`portal.rs`)
//   command  `alltp-tracker --step <action>`, bound in the window manager
//            (`../cli.rs`); it works under any mechanism
//
// Everything the page sends is checked here again (`chord.rs`): the page may
// be compromised, and a global grab must never reach a typing key.

mod chord;
mod detect;
mod hotkeys;
mod keys;
#[cfg(target_os = "linux")]
mod portal;

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, State, Webview};

use detect::{Env, Kind, Os};

/// One global binding the page asks for.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    action: String,
    chord: String,
    description: String,
}

/// What the app can do, sent once per page load.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mechanism {
    kind: Kind,
    os: &'static str,
    /// `x11` or `wayland` on Linux
    session: Option<&'static str>,
    portal_version: Option<u32>,
    /// Whether the desktop can show its own shortcut settings (portal v2)
    configurable: bool,
    /// The executable to put in a window manager's binding
    command: String,
    /// Why the portal gave way to the command line
    reason: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Active,
    Invalid,
    Taken,
    Unbound,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Idle,
    Active,
    Partial,
    Refused,
    Unavailable,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingReport {
    action: String,
    status: Status,
    /// The desktop's own description of the key (portal)
    trigger: Option<String>,
    message: Option<String>,
}

impl BindingReport {
    fn new(action: &str, status: Status, message: Option<String>) -> Self {
        BindingReport {
            action: action.to_owned(),
            message,
            status,
            trigger: None,
        }
    }

    fn invalid(action: &str, message: impl Into<String>) -> Self {
        Self::new(action, Status::Invalid, Some(message.into()))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    state: Phase,
    mechanism: Mechanism,
    bindings: Vec<BindingReport>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ready {
    mechanism: Mechanism,
    pending: Vec<String>,
}

#[derive(Clone, Serialize)]
struct StepPayload {
    action: String,
}

/// A key press, for the page. Releases are not events. The key itself is
/// never logged.
pub fn emit_step(app: &AppHandle, action: &str) {
    let _ = app.emit(
        "global-step",
        StepPayload {
            action: action.to_owned(),
        },
    );
}

/// What a set of reports adds up to.
fn state_of(bindings: &[BindingReport]) -> Phase {
    let active = bindings
        .iter()
        .filter(|binding| binding.status == Status::Active)
        .count();
    if bindings.is_empty() {
        Phase::Idle
    } else if active == bindings.len() {
        Phase::Active
    } else if active > 0 {
        Phase::Partial
    } else {
        Phase::Unavailable
    }
}

/// Whether `action` is a tracker action (`advance:hookshot`).
pub fn is_action(action: &str) -> bool {
    chord::valid_action(action)
}

/// A binding that passed the checks.
struct Valid {
    action: String,
    chord: chord::Chord,
    /// Shown by the desktop next to the shortcut (portal)
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    description: String,
}

/// The description the desktop shows next to a shortcut: one line, bounded.
fn clean_description(text: &str) -> String {
    text.chars().filter(|c| !c.is_control()).take(120).collect()
}

/// Checks each binding: the action's shape, the chord and the floor, no
/// action twice. The ones that fail are reported `invalid`.
fn validate(bindings: Vec<Binding>) -> (Vec<Valid>, Vec<BindingReport>) {
    let mut valid: Vec<Valid> = Vec::new();
    let mut refused = Vec::new();
    for binding in bindings {
        if !chord::valid_action(&binding.action) {
            refused.push(BindingReport::invalid(
                &binding.action,
                "not a tracker action",
            ));
        } else if valid.iter().any(|known| known.action == binding.action) {
            refused.push(BindingReport::invalid(&binding.action, "listed twice"));
        } else {
            match chord::parse(&binding.chord) {
                Ok(parsed) => valid.push(Valid {
                    action: binding.action,
                    chord: parsed,
                    description: clean_description(&binding.description),
                }),
                Err(why) => refused.push(BindingReport::invalid(&binding.action, why)),
            }
        }
    }
    (valid, refused)
}

/// The executable a window manager's binding should run: the AppImage when
/// the app runs from one (its own path changes on every launch), else this
/// executable.
fn command_path() -> String {
    std::env::var("APPIMAGE")
        .ok()
        .filter(|path| !path.is_empty())
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .map(|path| path.display().to_string())
        })
        .unwrap_or_else(|| "alltp-tracker".to_owned())
}

struct Inner {
    hotkeys: Arc<Mutex<hotkeys::Hotkeys>>,
    #[cfg(target_os = "linux")]
    portal: Option<portal::Portal>,
}

impl Inner {
    /// Works out the mechanism (probing the portal on Wayland).
    async fn detect(&mut self, app: &AppHandle) -> Mechanism {
        let os = Os::current();
        let env = Env::current();
        let command = command_path();
        #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
        let mut portal_version = None;
        let mut reason = None;
        #[cfg(target_os = "linux")]
        {
            let away = matches!(env.forced.as_deref(), Some("hotkeys" | "command"));
            if (env.is_wayland() || env.forced.as_deref() == Some("portal")) && !away {
                self.portal = portal::Portal::probe(app, &command).await;
                portal_version = self.portal.as_ref().map(portal::Portal::version);
            }
        }
        #[cfg(not(target_os = "linux"))]
        let _ = app;
        let mut kind = detect::pick(os, &env, portal_version);
        if kind == Kind::Portal && portal_version.is_none() {
            kind = Kind::Command;
            reason = Some("the desktop has no global shortcut service".to_owned());
        }
        Mechanism {
            command,
            configurable: kind == Kind::Portal && portal_version.is_some_and(|v| v >= 2),
            kind,
            os: os.name(),
            portal_version,
            reason,
            session: (os == Os::Linux).then(|| if env.is_wayland() { "wayland" } else { "x11" }),
        }
    }
}

/// What a request from a page that has gone is answered with.
const GONE: &str = "the page that asked has gone";

/// The state the commands share. One lock serializes every apply: a portal
/// bind may wait minutes on the player.
pub struct GlobalShortcuts {
    inner: tokio::sync::Mutex<Inner>,
    /// What the system can do, worked out once. Apart from `inner`, so a
    /// page that loads while the player is deciding on a portal's dialog
    /// still learns it.
    mechanism: Mutex<Option<Mechanism>>,
    /// Counts the pages that went away. A request from a page that has gone
    /// (one queued behind another, or a portal bind waiting on the player) is
    /// dropped: the next page must not queue behind a dialog nobody reads.
    page: tokio::sync::watch::Sender<u64>,
    ready: AtomicBool,
    pending: Mutex<VecDeque<String>>,
}

impl GlobalShortcuts {
    /// `first`: the steps the app was started with (`--step`), to run once the
    /// page has loaded.
    pub fn new(first: Vec<String>) -> Self {
        let state = GlobalShortcuts {
            inner: tokio::sync::Mutex::new(Inner {
                hotkeys: Arc::new(Mutex::new(hotkeys::Hotkeys::default())),
                #[cfg(target_os = "linux")]
                portal: None,
            }),
            page: tokio::sync::watch::channel(0).0,
            mechanism: Mutex::new(None),
            pending: Mutex::new(VecDeque::new()),
            ready: AtomicBool::new(false),
        };
        state.queue(first);
        state
    }

    /// Whether the page is listening for `global-step` events.
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }

    /// Keeps steps for a page that is not listening yet.
    pub fn queue(&self, steps: Vec<String>) {
        crate::cli::push_bounded(&mut self.pending.lock().unwrap(), steps);
    }

    /// The mechanism, worked out on first use under the state's lock.
    async fn mechanism_in(&self, app: &AppHandle, inner: &mut Inner) -> Mechanism {
        let known = self.mechanism.lock().unwrap().clone();
        if let Some(mechanism) = known {
            return mechanism;
        }
        let mechanism = inner.detect(app).await;
        *self.mechanism.lock().unwrap() = Some(mechanism.clone());
        mechanism
    }

    fn drain(&self) -> Vec<String> {
        self.pending.lock().unwrap().drain(..).collect()
    }

    /// Releases every key and closes the portal session: the page that asked
    /// for them is going away.
    async fn clear(&self, app: &AppHandle) {
        self.page.send_modify(|pages| *pages += 1);
        #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
        let mut inner = self.inner.lock().await;
        let hotkeys = inner.hotkeys.clone();
        let handle = app.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            hotkeys.lock().unwrap().clear(&handle);
        })
        .await;
        #[cfg(target_os = "linux")]
        if let Some(portal) = inner.portal.as_mut() {
            portal.close().await;
        }
    }
}

/// Starts a page load: its keys are gone with it. A reload (or a switch to
/// another game, which reloads) must not leave the old page's keys grabbed.
/// Spawned, never inline: the hook may run on the main thread, which the
/// plugin's registrations wait for.
pub fn on_page_load(webview: &Webview, payload: &tauri::webview::PageLoadPayload<'_>) {
    if webview.label() != "main" || payload.event() != PageLoadEvent::Started {
        return;
    }
    let app = webview.app_handle().clone();
    app.state::<GlobalShortcuts>()
        .ready
        .store(false, Ordering::SeqCst);
    tauri::async_runtime::spawn(async move {
        app.state::<GlobalShortcuts>().clear(&app).await;
    });
}

/// The page is listening: tells it what this system can do and hands over the
/// steps that came before it (a `--step` the app was started with).
#[tauri::command]
pub async fn global_shortcuts_ready(
    app: AppHandle,
    state: State<'_, GlobalShortcuts>,
) -> Result<Ready, String> {
    let known = state.mechanism.lock().unwrap().clone();
    let mechanism = match known {
        Some(mechanism) => mechanism,
        None => {
            let mut inner = state.inner.lock().await;
            state.mechanism_in(&app, &mut inner).await
        }
    };
    state.ready.store(true, Ordering::SeqCst);
    Ok(Ready {
        mechanism,
        pending: state.drain(),
    })
}

/// Makes the registered shortcuts equal to `bindings`. An empty set releases
/// everything. `rebind` asks the portal for a new session, which asks the
/// player again. One taken key never hides the others: each binding has its
/// own report.
#[tauri::command]
pub async fn global_shortcuts_apply(
    app: AppHandle,
    state: State<'_, GlobalShortcuts>,
    bindings: Vec<Binding>,
    rebind: bool,
) -> Result<Report, String> {
    if bindings.len() > chord::MAX_BINDINGS {
        return Err(format!("more than {} shortcuts", chord::MAX_BINDINGS));
    }
    let order: Vec<String> = bindings.iter().map(|b| b.action.clone()).collect();
    let mut page = state.page.subscribe();
    let asked_by = *page.borrow_and_update();
    // How many, never which keys: the log stays free of what the player types
    eprintln!(
        "alltp-tracker: global shortcuts: {} binding(s) asked{}",
        order.len(),
        if rebind {
            ", asking the desktop again"
        } else {
            ""
        }
    );
    #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
    let mut inner = state.inner.lock().await;
    if *page.borrow() != asked_by {
        return Err(GONE.into());
    }
    #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
    let mut mechanism = state.mechanism_in(&app, &mut inner).await;
    let (valid, mut reports) = validate(bindings);
    #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
    let mut forced_state = None;

    match mechanism.kind {
        Kind::Command => {}
        Kind::Hotkeys => {
            let hotkeys = inner.hotkeys.clone();
            let handle = app.clone();
            let mut done = tauri::async_runtime::spawn_blocking(move || {
                apply_hotkeys(&handle, &hotkeys, valid)
            })
            .await
            .map_err(|error| error.to_string())??;
            reports.append(&mut done);
        }
        #[cfg(target_os = "linux")]
        Kind::Portal => {
            let Some(portal) = inner.portal.as_mut() else {
                return Err("the desktop's shortcut service is gone".into());
            };
            let outcome = tokio::select! {
                outcome = portal.apply(&app, valid, rebind) => outcome,
                _ = page.changed() => return Err(GONE.into()),
            };
            reports.extend(outcome.bindings);
            forced_state = outcome.state;
            if let Some(reason) = outcome.downgrade {
                // Not the desktop's fault the player can fix: the command line
                inner.portal = None;
                mechanism.kind = Kind::Command;
                mechanism.configurable = false;
                mechanism.reason = Some(reason);
                *state.mechanism.lock().unwrap() = Some(mechanism.clone());
            }
        }
        #[cfg(not(target_os = "linux"))]
        Kind::Portal => {
            let _ = rebind;
        }
    }

    reports.sort_by_key(|report| {
        order
            .iter()
            .position(|action| *action == report.action)
            .unwrap_or(usize::MAX)
    });
    Ok(Report {
        state: forced_state.unwrap_or_else(|| state_of(&reports)),
        mechanism,
        bindings: reports,
    })
}

/// Registers the valid bindings through the hotkeys backend. Blocking.
fn apply_hotkeys(
    app: &AppHandle,
    hotkeys: &Mutex<hotkeys::Hotkeys>,
    valid: Vec<Valid>,
) -> Result<Vec<BindingReport>, String> {
    let codes: Vec<String> = valid.iter().map(|v| v.chord.code.clone()).collect();
    let mut reports = Vec::new();
    let mut desired = BTreeMap::new();
    let mut notes = BTreeMap::new();
    for (binding, grab) in valid.iter().zip(keys::grabs(app, &codes)) {
        match grab {
            Ok(grab) => {
                desired.insert(
                    binding.action.clone(),
                    chord::accelerator(&binding.chord, grab.code),
                );
                notes.insert(binding.action.clone(), grab.note);
            }
            Err(message) => reports.push(BindingReport::invalid(&binding.action, message)),
        }
    }
    let outcome = hotkeys.lock().unwrap().apply(app, &desired)?;
    for (action, result) in outcome {
        reports.push(match result {
            Ok(()) => {
                let note = notes.remove(&action).flatten().map(str::to_owned);
                BindingReport::new(&action, Status::Active, note)
            }
            Err(hotkeys::Failure::Taken(message)) => {
                BindingReport::new(&action, Status::Taken, Some(message))
            }
            Err(hotkeys::Failure::Invalid(message)) => BindingReport::invalid(&action, message),
        });
    }
    Ok(reports)
}

/// Opens the desktop's own shortcut settings (portal version 2).
#[tauri::command]
pub async fn global_shortcuts_configure(state: State<'_, GlobalShortcuts>) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let mut inner = state.inner.lock().await;
        if let Some(portal) = inner.portal.as_mut() {
            return portal.configure().await;
        }
    }
    #[cfg(not(target_os = "linux"))]
    let _ = state;
    Err("the desktop has no shortcut settings to open".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report(status: Status) -> BindingReport {
        BindingReport::new("advance:bow", status, None)
    }

    fn binding(action: &str, chord: &str) -> Binding {
        Binding {
            action: action.into(),
            chord: chord.into(),
            description: "Bow forward".into(),
        }
    }

    #[test]
    fn adds_the_reports_up_to_a_state() {
        assert_eq!(state_of(&[]), Phase::Idle);
        assert_eq!(state_of(&[report(Status::Active)]), Phase::Active);
        assert_eq!(
            state_of(&[report(Status::Active), report(Status::Taken)]),
            Phase::Partial
        );
        assert_eq!(
            state_of(&[report(Status::Taken), report(Status::Invalid)]),
            Phase::Unavailable
        );
        assert_eq!(state_of(&[report(Status::Unbound)]), Phase::Unavailable);
    }

    #[test]
    fn keeps_the_valid_bindings_and_reports_the_rest() {
        let (valid, refused) = validate(vec![
            binding("advance:bow", "Control+Alt+KeyQ"),
            binding("back:bow", "Shift+KeyQ"),
            binding("rm -rf", "Control+KeyQ"),
            binding("advance:bow", "Control+KeyW"),
            binding("advance:hookshot", "Hyper+KeyQ"),
        ]);
        assert_eq!(valid.len(), 1);
        assert_eq!(valid[0].action, "advance:bow");
        assert_eq!(refused.len(), 4);
        assert!(refused.iter().all(|r| r.status == Status::Invalid));
        assert!(
            refused[0]
                .message
                .as_deref()
                .is_some_and(|m| m.contains("stop you typing"))
        );
    }

    #[test]
    fn bounds_a_description_to_one_line() {
        assert_eq!(clean_description("Bow\nforward\t!"), "Bowforward!");
        assert_eq!(clean_description(&"x".repeat(500)).len(), 120);
    }
}

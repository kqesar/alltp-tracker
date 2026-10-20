// The desktop's GlobalShortcuts portal (org.freedesktop.portal.GlobalShortcuts,
// through ashpd), for a Wayland session: a native Wayland client never shows
// its keys to an X11 grab, and the desktop alone knows what the emulator
// receives. The tracker asks for shortcuts and a preferred key for each; the
// desktop shows what it was asked, the player approves or changes the keys,
// and the portal says "activated" when one is pressed, whoever has the focus.
//
// A host (non-sandboxed) app has no app id for the portal, which refuses a
// session without one ("An app id is required"). So the app registers one
// with org.freedesktop.host.portal.Registry before any other portal call, and
// that needs a `<app id>.desktop` file GIO can find: the one `launcher.rs`
// writes, hidden (`NoDisplay`: the package's own menu entry stays the only
// one) unless the player added the AppImage to the menu, which that file
// carries too.
//
// Plasma 6.7.4 and later ask for BindShortcuts in every new session or the
// shortcuts stay dead (KDE bug 523063), so every start binds again.

use ashpd::desktop::Session;
use ashpd::desktop::global_shortcuts::{GlobalShortcuts, NewShortcut};
use ashpd::desktop::{CreateSessionOptions, ResponseError};
use ashpd::{AppID, Error};
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::chord;
use super::{BindingReport, Phase, Status, Valid, emit_step, keys};
use crate::launcher::{self, APP_ID};

/// How often `Register` is retried while GIO has not seen the new desktop file.
const REGISTER_TRIES: u32 = 3;

/// What a bind asks the desktop for, by action.
pub struct Wanted {
    action: String,
    description: String,
    trigger: Option<String>,
}

pub struct Outcome {
    pub bindings: Vec<BindingReport>,
    /// Set when the outcome is not the sum of the bindings (a refusal)
    pub state: Option<Phase>,
    /// Set when the portal cannot work at all here: the mechanism gives way
    /// to the command line, for this process
    pub downgrade: Option<String>,
}

#[derive(Serialize, Clone)]
struct Changed {
    action: String,
    trigger: Option<String>,
}

#[derive(Serialize, Clone)]
struct ChangedPayload {
    bindings: Vec<Changed>,
}

pub struct Portal {
    gs: Arc<GlobalShortcuts>,
    version: u32,
    session: Option<Session<GlobalShortcuts>>,
    /// What the live session was asked for: (portal id, preferred trigger)
    bound: Vec<(String, String)>,
    last: Vec<BindingReport>,
    last_state: Option<Phase>,
    sessions_made: u32,
}

/// How long creating a session may take: it asks the player nothing, so a
/// desktop that does not answer has no working portal (a frontend with no
/// backend behind it does exactly that).
const SESSION_WAIT: Duration = Duration::from_secs(20);

/// How long the whole probe (Register, then the interface) may take. Each D-Bus
/// call waits up to 25 s by default, so a portal frontend that hangs would hold
/// the shared state, and with it every later request, for a minute.
const PROBE_WAIT: Duration = Duration::from_secs(10);

/// How long the player gets to answer the desktop's dialog.
const BIND_WAIT: Duration = Duration::from_secs(5 * 60);

/// Whether the player declined the desktop's dialog.
fn is_refusal(error: &Error) -> bool {
    matches!(error, Error::Response(ResponseError::Cancelled))
}

/// Whether a `Register` refusal means GIO has not found the desktop file yet.
fn app_info_missing(error: &Error) -> bool {
    error.to_string().contains("App info not found")
}

/// `future`'s answer, or `None` when it takes longer than `limit`.
async fn within<T>(limit: Duration, future: impl std::future::Future<Output = T>) -> Option<T> {
    tokio::time::timeout(limit, future).await.ok()
}

impl Portal {
    pub fn version(&self) -> u32 {
        self.version
    }

    /// Looks for the portal: the hidden desktop file, the app id registered,
    /// then the interface itself. `None` for no portal at all. Runs once, on
    /// a Wayland session, before any other portal call (Register refuses to
    /// come late).
    pub async fn probe(app: &AppHandle, command: &str) -> Option<Portal> {
        within(PROBE_WAIT, Self::look(app, command))
            .await
            .unwrap_or_else(|| {
                eprintln!("alltp-tracker: the portal did not answer in time");
                None
            })
    }

    async fn look(app: &AppHandle, command: &str) -> Option<Portal> {
        if let Err(error) = launcher::ensure_for_portal(command) {
            eprintln!("alltp-tracker: could not write the desktop file: {error}");
        }
        match AppID::from_str(APP_ID) {
            Ok(id) => {
                for attempt in 1..=REGISTER_TRIES {
                    match ashpd::register_host_app(id.clone()).await {
                        Ok(()) => break,
                        Err(error) if app_info_missing(&error) && attempt < REGISTER_TRIES => {
                            tokio::time::sleep(Duration::from_millis(200)).await;
                        }
                        Err(error) => {
                            // A systemd scope may already give an app id
                            eprintln!("alltp-tracker: could not register with the portal: {error}");
                            break;
                        }
                    }
                }
            }
            Err(error) => eprintln!("alltp-tracker: bad app id: {error}"),
        }
        let gs = match GlobalShortcuts::new().await {
            Ok(gs) => Arc::new(gs),
            Err(error) => {
                eprintln!("alltp-tracker: no GlobalShortcuts portal: {error}");
                return None;
            }
        };
        let version = gs.version();
        listen(app.clone(), gs.clone());
        Some(Portal {
            bound: Vec::new(),
            gs,
            last: Vec::new(),
            last_state: None,
            session: None,
            sessions_made: 0,
            version,
        })
    }

    /// Closes the live session, which ends the desktop's shortcuts for it.
    pub async fn close(&mut self) {
        if let Some(session) = self.session.take()
            && let Err(error) = session.close().await
        {
            eprintln!("alltp-tracker: could not close the portal session: {error}");
        }
        self.bound.clear();
        self.last.clear();
        self.last_state = None;
    }

    /// The desktop's own settings for the shortcuts (portal version 2).
    pub async fn configure(&mut self) -> Result<(), String> {
        let Some(session) = &self.session else {
            return Err("no shortcuts are bound yet".into());
        };
        if self.version < 2 {
            return Err("the desktop cannot open its shortcut settings".into());
        }
        self.gs
            .configure_shortcuts(session, None, Default::default())
            .await
            .map_err(|error| error.to_string())
    }

    /// Makes the desktop's shortcuts the wanted ones. An unchanged set keeps
    /// its session: a bind per keystroke would pop the desktop's dialog each
    /// time. Empty closes the session.
    pub async fn apply(&mut self, app: &AppHandle, valid: Vec<Valid>, rebind: bool) -> Outcome {
        let codes: Vec<String> = valid.iter().map(|v| v.chord.code.clone()).collect();
        let names = {
            let handle = app.clone();
            tauri::async_runtime::spawn_blocking(move || keys::keysym_names(&handle, &codes))
                .await
                .unwrap_or_default()
        };
        let wanted: Vec<Wanted> = valid
            .into_iter()
            .zip(names.into_iter().chain(std::iter::repeat(None)))
            .map(|(binding, name)| Wanted {
                trigger: chord::portal_trigger(&binding.chord, name.as_deref()),
                action: binding.action,
                description: binding.description,
            })
            .collect();

        if wanted.is_empty() {
            self.close().await;
            return Outcome {
                bindings: Vec::new(),
                downgrade: None,
                state: Some(Phase::Idle),
            };
        }

        let mut ids: Vec<(String, String)> = wanted
            .iter()
            .map(|w| {
                (
                    chord::portal_id(&w.action),
                    w.trigger.clone().unwrap_or_default(),
                )
            })
            .collect();
        ids.sort();
        if !rebind && self.session.is_some() && ids == self.bound {
            return Outcome {
                bindings: self.last.clone(),
                downgrade: None,
                state: self.last_state,
            };
        }

        self.close().await;
        let session = match tokio::time::timeout(
            SESSION_WAIT,
            self.gs.create_session(CreateSessionOptions::default()),
        )
        .await
        {
            Ok(Ok(session)) => session,
            Ok(Err(error)) => {
                return self.failed(
                    &wanted,
                    &error.to_string(),
                    is_refusal(&error),
                    self.sessions_made == 0,
                );
            }
            Err(_) => {
                return self.failed(
                    &wanted,
                    "the desktop did not answer",
                    false,
                    self.sessions_made == 0,
                );
            }
        };
        self.sessions_made += 1;
        // Kept from now on, so a bind cut short (the page went away while the
        // desktop's dialog was open) leaves a session `close` ends
        self.bound.clear();
        let session = self.session.insert(session);

        let shortcuts: Vec<NewShortcut> = wanted
            .iter()
            .map(|w| {
                NewShortcut::new(chord::portal_id(&w.action), w.description.clone())
                    .preferred_trigger(w.trigger.as_deref())
            })
            .collect();
        let bind = tokio::time::timeout(
            BIND_WAIT,
            self.gs
                .bind_shortcuts(session, &shortcuts, None, Default::default()),
        )
        .await;
        let response = match bind {
            Ok(Ok(request)) => request.response(),
            Ok(Err(error)) => Err(error),
            Err(_) => {
                self.close().await;
                return self.failed(&wanted, "the desktop did not answer", false, false);
            }
        };
        let bound = match response {
            Ok(bound) => bound,
            Err(error) => {
                self.close().await;
                return self.failed(&wanted, &error.to_string(), is_refusal(&error), false);
            }
        };

        let triggers: HashMap<String, String> = bound
            .shortcuts()
            .iter()
            .map(|s| (s.id().to_owned(), s.trigger_description().to_owned()))
            .collect();
        let bindings: Vec<BindingReport> = wanted
            .iter()
            .map(|w| match triggers.get(&chord::portal_id(&w.action)) {
                Some(trigger) => BindingReport {
                    action: w.action.clone(),
                    message: None,
                    status: Status::Active,
                    trigger: (!trigger.is_empty()).then(|| trigger.clone()),
                },
                None => BindingReport::new(&w.action, Status::Unbound, None),
            })
            .collect();
        self.bound = ids;
        self.last = bindings.clone();
        self.last_state = None;
        Outcome {
            bindings,
            downgrade: None,
            state: None,
        }
    }

    /// A session or a bind that did not work: refused by the player, or
    /// unavailable (and, before any session ever worked, the portal is not
    /// usable here at all).
    fn failed(
        &mut self,
        wanted: &[Wanted],
        message: &str,
        refused: bool,
        first_session: bool,
    ) -> Outcome {
        let message = message.to_owned();
        let bindings: Vec<BindingReport> = wanted
            .iter()
            .map(|w| {
                BindingReport::new(
                    &w.action,
                    Status::Unbound,
                    (!refused).then(|| message.clone()),
                )
            })
            .collect();
        let state = if refused {
            Phase::Refused
        } else {
            Phase::Unavailable
        };
        self.last = bindings.clone();
        self.last_state = Some(state);
        Outcome {
            bindings,
            downgrade: (!refused && first_session).then_some(message),
            state: Some(state),
        }
    }
}

/// Forwards the portal's signals for the life of the process: a shortcut
/// pressed becomes a step, and a change the player made in the desktop's
/// settings becomes `global-shortcuts-changed`. One session at a time, so
/// there is nothing to filter by session.
fn listen(app: AppHandle, gs: Arc<GlobalShortcuts>) {
    tauri::async_runtime::spawn(async move {
        let (Ok(activated), Ok(changed)) = (
            gs.receive_activated().await,
            gs.receive_shortcuts_changed().await,
        ) else {
            eprintln!("alltp-tracker: could not listen to the portal's signals");
            return;
        };
        tokio::pin!(activated, changed);
        loop {
            tokio::select! {
                Some(signal) = activated.next() => {
                    if let Some(action) = chord::action_of_portal_id(signal.shortcut_id()) {
                        emit_step(&app, &action);
                    }
                }
                Some(signal) = changed.next() => {
                    let bindings = signal
                        .shortcuts()
                        .iter()
                        .filter_map(|s| {
                            chord::action_of_portal_id(s.id()).map(|action| Changed {
                                action,
                                trigger: Some(s.trigger_description().to_owned())
                                    .filter(|trigger| !trigger.is_empty()),
                            })
                        })
                        .collect();
                    let _ = app.emit("global-shortcuts-changed", ChangedPayload { bindings });
                }
                else => break,
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(flavor = "current_thread")]
    async fn gives_up_on_a_portal_that_never_answers() {
        let hung = within(Duration::from_millis(20), std::future::pending::<u32>()).await;
        assert_eq!(hung, None);
        let quick = within(Duration::from_millis(500), async { 7 }).await;
        assert_eq!(quick, Some(7));
    }
}

// The command line: `alltp-tracker --step advance:hookshot` steps a control
// in the running tracker. It is the one global-shortcut mechanism that works
// everywhere (a window manager's binding, a Stream Deck button), and the
// single-instance plugin is what carries it: a second process hands its
// arguments to the first and exits.

use std::collections::VecDeque;
use tauri::{AppHandle, Manager};

use crate::shortcuts::{GlobalShortcuts, emit_step};

/// How many steps wait for the first page to listen: the last ones win.
const MAX_PENDING: usize = 32;

/// The steps in `args` (`--step <action>` or `--step=<action>`, repeated, in
/// order) and the values that were refused. Any other argument is ignored: the
/// AppImage runtime or a desktop launcher may add its own.
pub fn parse_steps<I: IntoIterator<Item = String>>(args: I) -> (Vec<String>, Vec<String>) {
    let mut steps = Vec::new();
    let mut refused = Vec::new();
    let mut args = args.into_iter();
    while let Some(arg) = args.next() {
        let value = if arg == "--step" {
            args.next()
        } else {
            arg.strip_prefix("--step=").map(str::to_owned)
        };
        if let Some(value) = value {
            if crate::shortcuts::is_action(&value) {
                steps.push(value);
            } else {
                refused.push(value);
            }
        }
    }
    (steps, refused)
}

/// The steps in `args`, the refused ones named on stderr.
pub fn steps_from_args<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    let (steps, refused) = parse_steps(args);
    for value in refused {
        eprintln!("alltp-tracker: ignored --step \"{}\"", value.escape_debug());
    }
    steps
}

/// This process's own arguments, for a first instance started with `--step`.
pub fn own_steps() -> Vec<String> {
    steps_from_args(std::env::args_os().map(|arg| arg.to_string_lossy().into_owned()))
}

/// Adds `steps` to a queue that keeps the last `MAX_PENDING`.
fn push_bounded(queue: &mut VecDeque<String>, steps: Vec<String>) {
    queue.extend(steps);
    while queue.len() > MAX_PENDING {
        queue.pop_front();
    }
}

/// What became of the steps offered to a `StepQueue`.
#[derive(Debug, PartialEq, Eq)]
pub enum Fate {
    /// A page is listening: run them now
    Run,
    /// The first page has not listened yet: they wait for it
    Kept,
    /// No page is listening: they are lost
    Dropped,
}

/// The steps that come from outside (the command line) and the page that
/// runs them. They wait only until the process's first `ready`: a step that
/// finds no page listening after that (Super Metroid and SMZ3 never listen)
/// is dropped, so it can never replay into another game's run hours later.
#[derive(Debug, Default)]
pub struct StepQueue {
    listening: bool,
    /// A page has listened at least once in this process
    seen_listening: bool,
    waiting: VecDeque<String>,
}

impl StepQueue {
    /// Offers `steps`: run, kept for the first page, or dropped.
    pub fn offer(&mut self, steps: Vec<String>) -> Fate {
        if self.listening {
            Fate::Run
        } else if self.seen_listening {
            Fate::Dropped
        } else {
            push_bounded(&mut self.waiting, steps);
            Fate::Kept
        }
    }

    /// A page listens: the steps that waited for it, once.
    pub fn page_ready(&mut self) -> Vec<String> {
        self.listening = true;
        self.seen_listening = true;
        self.waiting.drain(..).collect()
    }

    /// A page starts loading: it listens no more. Before the first `ready`
    /// the queue stays: the first page is the one it waits for.
    pub fn page_started(&mut self) {
        self.listening = false;
        if self.seen_listening {
            self.waiting.clear();
        }
    }
}

/// A second instance was started: its steps run in this one, and a start
/// without steps brings this window forward, which is the plugin's usual job.
pub fn on_second_instance(app: &AppHandle, argv: Vec<String>, _cwd: String) {
    let steps = steps_from_args(argv.clone());
    if steps.is_empty() {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
        return;
    }
    let state = app.state::<GlobalShortcuts>();
    match state.offer(steps.clone()) {
        Fate::Run => {
            for step in steps {
                emit_step(app, &step);
            }
        }
        Fate::Kept => {}
        Fate::Dropped => eprintln!("alltp-tracker: no page listens, --step dropped"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| (*arg).to_owned()).collect()
    }

    #[test]
    fn reads_both_spellings_in_order_and_repeated() {
        let (steps, refused) = parse_steps(args(&[
            "alltp-tracker",
            "--step",
            "advance:hookshot",
            "--step=back:chest3",
            "--step",
            "advance:bow",
        ]));
        assert_eq!(steps, ["advance:hookshot", "back:chest3", "advance:bow"]);
        assert!(refused.is_empty());
    }

    #[test]
    fn refuses_a_value_that_is_not_an_action() {
        let (steps, refused) = parse_steps(args(&[
            "--step",
            "bogus",
            "--step=rm -rf /",
            "--step",
            "advance:hookshot",
            "--step=",
        ]));
        assert_eq!(steps, ["advance:hookshot"]);
        assert_eq!(refused, ["bogus", "rm -rf /", ""]);
    }

    #[test]
    fn ignores_the_arguments_a_launcher_adds() {
        let (steps, refused) = parse_steps(args(&[
            "/tmp/.mount_ALLTPxyz/usr/bin/alltp-tracker",
            "--appimage-extract",
            "-psn_0_1234",
            "--step=advance:bow",
            "tauri://localhost",
        ]));
        assert_eq!(steps, ["advance:bow"]);
        assert!(refused.is_empty());
    }

    #[test]
    fn a_step_flag_with_no_value_is_nothing() {
        let (steps, refused) = parse_steps(args(&["--step"]));
        assert!(steps.is_empty() && refused.is_empty());
    }

    fn one(step: &str) -> Vec<String> {
        vec![step.to_owned()]
    }

    #[test]
    fn keeps_the_last_thirty_two_steps_for_the_first_page() {
        let mut queue = StepQueue::default();
        let many = (0..40).map(|n| format!("advance:item{n}")).collect();
        assert_eq!(queue.offer(many), Fate::Kept);
        assert_eq!(queue.offer(one("back:bow")), Fate::Kept);
        let steps = queue.page_ready();
        assert_eq!(steps.len(), MAX_PENDING);
        assert_eq!(steps.first().map(String::as_str), Some("advance:item9"));
        assert_eq!(steps.last().map(String::as_str), Some("back:bow"));
        assert!(queue.page_ready().is_empty());
    }

    #[test]
    fn the_first_page_still_gets_what_waited_through_its_own_load() {
        let mut queue = StepQueue::default();
        queue.offer(one("advance:bow"));
        queue.page_started();
        assert_eq!(queue.page_ready(), ["advance:bow"]);
    }

    #[test]
    fn runs_the_steps_while_a_page_listens() {
        let mut queue = StepQueue::default();
        queue.page_ready();
        assert_eq!(queue.offer(one("advance:bow")), Fate::Run);
    }

    #[test]
    fn drops_the_steps_once_a_page_has_listened_and_none_does_now() {
        let mut queue = StepQueue::default();
        queue.page_ready();
        // A switch to Super Metroid: its page never says ready
        queue.page_started();
        assert_eq!(queue.offer(one("advance:bow")), Fate::Dropped);
        assert_eq!(queue.offer(one("back:bow")), Fate::Dropped);
        // Back to A Link to the Past: nothing replays into the run
        assert!(queue.page_ready().is_empty());
    }

    #[test]
    fn a_page_that_starts_loading_empties_what_somehow_waited() {
        let mut queue = StepQueue::default();
        queue.page_ready();
        queue.waiting.push_back("advance:bow".into());
        queue.page_started();
        assert!(queue.page_ready().is_empty());
    }
}

// The command line: `alltp-tracker --step advance:hookshot` steps a control
// in the running tracker. It is the one global-shortcut mechanism that works
// everywhere (a window manager's binding, a Stream Deck button), and the
// single-instance plugin is what carries it: a second process hands its
// arguments to the first and exits.

use std::collections::VecDeque;
use tauri::{AppHandle, Manager};

use crate::shortcuts::{GlobalShortcuts, emit_step};

/// How many steps wait for a page that is not listening: the last ones win.
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
pub fn push_bounded(queue: &mut VecDeque<String>, steps: Vec<String>) {
    queue.extend(steps);
    while queue.len() > MAX_PENDING {
        queue.pop_front();
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
    if state.is_ready() {
        for step in steps {
            emit_step(app, &step);
        }
    } else {
        state.queue(steps);
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

    #[test]
    fn keeps_the_last_thirty_two_steps() {
        let mut queue = VecDeque::new();
        push_bounded(
            &mut queue,
            (0..40).map(|n| format!("advance:item{n}")).collect(),
        );
        assert_eq!(queue.len(), MAX_PENDING);
        assert_eq!(queue.front().map(String::as_str), Some("advance:item8"));
        assert_eq!(queue.back().map(String::as_str), Some("advance:item39"));
        push_bounded(&mut queue, vec!["back:bow".into()]);
        assert_eq!(queue.len(), MAX_PENDING);
        assert_eq!(queue.back().map(String::as_str), Some("back:bow"));
    }
}

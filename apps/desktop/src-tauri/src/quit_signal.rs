// The system asking the app to quit (SIGTERM from `kill` or a service
// manager, SIGINT from a terminal, SIGHUP when the session or its terminal
// ends; on Windows only Ctrl+C in a debug build's console, since release
// builds have no console). Without a handler the process dies on the spot,
// `RunEvent::Exit` never runs and the servers cannot tell their clients: they
// see an abrupt close (1006) instead of 4410.

use std::io;

/// Exit status after a second signal: the shell's 128 + SIGINT.
const FORCED_EXIT: i32 = 130;

/// Listens for a quit signal on Tauri's runtime and calls `on_quit` at the
/// first one. A second signal ends the process at once, so an exit that
/// stalls can still be stopped without SIGKILL (the handlers, once installed,
/// replace the default ones for good).
///
/// Callable from any thread: the handlers are installed inside the spawned
/// task, where tokio's reactor is entered. Tauri calls `setup` on the main
/// thread, outside any runtime, where `tokio::signal` panics.
pub fn listen(on_quit: impl FnOnce() + Send + 'static) {
    spawn_listener(|| {}, on_quit);
}

fn spawn_listener(
    on_ready: impl FnOnce() + Send + 'static,
    on_quit: impl FnOnce() + Send + 'static,
) {
    tauri::async_runtime::spawn(async move {
        let mut signals = match QuitSignals::install() {
            Ok(signals) => signals,
            Err(error) => {
                eprintln!("cannot listen for a quit signal: {error}");
                return;
            }
        };
        on_ready();
        signals.wait().await;
        on_quit();
        signals.wait().await;
        std::process::exit(FORCED_EXIT);
    });
}

/// Handlers installed; `wait` resolves at each signal. Must be built inside a
/// tokio runtime.
struct QuitSignals {
    #[cfg(unix)]
    terminate: tokio::signal::unix::Signal,
    #[cfg(unix)]
    interrupt: tokio::signal::unix::Signal,
    #[cfg(unix)]
    hangup: tokio::signal::unix::Signal,
}

impl QuitSignals {
    #[cfg(unix)]
    fn install() -> io::Result<Self> {
        use tokio::signal::unix::{SignalKind, signal};
        Ok(Self {
            terminate: signal(SignalKind::terminate())?,
            interrupt: signal(SignalKind::interrupt())?,
            hangup: signal(SignalKind::hangup())?,
        })
    }

    #[cfg(not(unix))]
    fn install() -> io::Result<Self> {
        Ok(Self {})
    }

    /// A stream that ends (`None`: the signal driver is gone, which happens
    /// only as the runtime shuts down) is not a signal: its branch is
    /// disabled, and with none left `wait` pends for good.
    #[cfg(unix)]
    async fn wait(&mut self) {
        tokio::select! {
            Some(()) = self.terminate.recv() => {}
            Some(()) = self.interrupt.recv() => {}
            Some(()) = self.hangup.recv() => {}
            else => std::future::pending::<()>().await,
        }
    }

    /// `ctrl_c` fails at once when the console handler cannot be registered:
    /// that is no signal, so `wait` pends rather than quit the app.
    #[cfg(not(unix))]
    async fn wait(&mut self) {
        if let Err(error) = tokio::signal::ctrl_c().await {
            eprintln!("cannot listen for Ctrl+C: {error}");
            std::future::pending::<()>().await;
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;
    use std::sync::mpsc;
    use std::time::Duration;

    const CHILD: &str = "ALLTP_QUIT_SIGNAL_CHILD";
    const QUIT_SEEN: &str = "quit callback ran";

    fn sigterm_self() {
        // SAFETY: kill(2) on our own pid with a valid signal number
        assert_eq!(unsafe { libc::kill(libc::getpid(), libc::SIGTERM) }, 0);
    }

    /// The child's half: `listen`'s path from a plain thread with no runtime
    /// (as Tauri's `setup` runs), then two SIGTERMs. Before the handlers moved
    /// into the task, installing them here panicked ("no reactor running").
    fn child() {
        let (ready_tx, ready) = mpsc::channel();
        let (quit_tx, quit) = mpsc::channel();
        spawn_listener(
            move || ready_tx.send(()).unwrap(),
            move || quit_tx.send(()).unwrap(),
        );
        ready
            .recv_timeout(Duration::from_secs(5))
            .expect("the handlers were not installed");
        sigterm_self();
        quit.recv_timeout(Duration::from_secs(5))
            .expect("the first SIGTERM did not reach on_quit");
        eprintln!("{QUIT_SEEN}");
        sigterm_self();
        std::thread::sleep(Duration::from_secs(5));
        panic!("the second SIGTERM did not end the process");
    }

    /// Run in a re-executed copy of this test binary: the handlers stay in
    /// place once installed, and in this process they would keep Ctrl+C or a
    /// CI cancel from stopping the rest of the tests.
    #[test]
    fn a_first_signal_quits_through_the_callback_and_a_second_forces_the_exit() {
        if std::env::var_os(CHILD).is_some() {
            child();
            return;
        }
        let output = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "quit_signal::tests::a_first_signal_quits_through_the_callback_and_a_second_forces_the_exit",
                "--nocapture",
                "--test-threads=1",
            ])
            .env(CHILD, "1")
            .output()
            .unwrap();
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            stderr.contains(QUIT_SEEN),
            "the child never reached on_quit: {stderr}"
        );
        assert_eq!(
            output.status.code(),
            Some(FORCED_EXIT),
            "child stderr: {stderr}"
        );
    }
}

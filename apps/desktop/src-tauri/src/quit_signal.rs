// The system asking the app to quit (SIGTERM from `kill` or a service
// manager, SIGINT from a terminal, SIGHUP when the session or its terminal
// ends; Ctrl+C or a console close on Windows). Without a handler the process
// dies on the spot, `RunEvent::Exit` never runs and the servers cannot tell
// their clients: they see an abrupt close (1006) instead of 4410.

use std::io;

/// Handlers installed; `wait` resolves at the first signal. Built apart from
/// waiting so a caller (and the test) knows the handlers are in place before
/// any signal can arrive.
pub struct QuitSignals {
    #[cfg(unix)]
    terminate: tokio::signal::unix::Signal,
    #[cfg(unix)]
    interrupt: tokio::signal::unix::Signal,
    #[cfg(unix)]
    hangup: tokio::signal::unix::Signal,
}

impl QuitSignals {
    #[cfg(unix)]
    pub fn install() -> io::Result<Self> {
        use tokio::signal::unix::{SignalKind, signal};
        Ok(Self {
            terminate: signal(SignalKind::terminate())?,
            interrupt: signal(SignalKind::interrupt())?,
            hangup: signal(SignalKind::hangup())?,
        })
    }

    #[cfg(not(unix))]
    pub fn install() -> io::Result<Self> {
        Ok(Self {})
    }

    #[cfg(unix)]
    pub async fn wait(mut self) {
        tokio::select! {
            _ = self.terminate.recv() => {}
            _ = self.interrupt.recv() => {}
            _ = self.hangup.recv() => {}
        }
    }

    #[cfg(not(unix))]
    pub async fn wait(self) {
        let _ = tokio::signal::ctrl_c().await;
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::Duration;

    /// A SIGTERM sent to the process reaches `wait` instead of ending it:
    /// before the handlers, this test run would have been killed.
    #[tokio::test]
    async fn sigterm_is_caught_instead_of_killing_the_process() {
        let signals = QuitSignals::install().unwrap();
        let status = std::process::Command::new("kill")
            .args(["-TERM", &std::process::id().to_string()])
            .status()
            .unwrap();
        assert!(status.success());
        tokio::time::timeout(Duration::from_secs(5), signals.wait())
            .await
            .expect("the signal was not delivered");
    }
}

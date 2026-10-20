// RetroArch's network commands, for the page's RetroArch transport
// (packages/autotrack/src/retroarch.ts): one UDP datagram out, one back, on
// the port RetroArch listens on (network_cmd_port, 55355 by default). A
// browser cannot send UDP; this is the whole of what the app adds.
//
// Each command gets a socket of its own, so a reply can only answer its own
// command and a late one dies with its socket. Only the commands that read
// pass: the page can never write the game's memory, load a state or quit.

use std::io;
use std::time::Duration;
use tokio::net::UdpSocket;

/// Where RetroArch listens for network commands by default.
pub const RETROARCH: &str = "127.0.0.1:55355";

/// The commands the tracker sends, all of them reads.
const COMMANDS: [&str; 3] = ["VERSION", "GET_STATUS", "READ_CORE_MEMORY"];

/// The longest a command may wait for its reply.
pub const MAX_WAIT: Duration = Duration::from_secs(5);

/// A UDP datagram's largest payload: no reply is longer.
const MAX_REPLY: usize = 65_536;

/// Sends `command` to RetroArch at `address` and returns its reply, or
/// `None` when nothing answered within `wait`: no RetroArch, its network
/// commands off (the port refuses at once), or one too busy to reply.
pub async fn exchange(address: &str, command: &str, wait: Duration) -> io::Result<Option<String>> {
    let verb = command.split(' ').next().unwrap_or_default();
    if !COMMANDS.contains(&verb) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{verb} is not a command the tracker sends"),
        ));
    }
    let socket = UdpSocket::bind("127.0.0.1:0").await?;
    socket.connect(address).await?;
    socket.send(command.as_bytes()).await?;
    let mut reply = vec![0; MAX_REPLY];
    match tokio::time::timeout(wait.min(MAX_WAIT), socket.recv(&mut reply)).await {
        Err(_) => Ok(None),
        // A closed port answers with an ICMP error: refused on Linux and
        // macOS, reset on Windows
        Ok(Err(error))
            if matches!(
                error.kind(),
                io::ErrorKind::ConnectionRefused | io::ErrorKind::ConnectionReset
            ) =>
        {
            Ok(None)
        }
        Ok(Err(error)) => Err(error),
        Ok(Ok(size)) => Ok(Some(String::from_utf8_lossy(&reply[..size]).into_owned())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::UdpSocket as StdSocket;
    use std::thread;

    const WAIT: Duration = Duration::from_millis(200);

    /// A RetroArch that answers one command with `reply`, and says what it got.
    fn fake_retroarch(reply: Option<&'static str>) -> (String, thread::JoinHandle<Option<String>>) {
        let socket = StdSocket::bind("127.0.0.1:0").unwrap();
        socket.set_read_timeout(Some(WAIT)).unwrap();
        let address = socket.local_addr().unwrap().to_string();
        let handle = thread::spawn(move || {
            let mut buffer = [0; 1024];
            let (size, from) = socket.recv_from(&mut buffer).ok()?;
            if let Some(reply) = reply {
                socket.send_to(reply.as_bytes(), from).unwrap();
            }
            Some(String::from_utf8_lossy(&buffer[..size]).into_owned())
        });
        (address, handle)
    }

    fn run(address: &str, command: &str) -> io::Result<Option<String>> {
        tauri::async_runtime::block_on(exchange(address, command, WAIT))
    }

    #[test]
    fn returns_the_reply() {
        let (address, retroarch) = fake_retroarch(Some("READ_CORE_MEMORY 7e0010 07\n"));
        let reply = run(&address, "READ_CORE_MEMORY 7e0010 1").unwrap();
        assert_eq!(reply.as_deref(), Some("READ_CORE_MEMORY 7e0010 07\n"));
        assert_eq!(
            retroarch.join().unwrap().as_deref(),
            Some("READ_CORE_MEMORY 7e0010 1")
        );
    }

    #[test]
    fn gives_none_when_nothing_answers() {
        let (address, retroarch) = fake_retroarch(None);
        assert_eq!(run(&address, "VERSION").unwrap(), None);
        retroarch.join().unwrap();
    }

    #[test]
    fn gives_none_when_the_port_is_closed() {
        let address = StdSocket::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .to_string();
        assert_eq!(run(&address, "GET_STATUS").unwrap(), None);
    }

    #[test]
    fn sends_no_command_that_writes() {
        let (address, retroarch) = fake_retroarch(Some("WRITE_CORE_MEMORY 7ef340 1\n"));
        for command in [
            "WRITE_CORE_MEMORY 7ef340 01",
            "QUIT",
            "LOAD_STATE",
            "VERSIONS",
            "",
        ] {
            let error = run(&address, command).unwrap_err();
            assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        }
        assert_eq!(retroarch.join().unwrap(), None);
    }
}

// The app's one desktop file on Linux, and the icons it names:
// `$XDG_DATA_HOME/applications/io.github.kqesar.alltp-tracker.desktop`.
//
// Two features need it, and they share this writer so neither overwrites the
// other's intent:
//
// - the GlobalShortcuts portal (`shortcuts/portal.rs`) needs a desktop file
//   named after the app id for `Registry.Register`. It writes it hidden
//   (`NoDisplay=true`) and keeps whatever visibility the file already has;
// - the application menu: a downloaded AppImage installs no menu entry, so
//   the player may ask for one (`NoDisplay=false` on that same file). Only an
//   AppImage offers it: the .deb and .rpm install their own entry.
//
// The file is the only record of the menu choice, so there is nothing to keep
// in step with it. What each side does about the other:
//
//   add                  the file, visible
//   remove, portal used  the file, hidden (Register still needs it)
//   remove, otherwise    the file and the icons deleted
//   portal               the file, in the visibility it has (hidden if new),
//                        and always hidden outside an AppImage
//   launch as AppImage   an existing file whose Exec names another path
//                        (moved, renamed, a newer download) gets the running
//                        AppImage, visibility unchanged; nothing is created
//
// The Exec line escapes `%` as `%%` and the file is not written when the path
// holds a control character.

use crate::app_menu::State;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

/// The portal's id for this app, the bundle identifier, as the desktop file's
/// name and the icon's.
pub const APP_ID: &str = "io.github.kqesar.alltp-tracker";

/// The bundled icons, installed under `icons/hicolor/<size>/apps/<APP_ID>.png`
/// next to the desktop file: the name the file's `Icon=` key gives.
const ICONS: [(u32, &[u8]); 3] = [
    (32, include_bytes!("../icons/32x32.png")),
    (128, include_bytes!("../icons/128x128.png")),
    (256, include_bytes!("../icons/128x128@2x.png")),
];

/// Whether this process has asked the portal for a session, which needs the
/// file to stay: removing the menu entry then hides it instead of deleting it.
static PORTAL_USED: AtomicBool = AtomicBool::new(false);

/// One change of the file at a time: the player's click and the portal's
/// probe may overlap.
static WRITING: Mutex<()> = Mutex::new(());

/// A quoted Exec argument, per the Desktop Entry specification: `"`, `` ` ``,
/// `$` and `\` are escaped with a backslash (the backslashes themselves
/// doubled by the file's own string escaping), and `%` is doubled, or GIO
/// would read `%r` in a path as a field code and drop it. `None` for a path
/// with a control character: a newline would start another key of the file.
fn exec_quoted(command: &str) -> Option<String> {
    if command.chars().any(char::is_control) {
        return None;
    }
    let mut quoted = String::from("\"");
    for c in command.chars() {
        match c {
            '\\' => quoted.push_str("\\\\\\\\"),
            '"' | '`' | '$' => {
                quoted.push_str("\\\\");
                quoted.push(c);
            }
            '%' => quoted.push_str("%%"),
            _ => quoted.push(c),
        }
    }
    quoted.push('"');
    Some(quoted)
}

/// The desktop file for a command, in the menu or hidden, or `None` when the
/// command cannot be written safely. `Categories` files the entry in the
/// menu's games when it shows (without it KDE lists it as "Lost & Found").
fn entry(command: &str, in_menu: bool) -> Option<String> {
    Some(format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=Rando Atlas\n\
         Comment=Item and map tracker for randomizer runs\n\
         Exec={} %U\n\
         Icon={APP_ID}\n\
         Categories=Game;\n\
         Terminal=false\n\
         NoDisplay={}\n",
        exec_quoted(command)?,
        !in_menu
    ))
}

/// Whether a desktop file's text puts the app in the menu.
fn shows_in_menu(text: &str) -> bool {
    text.lines().any(|line| line == "NoDisplay=false")
}

/// Where the files go: the XDG data directory.
struct Dirs {
    data: PathBuf,
}

impl Dirs {
    fn from_env() -> Option<Dirs> {
        std::env::var_os("XDG_DATA_HOME")
            .filter(|path| !path.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })
            .map(|data| Dirs { data })
    }

    fn desktop_file(&self) -> PathBuf {
        self.data
            .join("applications")
            .join(format!("{APP_ID}.desktop"))
    }

    fn icon(&self, size: u32) -> PathBuf {
        self.data
            .join(format!("icons/hicolor/{size}x{size}/apps/{APP_ID}.png"))
    }

    fn in_menu(&self) -> bool {
        std::fs::read_to_string(self.desktop_file()).is_ok_and(|text| shows_in_menu(&text))
    }

    /// Replaces a file's content, through a temporary file and a rename so a
    /// desktop watching the directory never reads half of it. `false` when it
    /// already held `bytes`: nothing is touched.
    fn put(path: &Path, bytes: &[u8]) -> io::Result<bool> {
        if std::fs::read(path).is_ok_and(|current| current == bytes) {
            return Ok(false);
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let temporary = path.with_extension("tmp");
        std::fs::write(&temporary, bytes)?;
        std::fs::rename(&temporary, path).inspect_err(|_| {
            let _ = std::fs::remove_file(&temporary);
        })?;
        Ok(true)
    }

    /// Writes the icons, then the file that names them: whenever the file
    /// exists, its `Icon=` resolves.
    fn write(&self, command: &str, in_menu: bool) -> io::Result<bool> {
        let wanted = entry(command, in_menu).ok_or_else(|| {
            io::Error::other(
                "the command holds a control character, which a desktop file cannot carry",
            )
        })?;
        for (size, png) in ICONS {
            Self::put(&self.icon(size), png)?;
        }
        Self::put(&self.desktop_file(), wanted.as_bytes())
    }

    fn delete(&self) -> io::Result<()> {
        let files =
            std::iter::once(self.desktop_file()).chain(ICONS.map(|(size, _)| self.icon(size)));
        for file in files {
            match std::fs::remove_file(file) {
                Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
                _ => {}
            }
        }
        Ok(())
    }

    fn state(&self, appimage: Option<&str>) -> State {
        State {
            added: appimage.is_some() && self.in_menu(),
            available: appimage.is_some(),
        }
    }

    fn add(&self, appimage: &str) -> io::Result<()> {
        self.write(appimage, true).map(drop)
    }

    fn remove(&self, appimage: &str, portal_used: bool) -> io::Result<()> {
        if portal_used {
            self.write(appimage, false).map(drop)
        } else {
            self.delete()
        }
    }

    /// The portal's file: hidden when new, the visibility it has otherwise,
    /// and hidden outside an AppImage, where a package's own entry is the one.
    fn ensure_for_portal(&self, command: &str, as_appimage: bool) -> io::Result<()> {
        self.write(command, as_appimage && self.in_menu()).map(drop)
    }

    /// An existing file whose Exec names another path now names the running
    /// AppImage. Returns whether it was rewritten. A missing file stays
    /// missing: nothing the player did not ask for.
    fn refresh(&self, appimage: &str) -> io::Result<bool> {
        match std::fs::read_to_string(self.desktop_file()) {
            Ok(text) => self.write(appimage, shows_in_menu(&text)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(error),
        }
    }
}

/// The running AppImage: `$APPIMAGE` when it is an absolute path to a file
/// (the runtime sets it; a desktop file's Exec cannot use a relative one).
pub fn appimage() -> Option<String> {
    std::env::var("APPIMAGE")
        .ok()
        .filter(|path| Path::new(path).is_absolute() && Path::new(path).is_file())
}

fn lock() -> std::sync::MutexGuard<'static, ()> {
    WRITING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn state() -> State {
    match Dirs::from_env() {
        Some(dirs) => dirs.state(appimage().as_deref()),
        None => State {
            added: false,
            available: false,
        },
    }
}

/// Adds the AppImage to the menu, or takes it out, and says how it stands.
pub fn set_added(added: bool) -> Result<State, String> {
    let appimage = appimage().ok_or("the app is not running as an AppImage")?;
    let dirs = Dirs::from_env().ok_or("no home directory")?;
    let _writing = lock();
    let done = if added {
        dirs.add(&appimage)
    } else {
        dirs.remove(&appimage, PORTAL_USED.load(Ordering::Relaxed))
    };
    done.map_err(|error| error.to_string())?;
    Ok(dirs.state(Some(&appimage)))
}

/// At each launch as an AppImage: keeps an existing file's Exec on the
/// running AppImage. Best effort, named on stderr.
pub fn refresh_at_launch() {
    let (Some(appimage), Some(dirs)) = (appimage(), Dirs::from_env()) else {
        return;
    };
    let _writing = lock();
    if let Err(error) = dirs.refresh(&appimage) {
        eprintln!("alltp-tracker: could not update the desktop file: {error}");
    }
}

/// The portal's hidden file, written when missing or out of date, in the
/// visibility it has. Remembers that the portal needs the file.
pub fn ensure_for_portal(command: &str) -> io::Result<()> {
    PORTAL_USED.store(true, Ordering::Relaxed);
    let dirs = Dirs::from_env().ok_or_else(|| io::Error::other("no home directory"))?;
    let _writing = lock();
    dirs.ensure_for_portal(command, appimage().is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU32;

    const APPIMAGE: &str = "/home/p/Downloads/ALLTP Tracker.AppImage";

    /// A data directory of its own, removed afterwards.
    struct Scratch(Dirs);

    impl Scratch {
        fn new() -> Self {
            static NEXT: AtomicU32 = AtomicU32::new(0);
            let data = std::env::temp_dir().join(format!(
                "alltp-launcher-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let _ = std::fs::remove_dir_all(&data);
            Scratch(Dirs { data })
        }

        fn file(&self) -> Option<String> {
            std::fs::read_to_string(self.0.desktop_file()).ok()
        }

        fn icons(&self) -> usize {
            ICONS
                .iter()
                .filter(|(size, _)| self.0.icon(*size).is_file())
                .count()
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0.data);
        }
    }

    #[test]
    fn writes_the_entry_hidden_or_in_the_menu() {
        let hidden = entry("/opt/ALLTP Tracker/alltp-tracker", false).unwrap();
        assert!(hidden.starts_with("[Desktop Entry]\nType=Application\n"));
        assert!(hidden.contains("Exec=\"/opt/ALLTP Tracker/alltp-tracker\" %U\n"));
        assert!(hidden.contains("Icon=io.github.kqesar.alltp-tracker\n"));
        assert!(hidden.contains("Categories=Game;\n"));
        assert!(hidden.ends_with("NoDisplay=true\n"));
        assert!(!shows_in_menu(&hidden));

        let shown = entry("/opt/ALLTP Tracker/alltp-tracker", true).unwrap();
        assert!(shown.ends_with("NoDisplay=false\n"));
        assert!(shows_in_menu(&shown));
        assert_eq!(hidden.replace("NoDisplay=true", "NoDisplay=false"), shown);
    }

    #[test]
    fn quotes_what_the_exec_line_would_otherwise_read_as_syntax() {
        // The specification asks for a backslash before ", `, $ and \ inside the
        // quotes, and the file's string escaping doubles every backslash
        let quoted = |command| exec_quoted(command).unwrap();
        assert_eq!(quoted("/a b/c"), "\"/a b/c\"");
        assert_eq!(quoted("/a\"b"), "\"/a\\\\\"b\"");
        assert_eq!(quoted("/a$b`c"), "\"/a\\\\$b\\\\`c\"");
        assert_eq!(quoted("/a\\b"), "\"/a\\\\\\\\b\"");
    }

    #[test]
    fn doubles_a_percent_so_it_is_not_read_as_a_field_code() {
        assert_eq!(exec_quoted("/100%real/app").unwrap(), "\"/100%%real/app\"");
        let text = entry("/100%real/app", true).unwrap();
        assert!(text.contains("Exec=\"/100%%real/app\" %U\n"));
    }

    #[test]
    fn refuses_a_path_that_would_inject_keys_into_the_file() {
        for command in [
            "/a\nExec=/bin/evil",
            "/a\rb",
            "/a\tb",
            "/a\u{7}b",
            "/a\u{0}b",
        ] {
            assert_eq!(exec_quoted(command), None, "{command:?}");
            assert_eq!(entry(command, true), None, "{command:?}");
            let scratch = Scratch::new();
            assert!(scratch.0.add(command).is_err(), "{command:?}");
            assert_eq!(scratch.file(), None, "{command:?}");
            assert_eq!(scratch.icons(), 0, "{command:?}");
        }
    }

    #[test]
    fn puts_each_icon_where_the_hicolor_theme_looks() {
        let dirs = Dirs {
            data: PathBuf::from("/data"),
        };
        assert_eq!(
            dirs.icon(256),
            Path::new("/data/icons/hicolor/256x256/apps/io.github.kqesar.alltp-tracker.png")
        );
        assert_eq!(
            dirs.desktop_file(),
            Path::new("/data/applications/io.github.kqesar.alltp-tracker.desktop")
        );
        // Each bundled icon is the PNG of the size it is filed under
        for (size, png) in ICONS {
            assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
            assert_eq!(u32::from_be_bytes(png[16..20].try_into().unwrap()), size);
            assert_eq!(u32::from_be_bytes(png[20..24].try_into().unwrap()), size);
        }
    }

    #[test]
    fn adding_writes_the_visible_file_and_its_icons() {
        let scratch = Scratch::new();
        assert_eq!(
            scratch.0.state(Some(APPIMAGE)),
            State {
                added: false,
                available: true
            }
        );

        scratch.0.add(APPIMAGE).unwrap();

        let text = scratch.file().unwrap();
        assert!(shows_in_menu(&text));
        assert!(text.contains("Exec=\"/home/p/Downloads/ALLTP Tracker.AppImage\" %U\n"));
        assert_eq!(scratch.icons(), ICONS.len());
        assert_eq!(
            scratch.0.state(Some(APPIMAGE)),
            State {
                added: true,
                available: true
            }
        );
        // No temporary file is left for a desktop to read
        let left: Vec<_> = std::fs::read_dir(scratch.0.data.join("applications"))
            .unwrap()
            .collect();
        assert_eq!(left.len(), 1);
    }

    #[test]
    fn offers_nothing_outside_an_appimage() {
        let scratch = Scratch::new();
        scratch.0.add(APPIMAGE).unwrap();
        assert_eq!(
            scratch.0.state(None),
            State {
                added: false,
                available: false
            }
        );
    }

    #[test]
    fn removing_deletes_the_file_and_the_icons_when_the_portal_was_not_used() {
        let scratch = Scratch::new();
        scratch.0.add(APPIMAGE).unwrap();

        scratch.0.remove(APPIMAGE, false).unwrap();

        assert_eq!(scratch.file(), None);
        assert_eq!(scratch.icons(), 0);
        assert_eq!(
            scratch.0.state(Some(APPIMAGE)),
            State {
                added: false,
                available: true
            }
        );
        // Removing what is not there is not an error
        scratch.0.remove(APPIMAGE, false).unwrap();
    }

    #[test]
    fn removing_hides_the_file_the_portal_needs() {
        let scratch = Scratch::new();
        scratch.0.add(APPIMAGE).unwrap();

        scratch.0.remove(APPIMAGE, true).unwrap();

        let text = scratch.file().unwrap();
        assert!(text.ends_with("NoDisplay=true\n"));
        assert_eq!(scratch.icons(), ICONS.len());
        assert_eq!(
            scratch.0.state(Some(APPIMAGE)),
            State {
                added: false,
                available: true
            }
        );
    }

    #[test]
    fn the_portal_writes_a_hidden_file_and_keeps_the_players_choice() {
        let scratch = Scratch::new();
        scratch.0.ensure_for_portal(APPIMAGE, true).unwrap();
        assert!(!shows_in_menu(&scratch.file().unwrap()));
        assert_eq!(scratch.icons(), ICONS.len());

        scratch.0.add(APPIMAGE).unwrap();
        // The next launch's probe: the file is in the menu and stays there
        scratch.0.ensure_for_portal(APPIMAGE, true).unwrap();
        assert!(shows_in_menu(&scratch.file().unwrap()));
        // And the AppImage moved: the Exec follows, the menu entry stays
        scratch
            .0
            .ensure_for_portal("/new/place.AppImage", true)
            .unwrap();
        let text = scratch.file().unwrap();
        assert!(shows_in_menu(&text));
        assert!(text.contains("Exec=\"/new/place.AppImage\" %U\n"));
    }

    #[test]
    fn the_portal_never_puts_a_package_in_the_menu() {
        let scratch = Scratch::new();
        scratch.0.add(APPIMAGE).unwrap();

        // Later run from a .deb: its own menu entry is the only one
        scratch
            .0
            .ensure_for_portal("/usr/bin/alltp-tracker", false)
            .unwrap();

        let text = scratch.file().unwrap();
        assert!(!shows_in_menu(&text));
        assert!(text.contains("Exec=\"/usr/bin/alltp-tracker\" %U\n"));
    }

    #[test]
    fn the_portal_rewrites_a_file_of_an_older_version() {
        let scratch = Scratch::new();
        let path = scratch.0.desktop_file();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(
            &path,
            "[Desktop Entry]\nType=Application\nName=Rando Atlas\n\
             Exec=\"/old\" %U\nIcon=alltp-tracker\nNoDisplay=true\n",
        )
        .unwrap();

        scratch.0.ensure_for_portal("/old", true).unwrap();

        let text = scratch.file().unwrap();
        assert!(text.contains("Name=Rando Atlas\n"));
        assert!(text.contains("Icon=io.github.kqesar.alltp-tracker\n"));
        assert!(!shows_in_menu(&text));
        assert_eq!(scratch.icons(), ICONS.len());
    }

    #[test]
    fn a_moved_appimage_gets_its_exec_fixed_at_launch() {
        let scratch = Scratch::new();
        scratch.0.add("/old/ALLTP Tracker.AppImage").unwrap();

        assert!(scratch.0.refresh(APPIMAGE).unwrap());

        let text = scratch.file().unwrap();
        assert!(text.contains("Exec=\"/home/p/Downloads/ALLTP Tracker.AppImage\" %U\n"));
        assert!(shows_in_menu(&text));
    }

    #[test]
    fn a_hidden_file_stays_hidden_when_its_exec_is_fixed() {
        let scratch = Scratch::new();
        scratch
            .0
            .ensure_for_portal("/old/app.AppImage", true)
            .unwrap();

        assert!(scratch.0.refresh(APPIMAGE).unwrap());

        assert!(!shows_in_menu(&scratch.file().unwrap()));
    }

    #[test]
    fn a_file_that_names_the_running_appimage_is_not_touched() {
        let scratch = Scratch::new();
        scratch.0.add(APPIMAGE).unwrap();
        let path = scratch.0.desktop_file();
        let before = std::fs::metadata(&path).unwrap().modified().unwrap();
        let inode = std::os::unix::fs::MetadataExt::ino(&std::fs::metadata(&path).unwrap());

        assert!(!scratch.0.refresh(APPIMAGE).unwrap());

        let after = std::fs::metadata(&path).unwrap();
        assert_eq!(after.modified().unwrap(), before);
        assert_eq!(std::os::unix::fs::MetadataExt::ino(&after), inode);
    }

    #[test]
    fn launching_writes_nothing_the_player_did_not_ask_for() {
        let scratch = Scratch::new();

        assert!(!scratch.0.refresh(APPIMAGE).unwrap());

        assert!(!scratch.0.data.exists());
    }
}

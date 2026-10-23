// What the app writes to disk: a file replaced whole or not at all.

use std::io;
use std::path::Path;

/// Replaces a file's content, through a temporary file and a rename so a
/// reader (a desktop watching a directory, a launch that finds the app shut
/// down mid-write) never sees half of it. `false` when it already held
/// `bytes`: nothing is touched.
// Only the Linux launcher writes files that are not secrets
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn put(path: &Path, bytes: &[u8]) -> io::Result<bool> {
    replace(path, bytes, false)
}

/// `put` for a file that holds a secret: the temporary file is created
/// readable by its owner alone (0600) on Unix, so no moment exists when
/// another user could read it. Elsewhere the profile's own permissions apply.
pub fn put_private(path: &Path, bytes: &[u8]) -> io::Result<bool> {
    replace(path, bytes, true)
}

fn replace(path: &Path, bytes: &[u8], private: bool) -> io::Result<bool> {
    if std::fs::read(path).is_ok_and(|current| current == bytes) {
        return Ok(false);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("tmp");
    let written = create(&temporary, private).and_then(|mut file| {
        io::Write::write_all(&mut file, bytes)?;
        file.sync_all()
    });
    written
        .and_then(|()| std::fs::rename(&temporary, path))
        .inspect_err(|_| {
            let _ = std::fs::remove_file(&temporary);
        })?;
    Ok(true)
}

fn create(path: &Path, private: bool) -> io::Result<std::fs::File> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    if private {
        std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    }
    #[cfg(not(unix))]
    let _ = private;
    options.open(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("alltp-files-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn writes_through_a_rename_and_leaves_no_temporary_file() {
        let dir = scratch("put");
        let path = dir.join("nested/file.json");
        assert!(put(&path, b"one").unwrap());
        assert_eq!(std::fs::read(&path).unwrap(), b"one");
        assert!(put(&path, b"two").unwrap());
        assert_eq!(std::fs::read(&path).unwrap(), b"two");
        assert!(!path.with_extension("tmp").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn touches_nothing_when_the_content_is_the_same() {
        let dir = scratch("same");
        let path = dir.join("file");
        assert!(put(&path, b"same").unwrap());
        let before = std::fs::metadata(&path).unwrap().modified().unwrap();
        assert!(!put(&path, b"same").unwrap());
        assert!(!put_private(&path, b"same").unwrap());
        assert_eq!(
            std::fs::metadata(&path).unwrap().modified().unwrap(),
            before
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_private_file_is_readable_by_its_owner_alone() {
        use std::os::unix::fs::PermissionsExt;
        let dir = scratch("private");
        let path = dir.join("secret.json");
        assert!(put_private(&path, b"first").unwrap());
        assert_eq!(
            std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        // Replaced, it stays private
        assert!(put_private(&path, b"second").unwrap());
        assert_eq!(
            std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}

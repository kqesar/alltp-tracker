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

/// `put` for a file that holds a secret: the new file is created readable by
/// its owner alone (0600) on Unix, so no moment exists when another user could
/// read it, and it replaces one whose permissions were looser, a file that
/// already holds `bytes` included (its mode is corrected). Elsewhere the
/// profile's own permissions apply.
pub fn put_private(path: &Path, bytes: &[u8]) -> io::Result<bool> {
    replace(path, bytes, true)
}

fn replace(path: &Path, bytes: &[u8], private: bool) -> io::Result<bool> {
    if std::fs::read(path).is_ok_and(|current| current == bytes) {
        if private {
            owner_only(path);
        }
        return Ok(false);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("tmp");
    // Created new: a leftover (a crash mid-write) would keep its own, perhaps
    // looser, permissions, and a symlink would be followed
    let _ = std::fs::remove_file(&temporary);
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
    options.write(true).create_new(true);
    #[cfg(unix)]
    if private {
        std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    }
    #[cfg(not(unix))]
    let _ = private;
    options.open(path)
}

/// Makes an existing file readable by its owner alone (Unix), if it is not
/// already. A file that cannot be changed (a file system with no modes, one
/// owned by another user) is reported and left: the content is right, and a
/// failure here must not stop the stream from starting.
fn owner_only(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let loose = std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o077 != 0)
            .unwrap_or(false);
        if loose
            && let Err(error) =
                std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        {
            eprintln!("could not make {} private: {error}", path.display());
        }
    }
    #[cfg(not(unix))]
    let _ = path;
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

    #[cfg(unix)]
    #[test]
    fn a_private_file_replaces_a_looser_one_and_a_leftover_temporary_file() {
        use std::os::unix::fs::PermissionsExt;
        let mode = |path: &Path| std::fs::metadata(path).unwrap().permissions().mode() & 0o777;
        let dir = scratch("loose");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("secret.json");
        // A file left readable by everyone, and a crashed write's leftover
        std::fs::write(&path, b"old").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        let leftover = path.with_extension("tmp");
        std::fs::write(&leftover, b"half").unwrap();
        std::fs::set_permissions(&leftover, std::fs::Permissions::from_mode(0o666)).unwrap();

        assert!(put_private(&path, b"new").unwrap());

        assert_eq!(std::fs::read(&path).unwrap(), b"new");
        assert_eq!(mode(&path), 0o600);
        assert!(!leftover.exists());

        // The same content, still loose: the mode is corrected, nothing rewritten
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(!put_private(&path, b"new").unwrap());
        assert_eq!(mode(&path), 0o600);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_file_that_is_already_private_is_not_changed_again() {
        use std::os::unix::fs::MetadataExt;
        let dir = scratch("already");
        let path = dir.join("secret.json");
        assert!(put_private(&path, b"same").unwrap());
        let changed = |path: &Path| {
            let metadata = std::fs::metadata(path).unwrap();
            (metadata.ctime(), metadata.ctime_nsec())
        };
        let before = changed(&path);
        std::thread::sleep(std::time::Duration::from_millis(20));

        assert!(!put_private(&path, b"same").unwrap());

        // A chmod, even to the same mode, would have moved the inode's change time
        assert_eq!(changed(&path), before);
        let _ = std::fs::remove_dir_all(&dir);
    }
}

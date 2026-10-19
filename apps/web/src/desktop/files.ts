// Files the desktop app saves: its webview downloads nothing, so the app's
// save_file command (src-tauri/src/lib.rs) asks the system's Save dialog and
// writes the file where the player picks. The page can write nowhere else.

import { invoke } from "@tauri-apps/api/core";

/**
 * Save a file through the system's Save dialog.
 * @returns Whether it was saved: false when the player cancelled, or it failed
 */
export const saveOnDisk = (name: string, contents: string) =>
  invoke<boolean>("save_file", { contents, name }).catch((error: unknown) => {
    console.warn("Could not save the file:", error);
    return false;
  });

// The application menu entry of a Linux AppImage, which installs none: the
// desktop app (src-tauri/src/launcher.rs) writes a desktop file and icons when
// the player asks, and takes them away again. The page asks for the state and
// for a change, and offers it once (AppMenuPrompt) and from the More menu
// (AppMenuItem). Imported in the desktop build only.

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

/** What the app says: whether it can offer the entry, and whether it is there. */
export type AppMenuState = { available: boolean; added: boolean };

/** Set once the first-launch notice has been answered, or the entry changed. */
export const ASKED_KEY = "alltp-tracker-app-menu-asked";

const wasAsked = () => {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
};

const rememberAsked = () => {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Storage refused: the notice may come back at the next launch
  }
};

type AppMenuStore = {
  /** What the app said, null until it has (and always, if it cannot) */
  state: AppMenuState | null;
  /** The player has answered the first-launch notice, or changed the entry */
  asked: boolean;
  /** Why the last change failed */
  error: string | null;
  /** Ask the app how the entry stands. */
  load: () => Promise<void>;
  /** Add the entry or remove it. @returns Whether it worked */
  change: (added: boolean) => Promise<boolean>;
  /** The player has answered: the notice is not shown again. */
  answer: () => void;
};

/**
 * The menu entry's state, kept apart from the game stores: nothing here is a
 * run. Only the answer to the first-launch notice is saved, on this device.
 */
export const useAppMenuStore = create<AppMenuStore>()((set, get) => ({
  answer: () => {
    rememberAsked();
    set({ asked: true });
  },
  asked: wasAsked(),
  change: async (added) => {
    try {
      const state = await invoke<AppMenuState>("app_menu_set", { added });
      set({ error: null, state });
      get().answer();
      return true;
    } catch (error) {
      console.warn("Could not change the application menu:", error);
      set({ error: String(error) });
      return false;
    }
  },
  error: null,
  load: async () => {
    try {
      set({ state: await invoke<AppMenuState>("app_menu_state") });
    } catch (error) {
      console.warn("Could not read the application menu:", error);
    }
  },
  state: null,
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Keymap,
  restoreShortcuts,
  type ShortcutPrefs,
} from "@/games/alttpr/data/keymap";
import type { DesktopOs } from "@/games/alttpr/desktop/globalKeymap";

/** How the app registers global shortcuts on this system (its Rust side picks). */
export type MechanismKind = "command" | "hotkeys" | "portal";

/** What the app can do, as `global_shortcuts_ready` reports it. */
export type Mechanism = {
  kind: MechanismKind;
  os: DesktopOs;
  session: "wayland" | "x11" | null;
  portalVersion: number | null;
  /** The desktop can open its own shortcut settings (portal version 2) */
  configurable: boolean;
  /** The executable to put in a window manager's binding */
  command: string;
  /** Why the portal gave way to the command line, when it did */
  reason: string | null;
};

export type BindingStatus = "active" | "invalid" | "taken" | "unbound";

export type BindingReport = {
  action: string;
  status: BindingStatus;
  /** The desktop's own description of the key (portal) */
  trigger: string | null;
  message: string | null;
};

export type ReportState =
  | "active"
  | "idle"
  | "partial"
  | "refused"
  | "unavailable";

/** What the app made of the last set of bindings. */
export type Report = {
  state: ReportState;
  mechanism: Mechanism;
  bindings: BindingReport[];
};

/** Global shortcuts are opt-in: a global key is taken from every app. */
export const DEFAULT_GLOBAL: Readonly<ShortcutPrefs> = Object.freeze({
  enabled: false,
  keymap: {},
});

type GlobalState = ShortcutPrefs & {
  setGlobalEnabled: (enabled: boolean) => void;
  setGlobalKeymap: (keymap: Keymap) => void;
  /** What the app can do on this system, once it has said (not saved) */
  mechanism: Mechanism | null;
  /** What the app made of the last bindings (not saved) */
  report: Report | null;
  /** Why the last request to the app failed (not saved) */
  failure: string | null;
  /** The desktop is deciding on a bind: its dialog is open (not saved) */
  pending: boolean;
  /** A key is being captured in the Global tab, so no key is grabbed (not saved) */
  capturing: boolean;
};

/**
 * The desktop app's global shortcuts: the player's choices (saved on this
 * device under their own key: they are not part of a run, and a save file
 * must not carry keys the other machine may not allow) and what the app
 * reported (not saved). Kept apart from the game store, which the site
 * downloads: this file ships in the desktop build alone.
 */
export const useGlobalShortcutsStore = create<GlobalState>()(
  persist(
    (set): GlobalState => ({
      ...DEFAULT_GLOBAL,
      capturing: false,
      failure: null,
      mechanism: null,
      pending: false,
      report: null,
      setGlobalEnabled: (enabled) => set({ enabled }),
      setGlobalKeymap: (keymap) => set({ keymap }),
    }),
    {
      // Leniently, as the window shortcuts are: a malformed chord or an
      // unknown action is dropped, the rest is kept
      merge: (saved, current) => ({
        ...current,
        ...restoreShortcuts(saved, DEFAULT_GLOBAL),
      }),
      name: "alltp-tracker-global-shortcuts",
      partialize: ({ enabled, keymap }) => ({ enabled, keymap }),
      version: 1,
    },
  ),
);

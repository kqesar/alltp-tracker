import {
  type ActionId,
  type Chord,
  type Keymap,
  parseChord,
} from "@/games/alttpr/data/keymap";

/**
 * What a global chord may be. A global grab takes the key from every app, the
 * emulator and the chat included, so the rules are stricter than a window
 * shortcut's. The app's Rust side holds the floor (`shortcuts/chord.rs`): this
 * file is the player-facing version, with the reasons, and the rules that need
 * the player's system or keymap.
 */

/** Why a chord cannot be a global shortcut. */
export type GlobalRefusal =
  /** Not a key that can be grabbed */
  | "key"
  /** Would stop the player typing it in every app */
  | "typing"
  /** Windows reads AltGr as Ctrl+Alt */
  | "altgr"
  /** The tracker's own window already uses it */
  | "window";

/** The systems the desktop app runs on, as its Rust side names them. */
export type DesktopOs = "linux" | "macos" | "windows";

/**
 * The keys that can be grabbed: letters, digits, punctuation, the numpad and
 * the function keys. No `Intl*` code (the grabbing library cannot register
 * them), no `NumpadEqual` (it registers the letter E on Windows), and none of
 * the keys that keep their own job: Tab, Enter, Space, the arrows, Escape...
 */
const GLOBAL_CODE =
  /^(Key[A-Z]|Digit\d|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal)|F([1-9]|1\d|2[0-4]))$/;

/**
 * The numpad and F13 to F24 may stand alone. The numpad is not free of typing
 * (NumLock on, it types digits): it is allowed because binding is opt-in per
 * action and the precedent (LiveSplit's default global hotkeys are numpad
 * keys) shows players want it. The Global tab says what it costs.
 */
const FREE_CODE = /^(Numpad.+|F(1[3-9]|2[0-4]))$/;

/**
 * Why `chord` cannot be a global shortcut here, or null when it can.
 * @param chord - The chord, e.g. "Control+Alt+Shift+KeyH"
 * @param os - The system the app runs on
 * @param windowKeymap - The tracker window's own shortcuts
 */
export const globalRefusalOf = (
  chord: Chord,
  os: DesktopOs,
  windowKeymap: Keymap,
): GlobalRefusal | null => {
  const parsed = parseChord(chord);
  if (!parsed || !GLOBAL_CODE.test(parsed.code)) return "key";
  const { code, modifiers } = parsed;
  const free = FREE_CODE.test(code);

  // Two modifiers (so never Shift alone): a key that types a character must
  // not be taken from every other app by a single press. On macOS Option types
  // characters too (Option+E is the acute accent), so Ctrl or Cmd is needed
  if (!free && modifiers.length < 2) return "typing";
  if (
    !free &&
    os === "macos" &&
    !modifiers.includes("Control") &&
    !modifiers.includes("Meta")
  ) {
    return "typing";
  }
  if (
    !free &&
    os === "windows" &&
    modifiers.length === 2 &&
    modifiers.includes("Control") &&
    modifiers.includes("Alt")
  ) {
    return "altgr";
  }
  return windowHolderOf(windowKeymap, chord) ? "window" : null;
};

/** The window shortcut that already holds `chord`, if any. */
export const windowHolderOf = (
  windowKeymap: Keymap,
  chord: Chord,
): ActionId | undefined =>
  (Object.entries(windowKeymap) as [ActionId, Chord][]).find(
    ([, held]) => held === chord,
  )?.[0];

import {
  type Chord,
  type Modifier,
  parseChord,
} from "@/games/alttpr/data/keymap";
import { altKey, isApplePlatform } from "@/utils/platform";

/**
 * What each physical key (`KeyboardEvent.code`) types on the player's layout,
 * as `navigator.keyboard.getLayoutMap()` reports it: `KeyQ` → "a" on AZERTY.
 */
export type LayoutMap = ReadonlyMap<string, string>;

/** Labels for keys that are not a letter or a digit, as a US keyboard prints them. */
const FALLBACK_LABELS: Record<string, string> = {
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Equal: "=",
  IntlBackslash: "\\",
  IntlRo: "\\",
  IntlYen: "¥",
  Minus: "-",
  NumpadAdd: "Num +",
  NumpadDecimal: "Num .",
  NumpadDivide: "Num /",
  NumpadMultiply: "Num *",
  NumpadSubtract: "Num -",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
};

/**
 * The label of a physical key: what it types on the player's layout when the
 * browser says, else what a US keyboard prints on it. Letters are upper case,
 * as on the keycap.
 * @param code - The key's `KeyboardEvent.code`, e.g. "KeyQ"
 * @param layout - The layout map, when the browser gave one
 */
export const keyLabel = (code: string, layout?: LayoutMap | null): string => {
  const typed = layout?.get(code)?.trim();
  if (typed) {
    // Upper case unless that changes the length: "ß" stays "ß", not "SS"
    const upper = typed.toUpperCase();
    return upper.length === typed.length ? upper : typed;
  }
  const letterOrDigit = /^(?:Key|Digit)(.)$/.exec(code);
  if (letterOrDigit) return letterOrDigit[1];
  const numpadDigit = /^Numpad(\d)$/.exec(code);
  if (numpadDigit) return `Num ${numpadDigit[1]}`;
  return FALLBACK_LABELS[code] ?? code;
};

/** A modifier as its keycap names it. */
const modifierLabel = (modifier: Modifier): string => {
  switch (modifier) {
    case "Alt":
      return altKey();
    case "Control":
      return "Ctrl";
    case "Meta":
      return isApplePlatform() ? "Cmd" : "Win";
    case "Shift":
      return "Shift";
  }
};

/**
 * The keys of a chord, one label each, modifiers first: `["Shift", "W"]`.
 * @param chord - The chord, e.g. "Shift+KeyW"
 * @param layout - The layout map, when the browser gave one
 */
export const chordKeys = (chord: Chord, layout?: LayoutMap | null) => {
  const parsed = parseChord(chord);
  if (!parsed) return [chord];
  return [
    ...parsed.modifiers.map(modifierLabel),
    keyLabel(parsed.code, layout),
  ];
};

/** A chord as text, for messages and accessible names: "Shift+W". */
export const chordText = (chord: Chord, layout?: LayoutMap | null) =>
  chordKeys(chord, layout).join("+");

/**
 * A chord in `aria-keyshortcuts` syntax: the ARIA modifier names, then the
 * key value it types ("Shift+W"). Null for a key whose value would break the
 * syntax (a "+", a space) or that types nothing, such as a numpad operator:
 * the dialog still lists it.
 */
export const ariaChord = (
  chord: Chord,
  layout?: LayoutMap | null,
): string | null => {
  const parsed = parseChord(chord);
  if (!parsed) return null;
  const numpadDigit = /^Numpad(\d)$/.exec(parsed.code);
  const key = numpadDigit ? numpadDigit[1] : keyLabel(parsed.code, layout);
  if ([...key].length !== 1 || key === "+" || key.trim() === "") return null;
  return [...parsed.modifiers, key].join("+");
};

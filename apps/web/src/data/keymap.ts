import { LEGACY_DUNGEONS } from "@alltp/pack-alttpr";
import { DUNGEON_INDICES } from "@/constants";
import { defaultItemGrid, isKeyCell, itemLabels } from "@/data/items";
import {
  dungeonName,
  KEY_DUNGEONS,
  ownItems,
  smallKeysMax,
} from "@/logic/settings";

/**
 * The keyboard shortcuts of the item grid, as plain data: which key steps
 * which control, and which way. Nothing here touches the DOM, so the desktop
 * app can register the same keymap as global hotkeys.
 */

/** Which way a shortcut steps a control: as a click does, or a right-click. */
export type ShortcutDirection = "advance" | "back";

/**
 * A control of the item grid: an item id (`hookshot`, `boss3`, `chest3`,
 * `reward3`, `bigkey3`), or `smallkey3` and `medallion8`, which the store
 * keeps outside `items`.
 */
export type ControlId = string;

/** A control and a direction: `advance:hookshot`, `back:chest3`. */
export type ActionId = `${ShortcutDirection}:${ControlId}`;

/**
 * A key and the modifiers held with it, written as an accelerator:
 * `Alt+Shift+KeyQ`. Modifiers come first, in the order of `MODIFIERS`, then
 * the key's `KeyboardEvent.code`. The code names the physical key, so a
 * binding stays on the same key whatever the layout (QWERTY, AZERTY, QWERTZ).
 */
export type Chord = string;

/** Action → chord. An action left out has no shortcut. */
export type Keymap = Partial<Record<ActionId, Chord>>;

/** The shortcut preferences of this device. */
export type ShortcutPrefs = {
  /** The master switch: off, no key does anything */
  enabled: boolean;
  keymap: Keymap;
};

/** Modifier names, in the order a chord spells them. */
export const MODIFIERS = ["Control", "Alt", "Shift", "Meta"] as const;

export type Modifier = (typeof MODIFIERS)[number];

/** Every grid cell holding an item, as opposed to a dungeon or an empty cell. */
const isItemCell = (id: string) =>
  Boolean(id) && id !== "blank" && !id.startsWith("boss") && !isKeyCell(id);

/** The grid's items, in reading order. */
export const ITEM_CONTROLS: readonly ControlId[] = defaultItemGrid
  .flat()
  .filter(isItemCell);

/** Whether a dungeon's boss cell carries a medallion picker. */
const hasMedallion = (index: number) =>
  index === DUNGEON_INDICES.MISERY_MIRE ||
  index === DUNGEON_INDICES.TURTLE_ROCK;

/** Ganon's Tower's key index, whose boss cell holds Agahnim 2. */
const TOWER = KEY_DUNGEONS.indexOf("ganons-tower");

/**
 * A dungeon's controls: the boss cell's (boss, medallion, chests, reward),
 * for the grid's ten; Ganon's Tower's (Agahnim 2 and its chests); then the
 * key cell's, as its pool holds them (big key, small keys: not Eastern
 * Palace's; map and compass, shown while they leave their dungeons).
 * Hyrule Castle and Castle Tower have a key cell only.
 * @param index - The key dungeon index (0-12, KEY_DUNGEONS)
 */
export const dungeonControls = (index: number): ControlId[] => {
  const own = ownItems(index);
  return [
    ...(index < LEGACY_DUNGEONS.length
      ? [
          `boss${index}`,
          ...(hasMedallion(index) ? [`medallion${index}`] : []),
          `chest${index}`,
          `reward${index}`,
        ]
      : []),
    ...(index === TOWER ? ["agahnim2", `chest${index}`] : []),
    ...(own.bigKey ? [`bigkey${index}`] : []),
    ...(smallKeysMax(index) > 0 ? [`smallkey${index}`] : []),
    ...(own.map ? [`map${index}`] : []),
    ...(own.compass ? [`compass${index}`] : []),
  ];
};

/** Every control a shortcut can step: the items, then dungeon by dungeon. */
export const CONTROLS: readonly ControlId[] = [
  ...ITEM_CONTROLS,
  ...KEY_DUNGEONS.flatMap((_, index) => dungeonControls(index)),
];

/** Every action, forward then back for each control. */
export const ACTIONS: readonly ActionId[] = CONTROLS.flatMap((control) => [
  `advance:${control}` as const,
  `back:${control}` as const,
]);

const KNOWN_ACTIONS = new Set<string>(ACTIONS);

/** Split an action into the control it steps and the direction. */
export const parseAction = (
  action: ActionId,
): { control: ControlId; direction: ShortcutDirection } => {
  const separator = action.indexOf(":");
  return {
    control: action.slice(separator + 1),
    direction: action.slice(0, separator) as ShortcutDirection,
  };
};

/** A control of a key cell, which is on screen only while key cells are. */
export const isKeyControl = (control: ControlId) =>
  /^(bigkey|smallkey|map|compass)\d+$/.test(control);

/**
 * A control of a key cell drawn only when maps and compasses lie outside
 * their dungeons: a dungeon's map and compass, which its boss wants then.
 */
export const isMapCompassControl = (control: ControlId) =>
  /^(map|compass)\d+$/.test(control);

/** What each kind of dungeon control is called within its dungeon. */
const DUNGEON_CONTROL_NAMES: Record<string, string> = {
  bigkey: "Big key",
  boss: "Boss",
  chest: "Chests",
  compass: "Compass",
  map: "Map",
  medallion: "Medallion",
  reward: "Reward",
  smallkey: "Small keys",
};

const DUNGEON_CONTROL =
  /^(bigkey|boss|chest|compass|map|medallion|reward|smallkey)(\d+)$/;

/** The index of the dungeon a control belongs to, or null for an item. */
export const dungeonOf = (control: ControlId): number | null => {
  const match = DUNGEON_CONTROL.exec(control);
  return match ? Number(match[2]) : null;
};

/**
 * A control's name where its dungeon is already said (a dialog section, a
 * dungeon's tooltip): "Chests", "Boss"; an item's own name.
 */
export const controlName = (control: ControlId): string => {
  const match = DUNGEON_CONTROL.exec(control);
  return match ? DUNGEON_CONTROL_NAMES[match[1]] : itemLabels(control);
};

/**
 * A control's name on its own: "Hookshot", "Eastern Palace chests". The boss
 * is named after its dungeon, which stays true when bosses are shuffled.
 */
export const controlTitle = (control: ControlId): string => {
  const index = dungeonOf(control);
  if (index === null) return itemLabels(control);
  return `${dungeonName(index)} ${controlName(control).toLowerCase()}`;
};

/**
 * The default layout mirrors the grid on the keyboard, by physical key. The
 * grid's item block is five columns wide, as is each hand on the letter
 * keys; its five rows run down the left hand (the Q, A and Z rows) and go on
 * at the top of the right hand (the Y and H rows), column for column, like
 * text in two newspaper columns. The four items beside the block take the
 * right hand's bottom row, in reading order.
 */
const ITEM_BLOCK_KEYS = [
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"],
  ["KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
  ["KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"],
];
const BESIDE_BLOCK_KEYS = ["KeyN", "KeyM", "Comma", "Period"];
const ITEM_BLOCK_WIDTH = 5;

/** Each grid item's default key, by the newspaper-column rule above. */
const itemKeys = (): [ControlId, string][] => {
  const block: [ControlId, string][] = [];
  const beside: ControlId[] = [];
  defaultItemGrid.forEach((row, rowIndex) => {
    row.forEach((id, colIndex) => {
      if (!isItemCell(id)) return;
      const code = ITEM_BLOCK_KEYS[rowIndex]?.[colIndex];
      if (colIndex < ITEM_BLOCK_WIDTH && code) block.push([id, code]);
      else beside.push(id);
    });
  });
  return [
    ...block,
    ...beside.flatMap((id, index): [ControlId, string][] =>
      BESIDE_BLOCK_KEYS[index] ? [[id, BESIDE_BLOCK_KEYS[index]]] : [],
    ),
  ];
};

/**
 * Dungeon chests, the control a run clicks most, are on the digits: 1 to 0
 * are the ten dungeons in the grid's order, which is the game's (Eastern
 * Palace 1, Desert Palace 2, ... Turtle Rock 0).
 */
const chestKeys = (): [ControlId, string][] =>
  LEGACY_DUNGEONS.map((_, index) => [
    `chest${index}`,
    `Digit${(index + 1) % 10}`,
  ]);

/**
 * The keymap of a first visit: a key steps its control forward as a click
 * does, and Shift with the same key steps it back as a right-click does.
 */
export const DEFAULT_KEYMAP: Readonly<Keymap> = Object.freeze(
  Object.fromEntries(
    [...itemKeys(), ...chestKeys()].flatMap(([control, code]) => [
      [`advance:${control}`, code],
      [`back:${control}`, `Shift+${code}`],
    ]),
  ) as Keymap,
);

export const DEFAULT_SHORTCUTS: Readonly<ShortcutPrefs> = Object.freeze({
  enabled: true,
  keymap: DEFAULT_KEYMAP,
});

/** The keys that only modify another key. */
const MODIFIER_KEY =
  /^(Shift|Control|Alt|AltGraph|Meta|OS|Super|Hyper|Fn|FnLock|CapsLock|NumLock|ScrollLock|Symbol|SymbolLock)$/;

/** The parts of a keyboard event a chord is read from. */
export type KeyPress = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

/**
 * The chord a key press makes, or null for a modifier pressed alone and for
 * an event that names no physical key (some on-screen keyboards).
 * @param event - The keydown event
 */
export const chordOf = (event: KeyPress): Chord | null => {
  if (!event.code || MODIFIER_KEY.test(event.key)) return null;
  if (/^(Shift|Control|Alt|Meta|OS)(Left|Right)$/.test(event.code)) {
    return null;
  }
  const held: Record<Modifier, boolean> = {
    Alt: event.altKey,
    Control: event.ctrlKey,
    Meta: event.metaKey,
    Shift: event.shiftKey,
  };
  return [...MODIFIERS.filter((modifier) => held[modifier]), event.code].join(
    "+",
  );
};

/**
 * A chord's modifiers and key, or null when it is not written in the
 * canonical form (known modifiers, each once, in order; then a code).
 */
export const parseChord = (
  chord: Chord,
): { modifiers: Modifier[]; code: string } | null => {
  const parts = chord.split("+");
  const code = parts.pop() ?? "";
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(code)) return null;
  let previous = -1;
  for (const part of parts) {
    const index = MODIFIERS.indexOf(part as Modifier);
    if (index <= previous) return null;
    previous = index;
  }
  return { code, modifiers: parts as Modifier[] };
};

/**
 * Keys a browser shortcut may use: they type a character, or do nothing,
 * outside a text field. Everything else keeps its own job in the page or the
 * browser: Tab, Enter, Space, Escape, the arrows, Home / End, Backspace,
 * F1-F12 (help, find, reload, full screen, developer tools)... Minus is left
 * out too: it steps the focused grid cell back.
 */
const BINDABLE_CODE =
  /^(Key[A-Z]|Digit\d|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal)|F(1[3-9]|2[0-4])|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen)$/;

/**
 * With Alt, the keys browsers on Windows and Linux keep: tab switching
 * (Alt+1 to 9), the address bar (Alt+D) and the menus (Alt+E, Alt+F, and
 * Firefox's menu bar: Alt+B, H, S, T, V), plus Alt+Shift+A, I and T.
 */
const ALT_RESERVED_CODE = /^(Digit\d|Key[ABDEFHISTV])$/;

/** Why a chord cannot be a shortcut in the browser. */
export type Refusal =
  /** Malformed, or a key that keeps its own job (Tab, Enter, F5...) */
  | "key"
  /** A chord the browser or the system owns (Ctrl/Cmd+R, Alt+D...) */
  | "browser";

/**
 * Why `chord` cannot be a shortcut here, or null when it can. Ctrl and Cmd
 * chords are never taken: the browser and the system own them, Ctrl/Cmd+Z
 * and Y included, which undo and redo.
 * @param chord - The chord, e.g. "Shift+KeyQ"
 */
export const refusalOf = (chord: Chord): Refusal | null => {
  const parsed = parseChord(chord);
  if (!parsed || !BINDABLE_CODE.test(parsed.code)) return "key";
  const { modifiers, code } = parsed;
  if (modifiers.includes("Control") || modifiers.includes("Meta")) {
    return "browser";
  }
  if (modifiers.includes("Alt") && ALT_RESERVED_CODE.test(code)) {
    return "browser";
  }
  return null;
};

/** Whether `chord` can be a shortcut in the browser. */
export const isBindable = (chord: Chord) => refusalOf(chord) === null;

/** The action `chord` is bound to, if any. */
export const actionFor = (keymap: Keymap, chord: Chord): ActionId | undefined =>
  ACTIONS.find((action) => keymap[action] === chord);

/**
 * The other action that already holds `chord`, if binding it to `action`
 * would take it away from one.
 */
export const conflictOf = (
  keymap: Keymap,
  action: ActionId,
  chord: Chord,
): ActionId | undefined => {
  const holder = actionFor(keymap, chord);
  return holder === action ? undefined : holder;
};

/** What happens to the action that held a chord being bound elsewhere. */
export type Resolution =
  /** It takes the chord the rebound action had (or none, if it had none) */
  | "swap"
  /** It loses its shortcut */
  | "replace";

/**
 * A keymap where `action` is bound to `chord`; no chord is ever bound twice.
 * @param resolution - What happens to the action that held `chord` before
 */
export const bind = (
  keymap: Keymap,
  action: ActionId,
  chord: Chord,
  resolution: Resolution = "replace",
): Keymap => {
  const next: Keymap = { ...keymap, [action]: chord };
  const holder = conflictOf(keymap, action, chord);
  if (holder) {
    const previous = keymap[action];
    if (resolution === "swap" && previous) next[holder] = previous;
    else delete next[holder];
  }
  return next;
};

/** A keymap where `action` has no shortcut. */
export const unbind = (keymap: Keymap, action: ActionId): Keymap => {
  const next = { ...keymap };
  delete next[action];
  return next;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Saved shortcut preferences laid over `base`, leniently: a field of the
 * wrong type keeps `base`'s value; in the keymap, unknown actions, malformed
 * chords and the second binding of a chord bound twice are dropped. Chords
 * the browser cannot use are kept, for the desktop app; the browser listener
 * ignores them.
 * @param saved - What a save holds under `shortcuts`
 * @param base - The preferences to fall back on
 */
export const restoreShortcuts = (
  saved: unknown,
  base: ShortcutPrefs,
): ShortcutPrefs => {
  if (!isRecord(saved)) return base;
  const enabled =
    typeof saved.enabled === "boolean" ? saved.enabled : base.enabled;
  if (!isRecord(saved.keymap)) return { enabled, keymap: base.keymap };

  const keymap: Keymap = {};
  const taken = new Set<string>();
  for (const [action, chord] of Object.entries(saved.keymap)) {
    if (!KNOWN_ACTIONS.has(action) || typeof chord !== "string") continue;
    if (!parseChord(chord) || taken.has(chord)) continue;
    taken.add(chord);
    keymap[action as ActionId] = chord;
  }
  return { enabled, keymap };
};

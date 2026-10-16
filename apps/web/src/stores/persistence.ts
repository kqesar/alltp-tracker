import {
  LEGACY_CHESTS,
  LEGACY_DUNGEON_ITEMS,
  MARKERS,
} from "@alltp/pack-alttpr";
import {
  BOSS_STATES,
  MEDALLION_VALUES,
  SMALL_KEYS_MAX_BY_INDEX,
} from "@/constants";
import type { ItemState } from "@/data/items";
import { items as freshItems, itemsMax, itemsMin } from "@/data/items";
import { DEFAULT_SHORTCUTS, type ShortcutPrefs } from "@/data/keymap";
import {
  DEFAULT_PRESET_ID,
  ENTRANCE_LABELS,
  GOAL_LABELS,
  getPreset,
  MODE_LABELS,
  presets,
  type RunSettings,
} from "@/data/presets";
import { counterMax } from "@/logic/settings";
import type { MapLayout } from "@/utils";

/**
 * The locations the player checked on the map, by the alttpr pack's ids
 * (`kings-tomb`, `kakariko-well/top`). A location left out is not checked.
 * A dungeon's own locations are counted by its counter instead.
 */
export type Checked = Readonly<Record<string, true>>;

/** The run in progress: everything "New game" clears. */
export type Progress = {
  /**
   * Keyed by the tracker's item ids. A dungeon's `chestN` counts the items
   * it has left, from `counterMax` for the run's settings down to 0.
   */
  items: ItemState;
  checked: Checked;
  medallions: number[];
  smallKeys: number[];
  presetId: string;
  settings: RunSettings;
};

/**
 * How this device shows and drives the tracker. Preferences survive a new
 * game, a preset switch and an import: a save moved from a desktop to a phone
 * keeps the phone's layout.
 */
export type Prefs = {
  bigKeysVisible: boolean;
  mapLayout: MapLayout;
  /**
   * Keyboard shortcuts: one self-contained object, apart from the run, so a
   * later save format (or the desktop app) can carry it as it is.
   */
  shortcuts: ShortcutPrefs;
};

/** The game a save is for: the one game pack the tracker has today. */
export const GAME = "alttpr";

/** What localStorage holds: the run, this device's preferences, the game. */
export type PersistedState = Progress & Prefs & { game: typeof GAME };

/** A plain object, as opposed to null, an array or a primitive. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Bumped whenever PersistedState changes shape; `migrate` upgrades older saves. */
export const PERSIST_VERSION = 6;

/** Length of the chest table before version 3. */
const V2_CHEST_COUNT = 65;

/** The second "West of Sanctuary" entry, removed in version 3. */
const DUPLICATE_CHEST_INDEX = 19;

/**
 * Version 1 stored a boss's "beaten" flag twice: `items.bossN` from the grid
 * and `dungeonsBeaten[n]` from the map, never kept in sync. A boss beaten on
 * either side is beaten.
 */
const migrateV1 = (saved: Record<string, unknown>): Record<string, unknown> => {
  const { dungeonsBeaten, ...rest } = saved;
  if (!Array.isArray(dungeonsBeaten)) return rest;

  const items = { ...(rest.items as Record<string, unknown> | undefined) };
  dungeonsBeaten.forEach((beaten, index) => {
    if (beaten === true) items[`boss${index}`] = BOSS_STATES.BEATEN;
  });
  return { ...rest, items };
};

/**
 * Up to version 2 the chest table listed West of Sanctuary twice (indices 18
 * and 19, the second added by the React port). Version 3 drops index 19: every
 * later chest moves up one, and the remaining entry counts as opened if either
 * copy was. Keyed on the length, so a save of any older shape is caught.
 */
const migrateV2 = (saved: Record<string, unknown>): Record<string, unknown> => {
  const opened = saved.chestsOpened;
  if (!Array.isArray(opened) || opened.length !== V2_CHEST_COUNT) return saved;

  const chestsOpened = opened.filter(
    (_, index) => index !== DUPLICATE_CHEST_INDEX,
  );
  chestsOpened[DUPLICATE_CHEST_INDEX - 1] =
    opened[DUPLICATE_CHEST_INDEX - 1] === true ||
    opened[DUPLICATE_CHEST_INDEX] === true;
  return { ...saved, chestsOpened };
};

/**
 * Until version 3 "side-by-side" was the only map layout besides "stacked",
 * and the default, so a saved "side-by-side" is rarely a choice. Version 4
 * adds "auto" (side by side while there is room, stacked below) and moves
 * those saves to it; "stacked" was chosen and stays.
 */
const migrateV3 = (saved: Record<string, unknown>): Record<string, unknown> =>
  saved.mapLayout === "side-by-side" ? { ...saved, mapLayout: "auto" } : saved;

/**
 * Version 5 adds keyboard shortcuts to the preferences. A save from before
 * has none: it gets the default keymap, switched on, as a first visit does.
 */
const migrateV4 = (saved: Record<string, unknown>): Record<string, unknown> =>
  "shortcuts" in saved ? saved : { ...saved, shortcuts: DEFAULT_SHORTCUTS };

/**
 * Version 6 runs on the alttpr pack. Its map marks locations, by the pack's
 * ids, where version 5 kept one flag per chest marker: each opened marker
 * checks every location the pack's legacy table says it stood for, all the
 * chests of a cave included; "Bridge", where the randomizer places nothing,
 * checks none. With keysanity a dungeon counter now counts every location,
 * so the items found carry over, not the items left. The rest keeps its
 * shape.
 */
const migrateV5 = (saved: Record<string, unknown>): Record<string, unknown> => {
  const { chestsOpened, ...rest } = saved;
  const migrated: Record<string, unknown> = { ...rest };
  if (Array.isArray(chestsOpened)) {
    const checked: Record<string, true> = {};
    chestsOpened.forEach((opened, index) => {
      if (opened !== true) return;
      for (const id of LEGACY_CHESTS[index]?.locations ?? [])
        checked[id] = true;
    });
    migrated.checked = checked;
  }
  const run = isRunSettings(rest.settings) ? rest.settings : undefined;
  if (run?.keysanity && isRecord(rest.items)) {
    const items = { ...rest.items };
    LEGACY_DUNGEON_ITEMS.forEach((legacyMax, index) => {
      const left = items[`chest${index}`];
      if (!isIntIn(left, 0, legacyMax)) return;
      items[`chest${index}`] = Math.max(
        0,
        counterMax(index, run) - (legacyMax - left),
      );
    });
    migrated.items = items;
  }
  return migrated;
};

/**
 * Upgrade a save written by an earlier version to the current shape. Fields
 * are not validated here; restoring a save falls back field by field.
 * @param saved - The stored or imported object
 * @param version - The version it was written with
 */
export const migrate = (
  saved: unknown,
  version: number,
): Partial<PersistedState> => {
  if (!isRecord(saved)) return {};
  let state = saved;
  if (version < 2) state = migrateV1(state);
  if (version < 3) state = migrateV2(state);
  if (version < 4) state = migrateV3(state);
  if (version < 5) state = migrateV4(state);
  if (version < 6) state = migrateV5(state);
  return state as Partial<PersistedState>;
};

/** An array of `length` entries that each pass `check`. */
const isArrayOf = (
  value: unknown,
  length: number,
  check: (entry: unknown, index: number) => boolean,
): value is unknown[] =>
  Array.isArray(value) && value.length === length && value.every(check);

/** A whole number within [min, max]. */
const isIntIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

/** A dungeon counter's item id, and its dungeon index. */
const COUNTER = /^chest(\d)$/;

/**
 * The range of an item's values in a run: a dungeon counter's top depends
 * on the run's settings (keysanity counts more), the rest is fixed.
 */
export const itemRange = (
  id: string,
  run: RunSettings,
): readonly [number, number] => {
  const counter = COUNTER.exec(id);
  return counter
    ? [0, counterMax(Number(counter[1]), run)]
    : [itemsMin[id], itemsMax[id]];
};

/** Keep the saved items this version tracks and that hold a legal value. */
const validateItems = (
  saved: Record<string, unknown>,
  run: RunSettings,
  errors: string[],
): Partial<ItemState> => {
  const valid: Record<string, number | boolean> = {};
  for (const [id, value] of Object.entries(saved)) {
    const fresh = freshItems[id];
    // An item this version no longer tracks: ignore it rather than fail
    if (fresh === undefined) continue;
    const [min, max] = itemRange(id, run);
    if (typeof fresh === "boolean") {
      if (typeof value === "boolean") valid[id] = value;
      else errors.push(`items.${id} must be true or false`);
    } else if (isIntIn(value, min, max)) {
      valid[id] = value;
    } else {
      errors.push(`items.${id} must be a whole number from ${min} to ${max}`);
    }
  }
  return valid as Partial<ItemState>;
};

/** Every location the map can check: every check of the world. */
const LOCATIONS: ReadonlySet<string> = new Set(
  MARKERS.flatMap((marker) => marker.locations),
);

/** Keep the checked locations this version knows, each marked `true`. */
const validateChecked = (
  saved: Record<string, unknown>,
  errors: string[],
): Checked => {
  const valid: Record<string, true> = {};
  for (const [id, value] of Object.entries(saved)) {
    if (value !== true) errors.push(`checked["${id}"] must be true`);
    // A location this version does not know: ignore it rather than fail
    else if (LOCATIONS.has(id)) valid[id] = true;
  }
  return valid;
};

/** Run settings whose every field names a known option. */
const isRunSettings = (value: unknown): value is RunSettings =>
  isRecord(value) &&
  typeof value.keysanity === "boolean" &&
  typeof value.mode === "string" &&
  value.mode in MODE_LABELS &&
  typeof value.goal === "string" &&
  value.goal in GOAL_LABELS &&
  typeof value.entranceShuffle === "string" &&
  value.entranceShuffle in ENTRANCE_LABELS;

/**
 * Check a saved run, already migrated to the current shape, field by field
 * against the current tables.
 * @param fallback - The run settings a save without valid ones is restored
 * with, which its dungeon counters are checked against
 * @returns The fields that passed, and one message per field that did not.
 * Absent fields are neither: restoring falls back to a fresh value for them.
 */
export const validateProgress = (
  saved: Record<string, unknown>,
  fallback: RunSettings = getPreset(DEFAULT_PRESET_ID).settings,
): { value: Partial<Progress>; errors: string[] } => {
  const value: Partial<Progress> = {};
  const errors: string[] = [];

  if (saved.settings !== undefined) {
    if (isRunSettings(saved.settings)) value.settings = saved.settings;
    else
      errors.push("settings must name a known mode, goal and entrance shuffle");
  }

  if (saved.items !== undefined) {
    if (isRecord(saved.items)) {
      value.items = validateItems(
        saved.items,
        value.settings ?? fallback,
        errors,
      ) as ItemState;
    } else errors.push("items must be an object");
  }

  if (saved.checked !== undefined) {
    if (isRecord(saved.checked)) {
      value.checked = validateChecked(saved.checked, errors);
    } else errors.push("checked must be an object");
  }

  if (saved.medallions !== undefined) {
    if (
      isArrayOf(saved.medallions, 10, (medallion) =>
        isIntIn(medallion, MEDALLION_VALUES.UNKNOWN, MEDALLION_VALUES.QUAKE),
      )
    ) {
      value.medallions = saved.medallions as number[];
    } else errors.push("medallions must hold 10 values from 0 to 3");
  }

  if (saved.smallKeys !== undefined) {
    if (
      isArrayOf(saved.smallKeys, 10, (count, index) =>
        isIntIn(count, 0, SMALL_KEYS_MAX_BY_INDEX[index]),
      )
    ) {
      value.smallKeys = saved.smallKeys as number[];
    } else
      errors.push("smallKeys must hold 10 counts within each dungeon's keys");
  }

  if (saved.presetId !== undefined) {
    if (presets.some((preset) => preset.id === saved.presetId)) {
      value.presetId = saved.presetId as string;
    } else
      errors.push(
        `presetId "${String(saved.presetId)}" is not a known run type`,
      );
  }

  return { errors, value };
};

/** Marks a file written by exportState. */
export const SAVE_FORMAT = "alltp-tracker-save";

/** The contents of an exported save file: the run, and the game it is of. */
export const toSaveFile = (progress: Progress) => ({
  format: SAVE_FORMAT,
  game: GAME,
  progress,
  version: PERSIST_VERSION,
});

/** What reading a save file produced. */
export type ParsedSave =
  | { ok: true; progress: Partial<Progress> }
  | { ok: false; reason: string };

/**
 * Read an exported save without applying it: unwrap, migrate and validate.
 * Accepts the current file format and the bare objects older versions wrote.
 * @param json - The file's text
 */
export const parseSave = (json: string): ParsedSave => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "This file is not valid JSON." };
  }
  const notASave = {
    ok: false,
    reason: "This file is not a tracker save.",
  } as const;
  if (!isRecord(parsed)) return notASave;

  const isSaveFile = parsed.format === SAVE_FORMAT;
  // Bare exports predate the file format: version 1 is the one that kept
  // `dungeonsBeaten`, anything else was written by version 2.
  const version = isSaveFile
    ? parsed.version
    : "dungeonsBeaten" in parsed
      ? 1
      : 2;
  if (!Number.isInteger(version)) return notASave;
  if ((version as number) > PERSIST_VERSION) {
    return {
      ok: false,
      reason: "This save was written by a newer version of the tracker.",
    };
  }
  // Files before version 6 name no game: they are all of A Link to the Past
  if (isSaveFile && "game" in parsed && parsed.game !== GAME) {
    return {
      ok: false,
      reason: "This save is of a game this tracker does not track.",
    };
  }

  const migrated = migrate(
    isSaveFile ? parsed.progress : parsed,
    version as number,
  );
  const { value, errors } = validateProgress(migrated);
  if (errors.length > 0) {
    return {
      ok: false,
      reason: `This save holds invalid data: ${errors.join("; ")}.`,
    };
  }
  if (Object.keys(value).length === 0) return notASave;
  return { ok: true, progress: value };
};

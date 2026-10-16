import {
  BOSS_STATES,
  MEDALLION_VALUES,
  SMALL_KEYS_MAX_BY_INDEX,
} from "@/constants";
import { chests } from "@/data/chests";
import { items as freshItems, itemsMax, itemsMin } from "@/data/items";
import type { ItemState } from "@/data/logic";
import {
  ENTRANCE_LABELS,
  GOAL_LABELS,
  MODE_LABELS,
  presets,
  type RunSettings,
} from "@/data/presets";
import type { MapLayout } from "@/utils";

/** The run in progress: everything "New game" clears. */
export type Progress = {
  items: ItemState;
  /** One flag per overworld chest, in the order of the chest table */
  chestsOpened: boolean[];
  medallions: number[];
  smallKeys: number[];
  presetId: string;
  settings: RunSettings;
};

/**
 * How this device shows the tracker. Preferences survive a new game, a preset
 * switch and an import: a save moved from a desktop to a phone keeps the
 * phone's layout.
 */
export type Prefs = {
  bigKeysVisible: boolean;
  mapLayout: MapLayout;
};

/** What localStorage holds and what a save file carries. */
export type PersistedState = Progress & Prefs;

/** A plain object, as opposed to null, an array or a primitive. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Bumped whenever PersistedState changes shape; `migrate` upgrades older saves. */
export const PERSIST_VERSION = 4;

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

/** Keep the saved items this version tracks and that hold a legal value. */
const validateItems = (
  saved: Record<string, unknown>,
  errors: string[],
): Partial<ItemState> => {
  const valid: Record<string, number | boolean> = {};
  for (const [id, value] of Object.entries(saved)) {
    const fresh = freshItems[id];
    // An item this version no longer tracks: ignore it rather than fail
    if (fresh === undefined) continue;
    if (typeof fresh === "boolean") {
      if (typeof value === "boolean") valid[id] = value;
      else errors.push(`items.${id} must be true or false`);
    } else if (isIntIn(value, itemsMin[id], itemsMax[id])) {
      valid[id] = value;
    } else {
      errors.push(
        `items.${id} must be a whole number from ${itemsMin[id]} to ${itemsMax[id]}`,
      );
    }
  }
  return valid as Partial<ItemState>;
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
 * @returns The fields that passed, and one message per field that did not.
 * Absent fields are neither: restoring falls back to a fresh value for them.
 */
export const validateProgress = (
  saved: Record<string, unknown>,
): { value: Partial<Progress>; errors: string[] } => {
  const value: Partial<Progress> = {};
  const errors: string[] = [];

  if (saved.items !== undefined) {
    if (isRecord(saved.items)) {
      value.items = validateItems(saved.items, errors) as ItemState;
    } else errors.push("items must be an object");
  }

  if (saved.chestsOpened !== undefined) {
    if (
      isArrayOf(
        saved.chestsOpened,
        chests.length,
        (opened) => typeof opened === "boolean",
      )
    ) {
      value.chestsOpened = saved.chestsOpened as boolean[];
    } else
      errors.push(`chestsOpened must hold ${chests.length} true/false flags`);
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

  if (saved.settings !== undefined) {
    if (isRunSettings(saved.settings)) value.settings = saved.settings;
    else
      errors.push("settings must name a known mode, goal and entrance shuffle");
  }

  return { errors, value };
};

/** Marks a file written by exportState. */
export const SAVE_FORMAT = "alltp-tracker-save";

/** The contents of an exported save file. */
export const toSaveFile = (progress: Progress) => ({
  format: SAVE_FORMAT,
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

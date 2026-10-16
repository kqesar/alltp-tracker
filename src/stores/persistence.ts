import { BOSS_STATES } from "@/constants";
import type { ItemState } from "@/data/logic";
import type { RunSettings } from "@/data/presets";
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

/** Bumped whenever PersistedState changes shape; `migrate` upgrades older saves. */
export const PERSIST_VERSION = 2;

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
 * Upgrade a save written by an earlier version to the current shape. Fields
 * are not validated here; restoring a save falls back field by field.
 * @param saved - The stored or imported object
 * @param version - The version it was written with
 */
export const migrate = (
  saved: unknown,
  version: number,
): Partial<PersistedState> => {
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) {
    return {};
  }
  let state = saved as Record<string, unknown>;
  if (version < 2) state = migrateV1(state);
  return state as Partial<PersistedState>;
};

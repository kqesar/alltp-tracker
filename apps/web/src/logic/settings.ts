// A run's settings in the alttpr pack's terms: what the app's run types mean
// to the ALttPR v31 rules, and how many items each dungeon counter counts.
import {
  type AlttprSettings,
  type DungeonId,
  dungeon,
  dungeonItemCount,
  dungeonPool,
  LEGACY_DUNGEONS,
  settingsFromUpstream,
  type UpstreamConfig,
} from "@alltp/pack-alttpr";
import type { RunSettings } from "@/data/presets";

/** The pack's goal for each of the app's. */
const GOALS: Record<
  RunSettings["goal"],
  NonNullable<UpstreamConfig["goal"]>
> = {
  "all-dungeons": "dungeons",
  "fast-ganon": "fast_ganon",
  ganon: "ganon",
  pedestal: "pedestal",
  // The pack has no triforce pieces; only Ganon's own rule reads the goal
  "triforce-hunt": "ganon",
};

const cache = new Map<string, AlttprSettings>();

/**
 * The pack's settings for a run: the run's world, goal, crystal counts, item
 * placement, accessibility, item pool and functionality, swordless weapons
 * when it has no sword, and its dungeon items (dungeonItems: which of them
 * may lie outside their dungeons), in NoGlitches
 * logic with randomized weapons, as the site's default preset has them
 * (config/alttp.php:78-96). The pack models the Open, Standard and Inverted
 * worlds: a retro run, whose preset says its logic is not supported, reads
 * as Open. The entrance shuffle is not modeled either. The same run
 * settings always give the same object, so a world compiled for it can be
 * kept.
 * @param run - The run's settings: its preset's, or the seed's
 */
export const packSettings = (run: RunSettings): AlttprSettings => {
  const key = [
    run.mode,
    run.goal,
    run.dungeonItems,
    run.swordless,
    run.crystalsTower,
    run.crystalsGanon,
    run.itemPlacement,
    run.accessibility,
    run.itemPool,
    run.itemFunctionality,
  ].join("/");
  let settings = cache.get(key);
  if (settings === undefined) {
    settings = settingsFromUpstream(
      run.mode === "standard" || run.mode === "inverted" ? run.mode : "open",
      {
        accessibility: run.accessibility,
        "crystals.ganon": run.crystalsGanon,
        "crystals.tower": run.crystalsTower,
        dungeonItems: run.dungeonItems,
        goal: GOALS[run.goal],
        "item.functionality": run.itemFunctionality,
        "item.pool": run.itemPool,
        itemPlacement: run.itemPlacement,
        logic: "NoGlitches",
        "mode.weapons": run.swordless ? "swordless" : "randomized",
      },
    );
    cache.set(key, settings);
  }
  return settings;
};

/** The world a run's settings build: what is kept per world is keyed by it. */
export const worldOf = (
  settings: AlttprSettings,
): "inverted" | "open" | "standard" => {
  if (settings.invertedMode) return "inverted";
  return settings.standardMode ? "standard" : "open";
};

/**
 * The dungeons with a key cell, by key index: the grid's ten (0-9, the
 * pack's LEGACY_DUNGEONS, in the game's order), then Hyrule Castle (10),
 * Castle Tower (11) and Ganon's Tower (12), which have no boss cell or
 * counter on the grid but keys to record.
 */
export const KEY_DUNGEONS: readonly DungeonId[] = [
  ...LEGACY_DUNGEONS,
  "hyrule-castle",
  "castle-tower",
  "ganons-tower",
];

/** The dungeon a key index (0-12) stands for; 0-9 are the grid's ten. */
export const dungeonAt = (index: number): DungeonId => {
  const id = KEY_DUNGEONS[index];
  if (id === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return id;
};

/** The name of the dungeon at a key index (0-12): "Eastern Palace". */
export const dungeonName = (index: number): string =>
  dungeon(dungeonAt(index)).name;

/**
 * How many small keys each key dungeon holds, by index: its pool's, as the
 * pack reads config/item.php. Eastern Palace has none in v31.
 */
export const SMALL_KEYS_MAX: readonly number[] = KEY_DUNGEONS.map(
  (id) => dungeonPool(dungeon(id)).smallKeys,
);

/** How many small keys the dungeon at a key index (0-12) holds. */
export const smallKeysMax = (index: number): number => {
  const max = SMALL_KEYS_MAX[index];
  if (max === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return max;
};

/**
 * Which of its own big key, map and compass a key dungeon's pool holds:
 * all three for the grid's ten, the map alone for Hyrule Castle, none for
 * Castle Tower, all three for Ganon's Tower.
 */
export const ownItems = (
  index: number,
): {
  readonly bigKey: boolean;
  readonly compass: boolean;
  readonly map: boolean;
} => {
  const pool = dungeonPool(dungeon(dungeonAt(index)));
  return {
    bigKey: pool.bigKey > 0,
    compass: pool.compass > 0,
    map: pool.map > 0,
  };
};

const counters = new WeakMap<AlttprSettings, readonly number[]>();

/**
 * How many items a dungeon's counter starts from in a run: its item
 * locations less the dungeon items that stay inside, which are no items to
 * the player. Keysanity counts every location, since each may hold a key.
 * @param index - The dungeon's grid index (0-9)
 * @param run - The run's settings
 */
export const counterMax = (index: number, run: RunSettings): number => {
  const settings = packSettings(run);
  let maxima = counters.get(settings);
  if (maxima === undefined) {
    maxima = LEGACY_DUNGEONS.map((id) =>
      dungeonItemCount(dungeon(id), settings),
    );
    counters.set(settings, maxima);
  }
  const max = maxima[index];
  if (max === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return max;
};

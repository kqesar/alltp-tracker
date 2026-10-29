// A run's settings in the alttpr pack's terms: what the app's run types mean
// to the ALttPR v31 rules, and how many items each dungeon counter counts.
import {
  type AlttprSettings,
  type DungeonId,
  dungeon,
  dungeonItemCount,
  dungeonPool,
  LEGACY_DUNGEONS,
  type Logic,
  noLogicSettings,
  settingsFromUpstream,
  UNKNOWN,
  type UpstreamConfig,
} from "@alltp/pack-alttpr";
import {
  bossShuffleOf,
  type Glitches,
  glitchesOf,
  type HiddenSetting,
  isHidden,
  playGlitchesOf,
  type RunSettings,
} from "@/games/alttpr/data/presets";

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

/**
 * The pack's logic for each of the app's glitches. No Logic has none of
 * its own: the pack reads it with a logic's rules (`noLogicSettings`).
 */
const LOGICS: Record<Glitches | "none", Logic> = {
  hybrid_major_glitches: "HybridMajorGlitches",
  major_glitches: "MajorGlitches",
  no_logic: "NoGlitches",
  none: "NoGlitches",
  overworld_glitches: "OverworldGlitches",
};

const cache = new Map<string, AlttprSettings>();

/** A run's settings as a key: the same key, the same pack settings. */
const keyOf = (run: RunSettings): string =>
  [
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
    bossShuffleOf(run),
    glitchesOf(run),
    playGlitchesOf(run),
    ...(run.hidden ?? []),
  ].join("/");

/** The pack's settings for a run in a given logic, cached under `key`. */
const built = (
  key: string,
  run: RunSettings,
  logic: Logic,
  noLogic: boolean,
): AlttprSettings => {
  let settings = cache.get(key);
  if (settings !== undefined) return settings;
  // A setting the run has not discovered is unknown to the pack, whatever
  // value stands in for it
  const known = <T>(setting: HiddenSetting, value: T) =>
    isHidden(run, setting) ? UNKNOWN : value;
  settings = settingsFromUpstream(run.mode, {
    accessibility: known("accessibility", run.accessibility),
    "crystals.ganon": known("crystalsGanon", run.crystalsGanon),
    "crystals.tower": known("crystalsTower", run.crystalsTower),
    dungeonItems: run.dungeonItems,
    "enemizer.bossShuffle": known("bossShuffle", bossShuffleOf(run)),
    goal: known("goal", GOALS[run.goal]),
    "item.functionality": known("itemFunctionality", run.itemFunctionality),
    "item.pool": known("itemPool", run.itemPool),
    itemPlacement: known("itemPlacement", run.itemPlacement),
    logic,
    "mode.weapons": known(
      "swordless",
      run.swordless ? "swordless" : "randomized",
    ),
  });
  if (noLogic) settings = noLogicSettings(settings);
  cache.set(key, settings);
  return settings;
};

/**
 * The pack's settings for a run: the run's world, goal, crystal counts, item
 * placement, accessibility, item pool and functionality, boss shuffle,
 * swordless weapons when it has no sword, and its dungeon items (dungeonItems: which of them
 * may lie outside their dungeons), in the logic of its glitches (No Logic
 * read with those it is played with; not known yet, the least permissive
 * of `glitchBounds`) with randomized weapons, as the site's
 * default preset has them (config/alttp.php:78-96). The pack models the Open, Standard, Inverted
 * and retro worlds; the entrance shuffle it does not model
 * (`logicModelled`). The same run settings always give the same object, so
 * a world compiled for it can be kept.
 * @param run - The run's settings: its preset's, or the seed's
 */
export const packSettings = (run: RunSettings): AlttprSettings => {
  const bounds = glitchBounds(run);
  if (bounds !== undefined) return bounds.lower;
  const glitches = glitchesOf(run);
  // No Logic is read with the glitches the player plays it with
  return built(
    keyOf(run),
    run,
    LOGICS[glitches === "no_logic" ? playGlitchesOf(run) : glitches],
    glitches === "no_logic",
  );
};

/**
 * The two logics a run whose glitches are not known yet (Mystery) is read
 * between: what holds under every logic its seed may have, and what holds
 * under any. A location is `yes` once the lower says so, `no` once the
 * upper does, else maybe (`solutionOf`).
 *
 * - `lower`, NoGlitches' rules (each glitched logic only adds ways:
 *   packs/alttpr/src/logics.spec.ts) read as a No Logic seed's, without the
 *   boots a glitched world starts with: a key may sit behind its own door,
 *   which a No Logic seed allows (`noLogicSettings`), and nothing is given.
 * - `upper`, Major Glitches', the boots given: every other logic's ways are
 *   among its own.
 *
 * Undefined while the glitches are known.
 */
export const glitchBounds = (
  run: RunSettings,
):
  | { readonly lower: AlttprSettings; readonly upper: AlttprSettings }
  | undefined => {
  if (!isHidden(run, "glitches")) return undefined;
  const key = keyOf(run);
  const lower = built(`${key}/lower`, run, "NoGlitches", false);
  const unbooted = cache.get(`${key}/lower/no-logic`) ?? {
    ...noLogicSettings(lower),
    bootsAtStart: false,
  };
  cache.set(`${key}/lower/no-logic`, unbooted);
  return {
    lower: unbooted,
    upper: built(`${key}/upper`, run, "MajorGlitches", false),
  };
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

/**
 * The key dungeons with a chest counter, by index: the grid's ten, on their
 * boss cells, and Ganon's Tower (12), on its own cell. Hyrule Castle's
 * checks each have their map marker, and Castle Tower's two hold no item
 * outside keysanity.
 */
export const COUNTER_INDICES: readonly number[] = [
  ...LEGACY_DUNGEONS.map((_, index) => index),
  12,
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
 * @param index - The dungeon's key index (COUNTER_INDICES: 0-9, or 12)
 * @param run - The run's settings
 */
export const counterMax = (index: number, run: RunSettings): number => {
  const settings = packSettings(run);
  let maxima = counters.get(settings);
  if (maxima === undefined) {
    maxima = KEY_DUNGEONS.map((id) => dungeonItemCount(dungeon(id), settings));
    counters.set(settings, maxima);
  }
  const max = maxima[index];
  if (max === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return max;
};

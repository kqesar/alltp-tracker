// A run's settings in the alttpr pack's terms: what the app's run types mean
// to the ALttPR v31 rules, and how many items each dungeon counter counts.
import {
  type AlttprSettings,
  type DungeonId,
  dungeon,
  dungeonItemCount,
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
 * The pack's settings for a run: the site's default preset (advanced item
 * placement, randomized weapons, 7 crystals for the tower and for Ganon,
 * NoGlitches, as config/alttp.php:78-96 has it) in the run's world, with
 * its goal, and every dungeon item wild for keysanity (dungeonItems 'full':
 * keys, big keys, maps and compasses). The pack models the Open and
 * Standard worlds only: an inverted or retro run, whose preset says its logic
 * is not supported, reads as Open. The entrance shuffle is not modeled
 * either. The same run settings always give the same object, so a world
 * compiled for it can be kept.
 * @param run - The run's settings, as its preset holds them
 */
export const packSettings = (run: RunSettings): AlttprSettings => {
  const key = `${run.mode}/${run.goal}/${run.keysanity}`;
  let settings = cache.get(key);
  if (settings === undefined) {
    settings = settingsFromUpstream(
      run.mode === "standard" ? "standard" : "open",
      {
        accessibility: "items",
        "crystals.ganon": 7,
        "crystals.tower": 7,
        dungeonItems: run.keysanity ? "full" : "standard",
        goal: GOALS[run.goal],
        itemPlacement: "advanced",
        logic: "NoGlitches",
        "mode.weapons": "randomized",
      },
    );
    cache.set(key, settings);
  }
  return settings;
};

/** The dungeon a grid index (0-9) stands for, in the game's order. */
export const dungeonAt = (index: number): DungeonId => {
  const id = LEGACY_DUNGEONS[index];
  if (id === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return id;
};

/** The name of the dungeon at a grid index (0-9): "Eastern Palace". */
export const dungeonName = (index: number): string =>
  dungeon(dungeonAt(index)).name;

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

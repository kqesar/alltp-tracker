// A run's settings in the alttpr pack's terms: what the app's run types mean
// to the ALttPR v31 rules (and to the Door Randomizer's world), and how many
// items each dungeon counter counts.
import type { Settings } from "@alltp/engine";
import {
  type AlttprSettings,
  DR_LOCATIONS,
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
  doorCounterExtra,
  doorKeysExtra,
  doorOf,
  doorShuffleOf,
  isDoorRun,
} from "@/games/alttpr/data/doorRando";
import {
  bossShuffleOf,
  enemyHealthOf,
  entranceRandomized,
  type Glitches,
  glitchesOf,
  type HiddenSetting,
  isHidden,
  playGlitchesOf,
  type RunSettings,
  swordsOf,
  wildItems,
} from "@/games/alttpr/data/presets";

/** The pack's goal for each of the app's. */
const GOALS: Record<
  RunSettings["goal"],
  NonNullable<UpstreamConfig["goal"]>
> = {
  "all-dungeons": "dungeons",
  completionist: "completionist",
  "fast-ganon": "fast_ganon",
  ganon: "ganon",
  ganonhunt: "ganonhunt",
  pedestal: "pedestal",
  // Its pieces win beside any rule (the pack's TRIFORCE_HUNT): only
  // Ganon's own rule reads the goal
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
    swordsOf(run),
    enemyHealthOf(run),
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
    // A DR run's small keys alone: no level of alttpr.com's, its region
    // flag (World.php:111-129 sets the flags each level turns on)
    ...(run.dungeonItems === "keys"
      ? { dungeonItems: "standard" as const, "region.wildKeys": true }
      : { dungeonItems: run.dungeonItems }),
    "enemizer.bossShuffle": known("bossShuffle", bossShuffleOf(run)),
    "enemizer.enemyHealth": enemyHealthOf(run),
    goal: known("goal", GOALS[run.goal]),
    "item.functionality": known("itemFunctionality", run.itemFunctionality),
    "item.pool": known("itemPool", run.itemPool),
    itemPlacement: known("itemPlacement", run.itemPlacement),
    logic,
    "mode.weapons": known(
      "swordless",
      run.swordless ? "swordless" : swordsOf(run),
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
 * of `glitchBounds`; behind shuffled entrances NoGlitches whatever they
 * are, `entranceRandomized`) with randomized weapons, as the site's
 * default preset has them (config/alttp.php:78-96). The pack models the Open, Standard, Inverted
 * and retro worlds; the entrance shuffle it does not model
 * (`logicModelled`). The same run settings always give the same object, so
 * a world compiled for it can be kept.
 * @param run - The run's settings: its preset's, or the seed's
 */
export const packSettings = (run: RunSettings): AlttprSettings => {
  // Behind shuffled entrances, NoGlitches whatever the glitches say: one
  // object for all of them
  if (entranceRandomized(run)) {
    const { glitches, hidden, playGlitches, ...rest } = run;
    const kept = hidden?.filter((setting) => setting !== "glitches");
    return built(
      `${keyOf({ ...rest, ...(kept?.length ? { hidden: kept } : {}) })}/er`,
      run,
      "NoGlitches",
      false,
    );
  }
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
 * Undefined while the glitches are known, and behind shuffled entrances,
 * whose seed is NoGlitches whatever they are (`entranceRandomized`).
 */
export const glitchBounds = (
  run: RunSettings,
):
  | { readonly lower: AlttprSettings; readonly upper: AlttprSettings }
  | undefined => {
  if (!isHidden(run, "glitches") || entranceRandomized(run)) return undefined;
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

/**
 * The pottery modes whose dungeons hold pots beyond their keys
 * (adjust_locations, Regions.py:1165-1232).
 */
const DUNGEON_POTS: ReadonlySet<string> = new Set([
  "dungeon",
  "reduced",
  "clustered",
  "nonempty",
  "lottery",
]);

const doorSettings = new WeakMap<AlttprSettings, Map<string, Settings>>();

/**
 * Whether a DR run's pyramid hole is open from the start (is_pyramid_open,
 * BaseClasses.py:299-311): as its `openPyramid` says, and under `auto`
 * for the crystals goal (the tracker's Fast Ganon, the pyramid open) and
 * ganonhunt, with vanilla or dungeon entrances alone (trinity has no run
 * type).
 */
export const pyramidOpen = (run: RunSettings): boolean => {
  const door = doorOf(run);
  const pyramid = door?.openPyramid ?? "auto";
  if (pyramid !== "auto") return pyramid === "yes";
  const entrances =
    run.entranceShuffle === "none" &&
    (door?.doorEntrances === undefined ||
      door.doorEntrances === "dungeonssimple" ||
      door.doorEntrances === "dungeonsfull");
  return entrances && (run.goal === "fast-ganon" || run.goal === "ganonhunt");
};

/**
 * The settings of the Door Randomizer's world for a DR run (doorLogic): the
 * pack's, and what DR reads beside them (the pack's door-world, whose
 * DR_DEFAULTS fill the rest): retro's universal keys and rupee bow, strict
 * key logic, the drops' and pots' keys shuffled, the pots, whether pots or
 * drops join the dungeons beyond their keys (the key analysis then left
 * out), the bomb bag, the legacy pot shuffle, the boss items behind map and
 * compass, the pyramid hole (`pyramidOpen`), a triforce hunt, a ganonhunt:
 * Ganon (Rules.py:73-74) and
 * Murahdahla (:72) ask the pieces the goal asks, which the state holds as
 * one piece once enough are found (`doorStateOf`), so `treasureHunt` is 1.
 * An Overworld Randomizer run adds its bonk drops and reads DR 1.5.7's
 * world at most, the base of the fork's release the pack reads (0.8.0.2).
 * The same run settings always give the same object, so the world compiled
 * for it can be kept.
 * @param run - A DR run's settings
 */
export const drSettingsOf = (run: RunSettings): Settings => {
  const settings = packSettings(run);
  const door = doorOf(run);
  const pottery = door?.pottery ?? "none";
  const drops = door?.dropShuffle ?? "none";
  const keyLogic = door?.keyLogic ?? "partial";
  // Not known reads as on: can_use_bombs (dr:BaseClasses.py:1209,
  // owr:BaseClasses.py:1367), the one rule that reads the bag (Rules.py's
  // bomb_escape_rule is a placement, maybe either way), then asks the +10
  // upgrade, unknown with the bag not known (the pack's
  // `bombUpgradeUnknown`): maybe where off would say yes and on no, the
  // same as off elsewhere; with it known on, the bombs cell tells the bag
  // (doorStateOf)
  const bombBag = door?.bombBag ?? true;
  const potShuffle = door?.potShuffle ?? false;
  const bossItems = door?.restrictBossItems ?? "none";
  const pyramid = pyramidOpen(run);
  const owr = door?.randomizer === "owr";
  // The fork's release the pack reads (0.8.0.2) is built on DR 1.5.7: an
  // older or unknown base reads as 1.5.6, which asks more (static.ts)
  const version =
    owr && door.doorVersion !== "1.5.6"
      ? "1.5.7"
      : (door?.doorVersion ?? "1.5.6");
  const bonkDrops = owr && door.bonkDrops;
  // The fork's entrance shuffle its rules and groups read (`shuffle_<mode>`,
  // OWR_DEFAULTS)
  const entrances = owr ? doorShuffleOf(run) : undefined;
  const key = [
    owr,
    bonkDrops,
    entrances,
    pottery,
    drops,
    keyLogic,
    run.goal,
    bombBag,
    potShuffle,
    bossItems,
    pyramid,
    version,
  ].join("/");
  let byKey = doorSettings.get(settings);
  if (byKey === undefined) {
    byKey = new Map();
    doorSettings.set(settings, byKey);
  }
  let found = byKey.get(key);
  if (found === undefined) {
    const hunt = run.goal === "ganonhunt" || run.goal === "triforce-hunt";
    found = {
      ...settings,
      bombBag,
      // OWR's bonk drops shuffled (shuffle_bonk_drops), its rules' own
      ...(owr ? { bonkDrops } : {}),
      ...(entrances === undefined ? {} : { [`shuffle_${entrances}`]: true }),
      // key_logic_algorithm: dangerous asks each door's worst case
      dangerousKeyLogic: keyLogic === "dangerous",
      dropShuffle: drops !== "none",
      // DR's release as its ROM title's digits: what a later one asks less
      drVersion: Number(version.replaceAll(".", "")),
      dungeonPotsAndDrops: DUNGEON_POTS.has(pottery) || drops === "underworld",
      ganonHuntGoal: run.goal === "ganonhunt",
      openPyramid: pyramid,
      potKeys: pottery !== "none" && pottery !== "cave",
      potShuffle,
      pottery: pottery !== "none",
      restrictBossItems: bossItems !== "none",
      retroBow: settings.rupeeBow,
      // static: the entrance randomizer's key rules, chest keys alone
      staticKeyLogic: keyLogic === "static",
      strictKeyLogic: keyLogic === "strict",
      treasureHunt: hunt ? 1 : 0,
      triforceHuntGoal: run.goal === "triforce-hunt",
      universalKeys: settings.genericKeys,
    };
    byKey.set(key, found);
  }
  return found;
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

/**
 * How many small keys the dungeon at a key index (0-12) holds: its pool's,
 * and in a Door Randomizer run whose key drops are shuffled the keys they
 * bring (the pack's `drKeysAdded`).
 */
export const smallKeysMax = (index: number, run?: RunSettings): number => {
  const max = SMALL_KEYS_MAX[index];
  if (max === undefined) throw new RangeError(`No dungeon at index ${index}`);
  return run === undefined || !isDoorRun(run)
    ? max
    : max + doorKeysExtra(dungeonAt(index), run);
};

/**
 * The most small keys a dungeon at a key index may hold in any run, which a
 * save is checked against: its pool's and every key drop's.
 */
export const SMALL_KEYS_CAP: readonly number[] = KEY_DUNGEONS.map(
  (id, index) =>
    (SMALL_KEYS_MAX[index] ?? 0) +
    DR_LOCATIONS.filter(
      (location) =>
        location.kind === "keyDrop" &&
        location.dungeon === id &&
        location.key === "small",
    ).length,
);

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
  // A Door Randomizer run's key drops, pots and enemies hold items too
  return isDoorRun(run)
    ? max + doorCounterExtra(dungeonAt(index), run, wildItems(run))
    : max;
};

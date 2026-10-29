// ALttPR's side of reviewing a finished run: what the run says that a spoiler
// log can contradict (binding), and the run's timeline set against the log's
// playthrough (rows). Pure: the Run tab draws it. The game-agnostic rules
// (`bindSeed`, `compareRun`) are @alltp/spoiler's; this module only turns the
// tracker's run into their terms.

import {
  type AlttprSpoilerLog,
  DUNGEONS,
  LEGACY_DUNGEONS,
  MAP_LOCATIONS,
  MEDALLIONS,
  PRIZES,
  type Prize,
} from "@alltp/pack-alttpr";
import {
  type Binding,
  bindSeed,
  compareRun,
  type Entry,
  type Fact,
  type FactValue,
  type Find,
} from "@alltp/spoiler";
import { COMPARED, checkSeed } from "@/games/alttpr/autotrack/seed";
import {
  type DoorRunSettings,
  doorLocationsOf,
  doorOf,
} from "@/games/alttpr/data/doorRando";
import { isHidden, type TunableSetting } from "@/games/alttpr/data/presets";
import { isCleared, runZones } from "@/games/alttpr/logic/checks";
import { PACK_ITEMS, packReading } from "@/games/alttpr/logic/packItems";
import {
  bossLocationOf,
  dungeonCount,
  prizeOf,
  solutionOf,
} from "@/games/alttpr/logic/solution";
import type { Progress } from "@/games/alttpr/stores/persistence";

/** The run, as far as a review reads it. */
export type ReviewedRun = Pick<
  Progress,
  | "checked"
  | "items"
  | "medallions"
  | "presetId"
  | "seed"
  | "settings"
  | "smallKeys"
  | "timeline"
>;

/** The prize group a pack prize item belongs to, which the board records. */
const PRIZE_GROUP = new Map<string, Prize>(
  (Object.keys(PRIZES) as Prize[]).flatMap((group) =>
    PRIZES[group].map((item) => [item, group] as const),
  ),
);

/** A medallion pad's run value: 0 unknown, then Bombos, Ether, Quake. */
const padOf = (value: number | undefined): string | null =>
  value === 1 || value === 2 || value === 3
    ? (MEDALLIONS[value - 1] ?? null)
    : null;

/** Which randomizer wrote a seed, in the words of a refusal. */
const randomizerName = (settings: DoorRunSettings): string => {
  const door = doorOf(settings);
  return door === null
    ? "alttpr.com's"
    : door.randomizer === "owr"
      ? "the Overworld Randomizer's"
      : "the Door Randomizer's";
};

/**
 * What a log and a run both state of the seed: which
 * randomizer wrote it, and the settings the game's ROM states exactly
 * (doors shuffled or not, drops, pottery or not, shops, take-any caves,
 * enemies). The finer ones (which door shuffle, which pottery) a run read
 * from its ROM only approximates, so they refuse nothing here.
 */
const doorFacts = (
  file: DoorRunSettings,
  run: DoorRunSettings,
  fileIsDoor: boolean,
): Fact[] => {
  const facts: Fact[] = [
    {
      file: fileIsDoor ? randomizerName(file) : randomizerName({}),
      name: "door:randomizer",
      run: randomizerName(run),
    },
  ];
  const one = doorOf(file);
  const two = doorOf(run);
  if (!fileIsDoor || one === null || two === null) return facts;
  const yes = (on: boolean) => (on ? "on" : "off");
  facts.push(
    {
      file: one.doorShuffle === "vanilla" ? "vanilla" : "shuffled",
      name: "door:doors",
      run: two.doorShuffle === "vanilla" ? "vanilla" : "shuffled",
    },
    { file: one.dropShuffle, name: "door:drops", run: two.dropShuffle },
    {
      file: yes(one.pottery !== "none"),
      name: "door:pottery",
      run: yes(two.pottery !== "none"),
    },
    {
      file: yes(one.shopsanity),
      name: "door:shopsanity",
      run: yes(two.shopsanity),
    },
    {
      file: yes(one.takeAny !== "none"),
      name: "door:take-any",
      run: yes(two.takeAny !== "none"),
    },
    { file: one.enemyShuffle, name: "door:enemies", run: two.enemyShuffle },
  );
  return facts;
};

/**
 * The settings both the run and the log state, as facts for `bindSeed`: the
 * run type's compared settings in the run's own terms (through `checkSeed`,
 * which the seed import uses), the two medallions and the prize of each
 * dungeon, where the board knows them.
 */
const factsOf = (log: AlttprSpoilerLog, run: ReviewedRun): Fact[] => {
  const facts: Fact[] = [];
  const { settings } = log.extra;
  if (settings !== null) {
    // The log's seed id may be unknown (a renamed file); the settings still count
    const check = checkSeed(
      { ...settings, seed: settings.seed ?? "file" },
      { presetId: run.presetId, settings: run.settings },
    );
    if (check.kind === "same" || check.kind === "differs") {
      const file = check.kind === "same" ? run.settings : check.settings;
      for (const key of COMPARED) {
        if (isHidden(run.settings, key as TunableSetting)) continue;
        facts.push({
          file: file[key] as FactValue,
          name: key,
          run: run.settings[key] as FactValue,
        });
      }
      facts.push(
        ...doorFacts(file, run.settings, log.extra.door !== undefined),
      );
    }
  }
  const { mire, turtleRock } = log.extra.medallions;
  facts.push(
    { file: mire, name: "medallion:mire", run: padOf(run.medallions[8]) },
    {
      file: turtleRock,
      name: "medallion:turtle-rock",
      run: padOf(run.medallions[9]),
    },
  );
  const prizes = packReading(run.items).prizes;
  for (const dungeon of DUNGEONS) {
    const filed = log.extra.prizes[dungeon.id];
    facts.push({
      file: filed === undefined ? null : (PRIZE_GROUP.get(filed) ?? null),
      name: `prize:${dungeon.id}`,
      run: prizes[dungeon.id] ?? null,
    });
  }
  return facts;
};

/** A DR ROM title's seed, `<team>_<player>_<seed>` (the pack's `seedRomOf`). */
const TITLE_SEED = /^\d+_\d+_/;

/**
 * The log's seed id to set against the run's. A Door Randomizer log may
 * state two (`extra.door`): the seed as the ROM's title names it, which
 * autotracking records as the run's, and avianart's hash, which a run
 * started from an avianart link keeps until autotracking reads the ROM. The
 * one of the run's kind is compared; a log without it proves nothing.
 */
const fileSeed = (log: AlttprSpoilerLog, run: ReviewedRun): string | null => {
  const { door } = log.extra;
  if (door === undefined) return log.seed.id;
  if (run.seed === null) return door.title ?? door.avianart;
  return TITLE_SEED.test(run.seed) ? door.title : door.avianart;
};

/**
 * Whether a log is the run's: the seed ids (the log's hash, or the one its
 * file name carries, against the run's; a Door Randomizer log's of the run's
 * kind, `fileSeed`), then every setting, medallion and prize both sides
 * state. A contradiction refuses; a run with no seed (kept by hand) or a log
 * with none (a renamed file) is "not verified".
 */
export const bindRun = (log: AlttprSpoilerLog, run: ReviewedRun): Binding =>
  bindSeed({
    facts: factsOf(log, run),
    seed: { file: fileSeed(log, run), run: run.seed },
  });

const BEATEN = /^item:boss(\d+):2$/;

/**
 * What the run did, as `compareRun` takes it, from the timeline. A location
 * checked is a find at it; an item got is a find of that pack item (a
 * progressive item's levels each one more of it); a boss beaten is a find at
 * the dungeon's boss and prize locations. A check and the item it gave land
 * together, in one instant (autotracking lays a reading's news in one), and
 * make one find, so the item is not matched a second time by its order.
 */
export const reviewFinds = (
  run: Pick<ReviewedRun, "timeline"> & Parameters<typeof solutionOf>[0],
  log: AlttprSpoilerLog,
): Find[] => {
  const held = new Map(log.placements.map((p) => [p.location, p.item]));
  const settings = solutionOf(run).settings;
  const items: Find[] = [];
  const checks: { at: number; location: string }[] = [];
  const places: Find[] = [];
  for (const [key, { at }] of Object.entries(run.timeline)) {
    if (key.startsWith("check:")) {
      checks.push({ at, location: key.slice(6) });
      continue;
    }
    const beaten = BEATEN.exec(key)?.[1];
    if (beaten !== undefined) {
      const id = LEGACY_DUNGEONS[Number(beaten)];
      if (id === undefined) continue;
      const boss = bossLocationOf(id, run);
      if (boss !== undefined) places.push({ at, location: boss });
      places.push({ at, location: prizeOf(id, settings) });
      continue;
    }
    const [, id = "", level] = key.split(":");
    const entry = Object.hasOwn(PACK_ITEMS, id) ? PACK_ITEMS[id] : undefined;
    if (entry?.kind === "count") items.push({ at, item: entry.item });
    else if (entry?.kind === "bits") {
      const item = entry.items[Math.log2(Number(level))];
      if (item !== undefined) items.push({ at, item });
    }
  }
  // A check and the item it gave, at one instant, are one find
  const waiting = new Map<string, Find[]>();
  for (const find of items) {
    const key = `${find.at}:${find.item}`;
    waiting.set(key, [...(waiting.get(key) ?? []), find]);
  }
  const merged = new Set<Find>();
  const finds: Find[] = [];
  for (const check of checks) {
    const item = held.get(check.location);
    const same =
      item === null || item === undefined
        ? undefined
        : waiting.get(`${check.at}:${item}`)?.shift();
    if (same === undefined || item === null || item === undefined) {
      finds.push(check);
    } else {
      merged.add(same);
      finds.push({ ...check, item });
    }
  }
  return [...finds, ...places, ...items.filter((find) => !merged.has(find))];
};

/** What the review says of one location of the playthrough or the log. */
export type RowState =
  /** Found, with no later sphere found before it. */
  | "in-order"
  /** Found after something the playthrough has later. */
  | "late"
  /**
   * Done on the board, with no time: a counted dungeon, a save without
   * times, a Door Randomizer location (the timeline never dates one).
   */
  | "untimed"
  /** Never found. */
  | "missed"
  /** The board cannot tell (a dungeon's counted checks, a location it does not track). */
  | "unknown";

export interface ReviewRow {
  readonly entry: Entry;
  readonly state: RowState;
  /** The run timer's reading when it was found, null before the timer or untimed. */
  readonly ms: number | null;
}

export interface ReviewComparison {
  readonly rows: readonly ReviewRow[];
  /** Over the playthrough's placements. */
  readonly summary: {
    readonly required: number;
    readonly inOrder: number;
    readonly late: number;
    readonly missed: number;
    readonly unknown: number;
    readonly untimed: number;
  };
  /** A dungeon whose checks the board only counted, with how many are left. */
  readonly counted: readonly { readonly name: string; readonly left: number }[];
}

/**
 * Locations whose state the board cannot tell: those it does not track as a
 * check (the bottles' and medallions' pads, Ganon, a Door Randomizer location
 * the run's settings leave out), and a dungeon's, when the dungeon was only
 * counted (a manual run, or a race tracked by an earlier version:
 * autotracking checks them one by one otherwise) and it is not finished. A
 * DR location the run tracks is known: checked or not, never with a time.
 */
const unknownLocations = (
  log: AlttprSpoilerLog,
  run: ReviewedRun,
): { unknown: Set<string>; counted: ReviewComparison["counted"] } => {
  const unknown = new Set<string>();
  const dungeonPrizes = new Set(DUNGEONS.map((d) => `${d.id}/prize`));
  const door = new Set(
    doorLocationsOf(run.settings).locations.map(({ id }) => id),
  );
  for (const { location } of log.placements) {
    // A prize follows its boss, which the board knows
    if (
      !MAP_LOCATIONS.has(location) &&
      !dungeonPrizes.has(location) &&
      !door.has(location)
    ) {
      unknown.add(location);
    }
  }
  const counted: { name: string; left: number }[] = [];
  const stamped = new Set(
    Object.keys(run.timeline)
      .filter((key) => key.startsWith("check:"))
      .map((key) => key.slice(6)),
  );
  const placed = new Set(log.placements.map((p) => p.location));
  for (const zone of runZones(run)) {
    const { dungeon } = zone;
    if (dungeon === undefined) continue;
    const left = dungeonCount(dungeon, run);
    if (left === undefined || left === 0) continue;
    if (zone.checks.some(({ id }) => stamped.has(id))) continue;
    const boss = bossLocationOf(dungeon, run);
    const open = zone.checks.filter(
      ({ id }) => placed.has(id) && !run.checked[id] && id !== boss,
    );
    for (const { id } of open) unknown.add(id);
    if (open.length > 0) counted.push({ left, name: zone.name });
  }
  return { counted, unknown };
};

/**
 * The run set against the log's playthrough, location by location.
 * @param log - The spoiler log, bound to the run
 * @param run - The run as it stands
 */
export const compareReview = (
  log: AlttprSpoilerLog,
  run: ReviewedRun,
): ReviewComparison => {
  const { counted, unknown } = unknownLocations(log, run);
  const finds = reviewFinds(run, log);
  const comparison = compareRun({ finds, placements: log.placements, unknown });
  const msAt = new Map(
    Object.values(run.timeline).map(({ at, ms }) => [at, ms] as const),
  );
  const states = runStates(run);
  const rows = comparison.entries.map((entry): ReviewRow => {
    const done = states.get(entry.placement.location) === true;
    const state: RowState =
      entry.state === "found"
        ? entry.behind > 0
          ? "late"
          : "in-order"
        : entry.state === "unknown"
          ? "unknown"
          : done
            ? "untimed"
            : "missed";
    return {
      entry,
      ms: entry.find === null ? null : (msAt.get(entry.find.at) ?? null),
      state,
    };
  });
  const summary = {
    inOrder: 0,
    late: 0,
    missed: 0,
    required: 0,
    unknown: 0,
    untimed: 0,
  };
  for (const { entry, state } of rows) {
    if (entry.placement.sphere === null) continue;
    summary.required++;
    if (state === "in-order") summary.inOrder++;
    else if (state === "late") summary.late++;
    else if (state === "missed") summary.missed++;
    else if (state === "unknown") summary.unknown++;
    else summary.untimed++;
  }
  return { counted, rows, summary };
};

/**
 * Which locations the board shows done: checked, or in a dungeon its counter
 * finished (`isCleared`), and a dungeon's prize once its boss is beaten (the
 * game gives it on the kill; the board has no check for it).
 */
const runStates = (run: ReviewedRun): Map<string, boolean> => {
  const done = new Map<string, boolean>();
  for (const zone of runZones(run)) {
    const cleared = isCleared(zone, run);
    const boss =
      zone.dungeon === undefined
        ? undefined
        : bossLocationOf(zone.dungeon, run);
    for (const { id } of zone.checks) {
      done.set(id, run.checked[id] === true || (cleared && id !== boss));
    }
  }
  const { settings } = solutionOf(run);
  LEGACY_DUNGEONS.forEach((id, index) => {
    if (run.items[`boss${index}`] === 2) done.set(prizeOf(id, settings), true);
  });
  return done;
};

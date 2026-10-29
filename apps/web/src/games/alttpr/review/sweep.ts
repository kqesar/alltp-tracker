// When each needed item of a reviewed run came into logic, against when it
// was taken: the run's timeline replayed through the pack's rules. At each
// instant the items held change, the run is solved again with what was held
// then; a place is "in logic from" the first instant it reads `yes` (a dark
// room without the Lamp is not yet). The log says where every dungeon key
// is, so the keys count as held once their place is checked, solved as
// keysanity solves them: the seed's own key logic, not the board's guess.
// Pure: `sweepRun` is a generator that yields after each solve, so the page
// runs it in slices (useSweep.ts).

import {
  type AlttprSettings,
  type AlttprSpoilerLog,
  bossLocation,
  DUNGEONS,
  type DungeonId,
  dungeon,
  LEGACY_DUNGEONS,
  MAP_LOCATIONS,
  MEDALLIONS,
  markersOf,
  PRIZES,
  type Prize,
  solveWithKeys,
  type TrackerInput,
  toState,
  UNKNOWN_FACT_OF,
} from "@alltp/pack-alttpr";
import { DOOR_LOCATION_IDS } from "@/games/alttpr/data/doorRando";
import { items as freshItems, type ItemState } from "@/games/alttpr/data/items";
import { logicModelled } from "@/games/alttpr/data/presets";
import { withCost } from "@/games/alttpr/logic/costs";
import { PACK_ITEMS } from "@/games/alttpr/logic/packItems";
import { findIcon, findName, splitName } from "@/games/alttpr/logic/runLog";
import { packSettings } from "@/games/alttpr/logic/settings";
import { fillerOf, trackerInput } from "@/games/alttpr/logic/solution";
import type {
  ReviewComparison,
  ReviewedRun,
  ReviewRow,
} from "@/games/alttpr/review/adapter";
import { labelsOfLog } from "@/games/alttpr/review/labels";

/** A stretch with nothing found this long is a break, left out of play time. */
export const BREAK_MS = 30 * 60_000;

/** Why a run's waits are not shown. */
export type Hidden =
  /** The log has no playthrough (a spoiler race's). */
  | "no-playthrough"
  /** Small keys are generic (Retro): the board counts none, so no door is solved. */
  | "generic-keys"
  /** Small keys are shuffled, and the run does not time them. */
  | "keysanity"
  /** Entrances are shuffled: the run does not time them. */
  | "entrances"
  /**
   * The pack does not model the run's logic: settings hidden, the bosses
   * shuffled, a glitched logic.
   */
  | "not-modelled"
  /**
   * The log is a Door Randomizer's. Its rules (key doors, pots, enemy drops,
   * its own dungeon logic) are not ported yet, and the sweep's, alttpr.com's,
   * would say "in logic" from rules the seed was not made with.
   */
  | "door-logic"
  /**
   * The board has finds and the run no timeline at all: opened from a
   * shared link that left it out to stay short, or a save from before the
   * tracker kept one.
   */
  | "no-timeline"
  /** Nothing the seed needed has a time. */
  | "no-times"
  /** Tracked by hand: its times are clicks. */
  | "by-hand"
  /**
   * Places outside dungeons stamped, none inside: autotracked in Race Mode
   * by an earlier version, which did not read a dungeon's chests, so most
   * finds go by item.
   */
  | "race-mode";

const required = (rows: readonly ReviewRow[]) =>
  rows.filter(({ entry }) => entry.placement.sphere !== null);

/**
 * Why the waits cannot be told for this run, or null when they can. A run
 * tracked by hand is one whose needed finds are mostly matched by item order
 * (autotracking stamps a check and its item together, so they match a place).
 */
export const hiddenReason = (
  log: AlttprSpoilerLog,
  run: ReviewedRun,
  comparison: ReviewComparison,
): Hidden | null => {
  const { settings } = run;
  if (log.spheres === 0) return "no-playthrough";
  // First: whatever else holds, the times are to be had where it was played
  if (
    Object.keys(run.timeline).length === 0 &&
    comparison.rows.some(
      ({ entry, state }) =>
        state === "untimed" && !DOOR_LOCATION_IDS.has(entry.placement.location),
    )
  ) {
    return "no-timeline";
  }
  if (settings.dungeonItems === "mcs" || settings.dungeonItems === "full") {
    return "keysanity";
  }
  if (packSettings(settings).genericKeys) return "generic-keys";
  if (settings.entranceShuffle !== "none" || log.format === "er") {
    return "entrances";
  }
  // The pack ports vt's NoGlitches rules with the vanilla bosses
  const logic = log.extra.settings?.logic;
  if (
    !logicModelled(settings) ||
    (settings.hidden?.length ?? 0) > 0 ||
    log.extra.bosses !== null ||
    (logic?.known === true && logic.value !== "NoGlitches")
  ) {
    return "not-modelled";
  }
  // After the causes above, which are the more specific
  if (log.extra.door !== undefined) return "door-logic";
  const found = required(comparison.rows).filter(
    ({ entry, ms }) => entry.find !== null && ms !== null,
  );
  if (found.length === 0) return "no-times";
  const placed = found.filter(
    ({ entry }) => !entry.inferred && entry.find?.location !== undefined,
  ).length;
  if (placed * 2 >= found.length) return null;
  return dungeonChecksStamped(run) === "outside only" ? "race-mode" : "by-hand";
};

/** Whether a dungeon's place, or only places outside dungeons, were stamped. */
const dungeonChecksStamped = (
  run: Pick<ReviewedRun, "timeline">,
): "inside" | "outside only" | "none" => {
  let outside = false;
  for (const key of Object.keys(run.timeline)) {
    if (!key.startsWith("check:")) continue;
    const place = key.slice(6);
    if (DUNGEONS.some(({ id }) => place.startsWith(`${id}/`))) return "inside";
    outside = true;
  }
  return outside ? "outside only" : "none";
};

/** One instant the run changed at, the run's start first. */
interface Step {
  readonly at: number;
  /** The run timer's reading then (0 before it started). */
  readonly ms: number;
  /** Whether the timer had started: a find before it says nothing of breaks. */
  readonly timed: boolean;
  readonly keys: readonly string[];
}

/** What came with the item that put a place in logic. */
export interface After {
  /** The timeline key: `item:firerod`, `item:boss8:2`. */
  readonly key: string;
  /** "the Fire Rod", "Misery Mire's boss". */
  readonly name: string;
}

/** What holding an item earlier would have opened, and from when. */
export interface TradeOff {
  readonly at: number;
  readonly after: After | null;
  /** Location ids. */
  readonly opened: readonly string[];
}

export type WaitKind = "major" | "dungeon" | "prize";

/** One needed item: when it came into logic, when it was taken. */
export interface Wait {
  /** The placement of the playthrough it stands for. */
  readonly location: string;
  /** Where the copy paired with it was taken (its own place, for a single item). */
  readonly where: string | null;
  /** That place's location id. */
  readonly place: string | null;
  readonly item: string;
  /** "Titan's Mitt": the copy taken, as the timeline names it. */
  readonly name: string;
  /** An asset name, or null. */
  readonly icon: string | null;
  readonly kind: WaitKind;
  readonly sphere: number;
  /** Play time it came into logic (0: the start), or null. */
  readonly reach: number | null;
  readonly after: After | null;
  /** Play time it was taken, or null. */
  readonly taken: number | null;
  /** `taken - reach`; below 0 when taken before the logic expected. */
  readonly waited: number | null;
  /** The timeline key of the find (`item:hookshot`), or null. */
  readonly takenKey: string | null;
  /** How many copies of this item the map holds (paired in order when more than one). */
  readonly copies: number;
  /** Matched by item order, not by its place. */
  readonly inferred: boolean;
  /** For an item that waited: what it opened when taken. */
  readonly opened: readonly string[];
  /** For an item that waited: what it could have opened earlier. */
  readonly tradeOff: TradeOff | null;
}

/** When a dungeon came into logic, and when the run went. */
export interface DungeonTimes {
  readonly id: DungeonId;
  readonly name: string;
  readonly total: number;
  /** Play time part of it was in logic, null never. */
  readonly partial: number | null;
  /** Location ids in logic at `partial`. */
  readonly atPartial: readonly string[];
  /** Each of its places: the play time it came into logic, null never. */
  readonly reaches: Readonly<Record<string, number | null>>;
  readonly full: number | null;
  readonly fullAfter: After | null;
  readonly entered: number | null;
  readonly finished: number | null;
}

/** A break, in play time: where it falls and how long it was. */
export interface Break {
  readonly at: number;
  readonly length: number;
}

export interface Sweep {
  /** Play time at the run's end, breaks left out. */
  readonly end: number;
  /** The run timer's reading at the end. */
  readonly timerEnd: number;
  readonly breaks: readonly Break[];
  /** Every needed item on the map, by wait, longest first. */
  readonly waits: readonly Wait[];
  readonly dungeons: readonly DungeonTimes[];
  /** How many times the run was solved. */
  readonly solves: number;
  /** Whether any dungeon place was stamped (Race Mode stamps none). */
  readonly dungeonChecks: boolean;
}

const DUNGEON_PRIZES = new Set(DUNGEONS.map((d) => `${d.id}/prize`));
const onMap = (location: string) =>
  MAP_LOCATIONS.has(location) || DUNGEON_PRIZES.has(location);

const kindOf = (item: string): WaitKind =>
  /^(crystal|pendant)/.test(item)
    ? "prize"
    : /^(bigKey|key|map|compass)[A-Z]/.test(item)
      ? "dungeon"
      : "major";

const BOSS_KEY = /^item:(?:boss(\d+):2|agahnim2?:1)$/;

/** The key a dungeon's boss beaten is timed under. */
const bossKey = (id: DungeonId): string | undefined => {
  if (id === "castle-tower") return "item:agahnim:1";
  if (id === "ganons-tower") return "item:agahnim2:1";
  const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(id);
  return index < 0 ? undefined : `item:boss${index}:2`;
};

/** The pack item a timeline key gives, or undefined. */
const packItemOf = (key: string): string | undefined => {
  const [kind, id = "", level] = key.split(":");
  if (kind !== "item" || !Object.hasOwn(PACK_ITEMS, id)) return undefined;
  const entry = PACK_ITEMS[id];
  if (entry.kind === "count") return entry.item;
  if (entry.kind === "bits") return entry.items[Math.log2(Number(level))];
  return undefined;
};

/** The item of a step that put something in logic: a needed one first. */
const afterOf = (step: Step, needed: ReadonlySet<string>): After | null => {
  const keys = step.keys.filter((key) => key.startsWith("item:"));
  const key =
    keys.find((k) => needed.has(packItemOf(k) ?? "")) ??
    keys.find((k) => BOSS_KEY.test(k)) ??
    keys[0];
  if (key === undefined) return null;
  return {
    key,
    name: BOSS_KEY.test(key)
      ? `${splitName(key)}'s boss`
      : `the ${findName(key)}`,
  };
};

/** The prize group of each prize item, as the rules tell them apart. */
const PRIZE_OF = new Map<string, Prize>(
  (Object.keys(PRIZES) as Prize[]).flatMap((group) =>
    PRIZES[group].map((item) => [item, group] as const),
  ),
);

const keysKnown = new WeakMap<AlttprSettings, AlttprSettings>();

/**
 * A run's settings with its small and big keys tracked, as keysanity
 * tracks them (maps and compasses left as they are: wild ones would make a
 * boss want its compass). The same object for the same settings, so its
 * world compiles once (fillerOf).
 */
const withKeysKnown = (settings: AlttprSettings): AlttprSettings => {
  let known = keysKnown.get(settings);
  if (known === undefined) {
    known = {
      ...settings,
      wildBigKeys: true,
      wildKeys: settings.genericKeys ? settings.wildKeys : true,
    };
    keysKnown.set(settings, known);
  }
  return known;
};

/**
 * The board's items with the log's own: its big keys, and the counts the
 * board may not know (the hearts, the escape's bombs) as the log put them
 * where the run took them, never the board's last count, which no timeline
 * dates. A run that dated no place (Race Mode's stamps none) cannot date
 * them: they stay unknown, maybe at most.
 * @param board - The board's input at a step
 * @param logs - The big keys and counts of the places taken by then
 * @param dated - Whether the run dated the places it checked
 */
export const withLogCounts = (
  board: TrackerInput,
  logs: Readonly<Record<string, number>>,
  dated: boolean,
): Pick<TrackerInput, "items" | "unknown"> => {
  const held = Object.fromEntries(
    Object.entries(board.items).filter(
      ([id]) => !id.startsWith("bigKey") && !UNKNOWN_FACT_OF.has(id),
    ),
  );
  return {
    items: { ...held, ...logs },
    unknown: dated ? {} : { bombs: true, health: true },
  };
};

/** An item's value once a timeline key is applied to it. */
const applyKey = (
  value: boolean | number | undefined,
  id: string,
  level: string | undefined,
): boolean | number => {
  if (level === undefined) return true;
  const n = Number(level);
  const was = typeof value === "number" ? value : 0;
  return PACK_ITEMS[id]?.kind === "bits" ? was | n : Math.max(was, n);
};

/**
 * The run replayed: solved at its start and at each instant its items
 * changed, then each needed item set against those solves. Yields after each
 * solve; returns the sweep.
 * @param endMs - The run timer's reading at the end
 */
export function* sweepRun(
  log: AlttprSpoilerLog,
  run: ReviewedRun,
  comparison: ReviewComparison,
  endMs: number,
): Generator<void, Sweep, void> {
  const settings = packSettings(run.settings);
  // The keys are the log's: solved as wild keys, counted where it put them
  const seedSettings = withKeysKnown(settings);
  const filler = fillerOf(seedSettings);

  // The instants, in order, each with its keys
  const byAt = new Map<number, Step>();
  for (const [key, { at, ms }] of Object.entries(run.timeline)) {
    const step = byAt.get(at);
    byAt.set(at, {
      at,
      keys: [...(step?.keys ?? []), key],
      ms: Math.max(step?.ms ?? 0, ms ?? 0),
      timed: (step?.timed ?? false) || ms !== null,
    });
  }
  const steps: Step[] = [
    { at: Number.NEGATIVE_INFINITY, keys: [], ms: 0, timed: false },
    ...[...byAt.values()].sort((a, b) => a.at - b.at),
  ];
  const indexOfAt = new Map(steps.map((step, index) => [step.at, index]));

  // The items as they stood at each instant: a timed item from nothing
  let items: Record<string, boolean | number> = { ...run.items };
  for (const step of steps) {
    for (const key of step.keys) {
      const [kind, id = ""] = key.split(":");
      if (kind === "item" && Object.hasOwn(freshItems, id)) {
        items[id] = freshItems[id];
      }
    }
  }
  // Where the log put each dungeon key, and when each place was taken: its
  // check, or for a boss's place and its prize, the boss beaten
  const keyOf = new Map<string, { dungeon: DungeonId; big: boolean }>();
  for (const { item, location } of log.placements) {
    const key = /^(bigKey|key)([A-Z]\d)$/.exec(item ?? "");
    const owner = DUNGEONS.find((d) => d.code === key?.[2]);
    if (key !== null && owner !== undefined) {
      keyOf.set(location, { big: key[1] === "bigKey", dungeon: owner.id });
    }
  }
  // Where the log put the counts the board may not know (the hearts, the
  // escape's bombs): counted, as the keys are, once their place is taken
  const countOf = new Map<string, string>();
  for (const { item, location } of log.placements) {
    if (item !== null && UNKNOWN_FACT_OF.has(item)) countOf.set(location, item);
  }
  const takenAt = (key: string): string[] => {
    if (key.startsWith("check:")) return [key.slice(6)];
    const beaten = /^item:boss(\d+):2$/.exec(key)?.[1];
    const id =
      beaten === undefined ? undefined : LEGACY_DUNGEONS[Number(beaten)];
    if (id === undefined) return [];
    const place = bossLocation(dungeon(id), settings);
    return [...(place === undefined ? [] : [place]), `${id}/prize`];
  };

  // The seed's prizes and pads, whatever the board was left with (Race Mode
  // reads no prize, a hand run may set none): a prize counts once its boss
  // is beaten, which the timeline dates
  const prizes: Partial<Record<DungeonId, Prize>> = {};
  for (const [id, item] of Object.entries(log.extra.prizes)) {
    const group = PRIZE_OF.get(item);
    if (group !== undefined) prizes[id as DungeonId] = group;
  }
  const pad = (medallion: string | null) =>
    MEDALLIONS.find((name) => name === medallion);
  const medallions: TrackerInput["medallions"] = {
    ...(pad(log.extra.medallions.mire) === undefined
      ? {}
      : { mire: pad(log.extra.medallions.mire) }),
    ...(pad(log.extra.medallions.turtleRock) === undefined
      ? {}
      : { turtleRock: pad(log.extra.medallions.turtleRock) }),
  };
  const checked: Record<string, true> = {};
  const smallKeys: Partial<Record<DungeonId, number>> = {};
  const bigKeys: Record<string, number> = {};
  const counted: Record<string, number> = {};
  const inputs: TrackerInput[] = [];
  const tris: Readonly<Record<string, string>>[] = [];
  const first = new Map<string, number>();
  const placeTaken = new Map<string, number>();
  // A run that checked places dates the hearts and bombs taken at them
  const dated = Object.keys(run.timeline).some((key) =>
    key.startsWith("check:"),
  );
  const solveAt = (input: TrackerInput) =>
    solveWithKeys(filler, toState(input, seedSettings)).locations();
  let solves = 0;
  for (const [index, step] of steps.entries()) {
    if (index > 0) {
      items = { ...items };
      for (const key of step.keys) {
        const [kind, id = "", level] = key.split(":");
        if (kind === "check") checked[key.slice(6)] = true;
        else if (Object.hasOwn(freshItems, id)) {
          items[id] = applyKey(items[id], id, level);
        }
        for (const place of takenAt(key)) {
          if (placeTaken.has(place)) continue;
          placeTaken.set(place, index);
          const count = countOf.get(place);
          if (count !== undefined) counted[count] = (counted[count] ?? 0) + 1;
          const owned = keyOf.get(place);
          if (owned?.big) {
            const big = `bigKey${dungeon(owned.dungeon).code}`;
            bigKeys[big] = 1;
          } else if (owned !== undefined) {
            smallKeys[owned.dungeon] = (smallKeys[owned.dungeon] ?? 0) + 1;
          }
        }
      }
    }
    const board = trackerInput({
      checked,
      items: items as ItemState,
      medallions: run.medallions,
      settings: run.settings,
      smallKeys: run.smallKeys,
    });
    const input: TrackerInput = {
      ...board,
      ...withLogCounts(board, { ...bigKeys, ...counted }, dated),
      keys: { ...smallKeys },
      medallions,
      prizes,
    };
    const solved = solveAt(input);
    solves++;
    inputs.push(input);
    tris.push(solved);
    for (const [location, tri] of Object.entries(solved)) {
      if (tri === "yes" && !first.has(location)) first.set(location, index);
    }
    yield;
  }

  // A key never taken leaves its dungeon's logic short of the seed's: there,
  // a needed place is in logic at the latest once every needed item of the
  // spheres before its own was held, the playthrough's own bound
  const short = new Set(
    [...keyOf]
      .filter(([place]) => !placeTaken.has(place))
      .map(([, { dungeon: id }]) => id),
  );
  const sphereOf = new Map(
    log.placements.map((p) => [p.location, p.sphere] as const),
  );
  const rowsBefore = (sphere: number) =>
    required(comparison.rows).filter(
      ({ entry, state }) =>
        (entry.placement.sphere ?? 0) < sphere &&
        state !== "unknown" &&
        state !== "untimed",
    );
  const capOf = (sphere: number): number | undefined => {
    let cap = 0;
    for (const row of rowsBefore(sphere)) {
      const at =
        row.entry.find === null ? undefined : indexOfAt.get(row.entry.find.at);
      if (at === undefined) return undefined;
      cap = Math.max(cap, at);
    }
    return cap;
  };
  const reachIndexOf = (location: string): number | undefined => {
    const solved = first.get(location);
    const sphere = sphereOf.get(location);
    const owner = DUNGEONS.find(({ id }) => location.startsWith(`${id}/`));
    if (sphere === null || sphere === undefined || owner === undefined) {
      return solved;
    }
    if (!short.has(owner.id)) return solved;
    const cap = capOf(sphere);
    if (cap === undefined) return solved;
    return solved === undefined ? cap : Math.min(solved, cap);
  };

  // Play time: the run timer's reading less the breaks before it
  const points = [
    ...new Set([
      ...steps
        .slice(1)
        .filter(({ timed }) => timed)
        .map((step) => step.ms),
      endMs,
    ]),
  ].sort((a, b) => a - b);
  const gaps: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const [a = 0, b = 0] = [points[i - 1], points[i]];
    if (b - a >= BREAK_MS) gaps.push([a, b]);
  }
  const play = (ms: number) =>
    ms - gaps.reduce((sum, [a, b]) => (b <= ms ? sum + b - a : sum), 0);
  const playAt = (index: number) => play(steps[index]?.ms ?? 0);
  const timerEnd = Math.max(endMs, points.at(-1) ?? 0);

  // Each needed item, paired with the k-th copy reached and taken
  const needed = new Set(
    required(comparison.rows).flatMap(
      ({ entry }) => entry.placement.item ?? [],
    ),
  );
  const labels = labelsOfLog(log);
  const copiesOf = new Map<string, ReviewRow[]>();
  for (const row of comparison.rows) {
    const { item, location } = row.entry.placement;
    if (item === null || !onMap(location)) continue;
    copiesOf.set(item, [...(copiesOf.get(item) ?? []), row]);
  }
  const keysByItem = new Map<string, string[]>();
  for (const step of steps) {
    for (const key of step.keys) {
      const item = packItemOf(key);
      if (item !== undefined) {
        keysByItem.set(item, [...(keysByItem.get(item) ?? []), key]);
      }
    }
  }
  const itemKeys = (item: string): readonly string[] =>
    keysByItem.get(item) ?? [];
  const reachOf = (row: ReviewRow) =>
    reachIndexOf(row.entry.placement.location);
  const takenOf = (row: ReviewRow) =>
    row.entry.find === null ? undefined : indexOfAt.get(row.entry.find.at);
  const byTime =
    (of: (row: ReviewRow) => number | undefined) =>
    (rows: readonly ReviewRow[]) =>
      rows
        .filter((row) => of(row) !== undefined)
        .sort((a, b) => (of(a) ?? 0) - (of(b) ?? 0));

  const waits: (Wait & { reachIndex?: number; takenIndex?: number })[] = [];
  for (const row of required(comparison.rows)) {
    const { item, location, sphere } = row.entry.placement;
    const copies = item === null ? undefined : copiesOf.get(item);
    if (item === null || sphere === null || copies === undefined) continue;
    if (!onMap(location)) continue;
    const order = copies
      .filter(({ entry }) => entry.placement.sphere !== null)
      .sort(
        (a, b) =>
          (a.entry.placement.sphere ?? 0) - (b.entry.placement.sphere ?? 0) ||
          a.entry.placement.locationName.localeCompare(
            b.entry.placement.locationName,
          ),
      );
    const k = order.indexOf(row);
    const reached = byTime(reachOf)(copies)[k];
    const takenRow = byTime(takenOf)(copies)[k];
    const reachIndex = reached === undefined ? undefined : reachOf(reached);
    const takenIndex = takenRow === undefined ? undefined : takenOf(takenRow);
    // The k-th time the board got this item (a check and its item may be
    // stamped apart): its name and picture, and what the chain follows
    const takenKey = takenRow === undefined ? undefined : itemKeys(item)[k];
    const reach = reachIndex === undefined ? null : playAt(reachIndex);
    const taken = takenIndex === undefined ? null : playAt(takenIndex);
    waits.push({
      after:
        reachIndex === undefined || reachIndex === 0
          ? null
          : afterOf(steps[reachIndex] as Step, needed),
      copies: copies.length,
      icon:
        takenKey === undefined
          ? (labels.byLocation.get(location)?.icon?.replace(/\.png$/, "") ??
            null)
          : (findIcon(takenKey)?.replace(/\.png$/, "") ?? null),
      inferred: takenRow?.entry.inferred ?? false,
      item,
      kind: kindOf(item),
      location,
      name:
        takenKey === undefined
          ? row.entry.placement.itemName
          : findName(takenKey),
      opened: [],
      place: takenRow?.entry.placement.location ?? null,
      reach,
      reachIndex,
      sphere,
      taken,
      takenIndex,
      takenKey: takenKey ?? null,
      tradeOff: null,
      waited: reach === null || taken === null ? null : taken - reach,
      where:
        takenRow === undefined
          ? null
          : withCost(
              takenRow.entry.placement.locationName,
              takenRow.entry.placement.location,
            ),
    });
  }

  // What an item that waited would have opened: when taken, and earlier,
  // its derived facts worked out again with it (toState)
  const plusOne = (index: number, item: string): TrackerInput => {
    const input = inputs[index] as TrackerInput;
    const items = input.items as Record<string, number>;
    return { ...input, items: { ...items, [item]: (items[item] ?? 0) + 1 } };
  };
  const newlyYes = (
    after: Readonly<Record<string, string>>,
    before: Readonly<Record<string, string>>,
  ) =>
    Object.keys(after).filter(
      (location) => after[location] === "yes" && before[location] !== "yes",
    );
  for (const [index, wait] of waits.entries()) {
    const { reachIndex, takenIndex } = wait;
    if (
      wait.kind !== "major" ||
      reachIndex === undefined ||
      takenIndex === undefined ||
      takenIndex <= reachIndex
    ) {
      continue;
    }
    const before = takenIndex - 1;
    const opened = newlyYes(
      solveAt(plusOne(before, wait.item)),
      tris[before] ?? {},
    );
    solves++;
    yield;
    let tradeOff: TradeOff | null = null;
    for (let t = reachIndex; t < takenIndex; t++) {
      const could = newlyYes(solveAt(plusOne(t, wait.item)), tris[t] ?? {});
      solves++;
      yield;
      if (could.length > 0) {
        tradeOff = {
          after: t === 0 ? null : afterOf(steps[t] as Step, needed),
          at: playAt(t),
          opened: could,
        };
        break;
      }
    }
    waits[index] = { ...wait, opened, tradeOff };
  }

  // The dungeons: part in logic, all in logic, entered, boss beaten
  const last = tris.at(-1) ?? {};
  const keyIndex = new Map<string, number>();
  for (const [index, step] of steps.entries()) {
    for (const key of step.keys) keyIndex.set(key, index);
  }
  const dungeons = markersOf(settings).flatMap((marker): DungeonTimes[] => {
    if (marker.dungeon === undefined) return [];
    const locations = marker.locations.filter((id) => id in last);
    if (locations.length === 0) return [];
    const firsts = locations.map(reachIndexOf);
    const known = firsts.filter((index) => index !== undefined);
    const partial = known.length === 0 ? undefined : Math.min(...known);
    const full =
      known.length === locations.length ? Math.max(...known) : undefined;
    const entered = locations
      .map((id) => keyIndex.get(`check:${id}`))
      .filter((index) => index !== undefined);
    // Beaten: its boss's place checked, or the boss marked, whichever came first
    const place = bossLocation(dungeon(marker.dungeon), settings);
    const beaten = [
      place === undefined ? undefined : keyIndex.get(`check:${place}`),
      keyIndex.get(bossKey(marker.dungeon) ?? ""),
    ].filter((index) => index !== undefined);
    const finished = beaten.length === 0 ? undefined : Math.min(...beaten);
    return [
      {
        atPartial: locations.filter((_, i) => firsts[i] === partial),
        entered: entered.length === 0 ? null : playAt(Math.min(...entered)),
        finished: finished === undefined ? null : playAt(finished),
        full: full === undefined ? null : playAt(full),
        fullAfter:
          full === undefined || full === 0
            ? null
            : afterOf(steps[full] as Step, needed),
        id: marker.dungeon,
        name: marker.name,
        partial: partial === undefined ? null : playAt(partial),
        reaches: Object.fromEntries(
          locations.map((id, i) => {
            const at = firsts[i];
            return [id, at === undefined ? null : playAt(at)];
          }),
        ),
        total: locations.length,
      },
    ];
  });

  return {
    breaks: gaps.map(([a, b]) => ({ at: play(a), length: b - a })),
    dungeonChecks: dungeonChecksStamped(run) === "inside",
    dungeons,
    end: play(timerEnd),
    solves,
    timerEnd,
    waits: waits
      .map(({ reachIndex: _, takenIndex: __, ...wait }) => wait)
      .sort(
        (a, b) =>
          (b.waited ?? Number.NEGATIVE_INFINITY) -
          (a.waited ?? Number.NEGATIVE_INFINITY),
      ),
  };
}

/** Runs a sweep to its end at once (specs, and a page with no time to slice). */
export const drain = <T>(work: Generator<void, T, void>): T => {
  for (;;) {
    const next = work.next();
    if (next.done === true) return next.value;
  }
};

/** The longest chain of needed items each in logic once the one before was held. */
export const chainOf = (waits: readonly Wait[]): Wait[] => {
  const byKey = new Map(
    waits.flatMap((wait) =>
      wait.takenKey === null ? [] : [[wait.takenKey, wait] as const],
    ),
  );
  const chains = new Map<Wait, Wait[]>();
  const chainTo = (wait: Wait, seen: Set<Wait>): Wait[] => {
    const known = chains.get(wait);
    if (known !== undefined) return known;
    const before = wait.after === null ? undefined : byKey.get(wait.after.key);
    const chain =
      before === undefined ||
      seen.has(before) ||
      before.kind !== "major" ||
      before.reach === null
        ? [wait]
        : [...chainTo(before, new Set([...seen, wait])), wait];
    chains.set(wait, chain);
    return chain;
  };
  let best: Wait[] = [];
  for (const wait of waits) {
    // An item never in logic has no place in it, whenever it was taken
    if (wait.kind !== "major" || wait.taken === null || wait.reach === null) {
      continue;
    }
    const chain = chainTo(wait, new Set([wait]));
    const end = chain.at(-1)?.taken ?? 0;
    if (
      chain.length > best.length ||
      (chain.length === best.length && end > (best.at(-1)?.taken ?? 0))
    ) {
      best = chain;
    }
  }
  return best;
};

// Super Metroid's side of reviewing a finished run: what the run says that a
// Map Rando spoiler log can contradict (binding), and what the board holds
// set against what the seed placed (rows). Pure: the board draws it. The
// game-agnostic rule (`bindSeed`) is @alltp/spoiler's, the facts a log and a
// run share are the pack's (`mapRandoEvidence`); this module turns the
// tracker's run into their terms.
//
// The board tracks items, not Map Rando's locations (the rooms are
// reconnected, there is no map and no logic), and its run keeps no timeline.
// So the review says what the spoiler says, where each item was, in the
// playthrough's order, and sets it against the item counts the board holds:
// which items the run never got. It cannot say which location was found, nor
// when.

import {
  type MapRandoLog,
  type MapRandoRun,
  mapRandoEvidence,
  OBJECTIVES,
  SM_ITEMS,
  type SmItemId,
} from "@alltp/pack-sm";
import { type Binding, bindSeed, type Placement } from "@alltp/spoiler";
import { freshProgress, type SmProgress } from "@/games/sm/store";

/** The run, as far as a review reads it. */
export type ReviewedRun = Pick<
  SmProgress,
  "items" | "objectives" | "seed" | "splitSpeed" | "wallJump"
>;

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * What the run states of its seed, for the pack's evidence. The board's
 * objectives and options start at a default (the four bosses, no extra
 * item), which a player who tracks by hand never declared: such a value
 * would contradict any other seed. A value counts when the ROM stated it
 * (autotracking read the seed, so the run knows its name) or when the player
 * moved it off the default.
 */
export const runStatements = (run: ReviewedRun): MapRandoRun => {
  const fresh = freshProgress();
  const read = run.seed !== null;
  return {
    objectives:
      read || !sameSet(run.objectives, fresh.objectives)
        ? run.objectives
        : null,
    splitSpeed: read || run.splitSpeed ? run.splitSpeed : null,
    wallJump: read || run.wallJump ? run.wallJump : null,
  };
};

/**
 * Whether a log is the run's. Map Rando's file names no seed, so it is never
 * verified: it is refused when a fact both sides state differs (the
 * objectives, the Wall Jump Boots, the split Speed Booster), otherwise
 * "not verified".
 */
export const bindRun = (log: MapRandoLog, run: ReviewedRun): Binding =>
  bindSeed(mapRandoEvidence(log.extra, runStatements(run)));

/** The most of an item the game's pool holds: 1 for an item held or not. */
const MAX = new Map<string, number>(
  SM_ITEMS.map((item) => [item.id, item.max]),
);

/** Where a placement is, in words: "Aqueduct: Top Right Left Item (Crateria)". */
export const whereWords = (placement: Placement): string =>
  placement.area === null
    ? placement.locationName
    : `${placement.locationName} (${placement.area})`;

/** The step of a placement, for order: one outside any step goes last. */
const stepOf = (placement: Placement): number =>
  placement.sphere ?? Number.POSITIVE_INFINITY;

const byStep = (a: Placement, b: Placement): number =>
  stepOf(a) - stepOf(b) || a.locationName.localeCompare(b.locationName);

/** An item held or not, which the seed placed once. */
export type MajorRow = {
  readonly id: SmItemId;
  readonly placement: Placement;
  /** The board holds it. */
  readonly held: boolean;
};

/** A pack or tank type: how many the board holds of those the seed placed. */
export type CountedRow = {
  readonly id: SmItemId;
  readonly held: number;
  readonly placed: number;
  /** Where the seed put them, in the playthrough's order. */
  readonly places: readonly Placement[];
};

export type ReviewComparison = {
  /** The seed's single items: those never held first, then in the playthrough's order. */
  readonly majors: readonly MajorRow[];
  /** Packs and tanks, in the pack's order. */
  readonly counted: readonly CountedRow[];
  readonly summary: {
    readonly majors: number;
    readonly neverFound: number;
    /** Packs and tanks the seed placed that the board does not hold. */
    readonly packsLeft: number;
  };
};

/**
 * The board's items set against what the seed placed.
 * @param log - The Map Rando log
 * @param items - The run's counts, by item id
 */
export const compareItems = (
  log: MapRandoLog,
  items: Readonly<Partial<Record<SmItemId, number>>>,
): ReviewComparison => {
  const majors: MajorRow[] = [];
  const places = new Map<SmItemId, Placement[]>();
  for (const placement of log.placements) {
    const id = placement.item as SmItemId | null;
    if (id === null) continue;
    if (MAX.get(id) === 1) {
      majors.push({ held: (items[id] ?? 0) > 0, id, placement });
    } else {
      places.set(id, [...(places.get(id) ?? []), placement]);
    }
  }
  majors.sort(
    (a, b) =>
      Number(a.held) - Number(b.held) || byStep(a.placement, b.placement),
  );
  const counted: CountedRow[] = [];
  for (const { id } of SM_ITEMS) {
    const where = places.get(id);
    if (where === undefined) continue;
    counted.push({
      held: items[id] ?? 0,
      id,
      placed: where.length,
      places: [...where].sort(byStep),
    });
  }
  return {
    counted,
    majors,
    summary: {
      majors: majors.length,
      neverFound: majors.filter(({ held }) => !held).length,
      packsLeft: counted.reduce(
        (sum, row) => sum + Math.max(0, row.placed - row.held),
        0,
      ),
    },
  };
};

/** Map Rando's areas in the order of the game's map; others follow. */
const AREAS = [
  "Crateria",
  "Brinstar",
  "Norfair",
  "Wrecked Ship",
  "Maridia",
  "Tourian",
];

/** Placements grouped by area, the game's areas first, each group in step order. */
export const byArea = (
  placements: readonly Placement[],
): readonly (readonly [string, readonly Placement[]])[] => {
  const groups = new Map<string, Placement[]>();
  for (const placement of placements) {
    const area = placement.area ?? "Elsewhere";
    groups.set(area, [...(groups.get(area) ?? []), placement]);
  }
  const rank = (area: string) => {
    const at = AREAS.indexOf(area);
    return at < 0 ? AREAS.length : at;
  };
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([area, group]) => [area, [...group].sort(byStep)] as const);
};

const PLACES = new WeakMap<MapRandoLog, Map<string, Placement[]>>();

/**
 * Every place the seed put an item, by the item's id: what a grid cell says of
 * itself in review. Built once per log.
 */
export const placesByItem = (
  log: MapRandoLog,
): ReadonlyMap<string, readonly Placement[]> => {
  let found = PLACES.get(log);
  if (found === undefined) {
    found = new Map<string, Placement[]>();
    for (const placement of [...log.placements].sort(byStep)) {
      if (placement.item === null) continue;
      found.set(placement.item, [
        ...(found.get(placement.item) ?? []),
        placement,
      ]);
    }
    PLACES.set(log, found);
  }
  return found;
};

/** A grid cell's words in review: where the seed put its item, or null. */
export const cellWords = (
  places: readonly Placement[] | undefined,
): string | null => {
  const [first] = places ?? [];
  if (places === undefined || first === undefined) return null;
  return places.length === 1
    ? `In the seed: ${whereWords(first)}.`
    : `In the seed: ${places.length} places.`;
};

const OBJECTIVE_NAME = new Map(OBJECTIVES.map((o) => [o.id, o.name]));

/** The seed's own facts, as label and value rows. */
export const seedFacts = (
  log: MapRandoLog,
): readonly (readonly [string, string])[] => {
  const { ammo, objectives, startLocation } = log.extra;
  return [
    ["Start", startLocation.name],
    [
      "Objectives",
      objectives.length === 0
        ? "None"
        : objectives.map((id) => OBJECTIVE_NAME.get(id) ?? id).join(", "),
    ],
    [
      "A pack gives",
      `${ammo.missile} missiles, ${ammo.superMissile} super missiles, ${ammo.powerBomb} power bombs`,
    ],
  ];
};

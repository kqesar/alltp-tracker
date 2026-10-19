// The entrance assistant's model: what the pack's entrance randomizer tables
// (packs/alttpr/src/entrances.ts) mean for a run with shuffled entrances.
// Only the assistant's own components and autotracking's follower import
// it, each on demand: a run without shuffled entrances never downloads the
// tables.

import {
  type CrossedPool,
  crossedPool,
  type EntranceLink,
  type EntranceTarget,
  linksOf,
  type MapMarker,
  type OverworldEntrance,
  PLACE_OF_LOCATION,
  TARGETS,
} from "@alltp/pack-alttpr";
import { entrancesKnown, type RunSettings } from "@/games/alttpr/data/presets";

const pools = {
  open: crossedPool("open"),
  standard: crossedPool("standard"),
} as const;

/**
 * The entrances a run shuffles, or null when the assistant has none for its
 * world: Inverted's crossed shuffle runs tables of its own, not ported yet.
 */
export const poolOf = (settings: RunSettings): CrossedPool | null =>
  !entrancesKnown(settings)
    ? null
    : settings.mode === "standard"
      ? pools.standard
      : pools.open;

const ENTRANCE_BY_ID = new Map(
  [...pools.open.entrances, ...pools.standard.entrances].map((e) => [e.id, e]),
);
const TARGET_BY_ID = new Map(TARGETS.map((t) => [t.id, t]));

/** An entrance of the shuffle by id, or undefined. */
export const entranceById = (id: string): OverworldEntrance | undefined =>
  ENTRANCE_BY_ID.get(id);

/** A target by id, or undefined for one this version does not know. */
export const targetById = (id: string): EntranceTarget | undefined =>
  TARGET_BY_ID.get(id);

/** What an entrance may lead to, as the shuffle has it (`targetsOf`). */
export const targetsFor = (
  pool: CrossedPool,
  entrance: OverworldEntrance,
): readonly EntranceTarget[] => pool.targetsOf.get(entrance.id) ?? [];

/**
 * What noting `target` at `entrance` notes: it, and the other way into the
 * same cave when it is a hole or a hole's door (`partner`). One step.
 */
export const notesFor = (
  pool: CrossedPool,
  entrance: string,
  target: string,
): Record<string, string> => {
  const partner = pool.partner(entrance, target);
  return partner === undefined
    ? { [entrance]: target }
    : { [entrance]: target, [partner[0]]: partner[1] };
};

/**
 * What the game shows Link went through notes (autotracking, outside Race
 * Mode): each door or hole to its target, with its partner (`notesFor`),
 * when the shuffle may give it that target. Of targets alike, which the
 * game loads by one entrance, it keeps the one noted there, else takes the
 * first noted nowhere. The game wins over a note it contradicts.
 */
export const gameNotes = (
  pool: CrossedPool,
  noted: Readonly<Record<string, string>>,
  links: readonly EntranceLink[],
): Record<string, string> => {
  const notes: Record<string, string> = {};
  for (const { entrance, targets } of linksOf(links)) {
    const may = new Set(pool.targetsOf.get(entrance)?.map((t) => t.id));
    const fits = targets.filter((target) => may.has(target));
    const elsewhere = new Set(
      Object.entries(noted).flatMap(([id, to]) =>
        id === entrance ? [] : [to],
      ),
    );
    const target =
      fits.find((t) => t === noted[entrance]) ??
      fits.find((t) => !elsewhere.has(t)) ??
      fits[0];
    if (target !== undefined)
      Object.assign(notes, notesFor(pool, entrance, target));
  }
  return notes;
};

/** How far apart two entrance markers stand, in percent of their world. */
const GAP = 4.5;
/** How far a marker may move from its door, likewise. */
const DRIFT = 3.5;

/**
 * Where each entrance's marker is drawn: its door's spot, but pushed away
 * from the markers it would cover. Doors side by side in one cliff (Good
 * Bee Cave and Ice Rod Cave, a hole beside its cave's door) would hide one
 * another. Neighbours too close push each other apart, a few rounds, none
 * drifting more than DRIFT from its door. Worked out once per pool.
 */
export const layoutEntrances = (
  entrances: readonly OverworldEntrance[],
): ReadonlyMap<string, { readonly x: number; readonly y: number }> => {
  // In each world's own percents, so a step is as long across as down
  const points = entrances.map((e) => {
    const left = e.world === "dark" ? 50 : 0;
    const x = (e.x - left) * 2;
    return { e, home: { x, y: e.y }, left, x, y: e.y };
  });
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (a === undefined || b === undefined || a.e.world !== b.e.world)
          continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= GAP) continue;
        // Apart along the line between them, sideways when on one spot
        const [ux, uy] = d === 0 ? [1, 0] : [dx / d, dy / d];
        const push = (GAP - d) / 2;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    for (const p of points) {
      const dx = p.x - p.home.x;
      const dy = p.y - p.home.y;
      const drift = Math.hypot(dx, dy);
      if (drift > DRIFT) {
        p.x = p.home.x + (dx * DRIFT) / drift;
        p.y = p.home.y + (dy * DRIFT) / drift;
      }
      p.x = Math.min(99, Math.max(1, p.x));
      p.y = Math.min(99, Math.max(1, p.y));
    }
    if (!moved) break;
  }
  return new Map(
    points.map((p) => [p.e.id, { x: p.left + p.x / 2, y: p.y }] as const),
  );
};

const layouts = new WeakMap<CrossedPool, ReturnType<typeof layoutEntrances>>();

/** layoutEntrances of a pool, worked out once. */
export const layoutOf = (pool: CrossedPool) => {
  let layout = layouts.get(pool);
  if (layout === undefined) {
    layout = layoutEntrances(pool.entrances);
    layouts.set(pool, layout);
  }
  return layout;
};

/** A marker's place: the one place every check of it lies in, if any. */
const placeOf = (marker: MapMarker): string | undefined => {
  const [first, ...rest] = marker.locations.map((id) =>
    PLACE_OF_LOCATION.get(id),
  );
  return first !== undefined && rest.every((place) => place === first)
    ? first
    : undefined;
};

/** How far apart the checks of one place stand, in percent of the map. */
const SPREAD = 2.6;

/**
 * The map's markers in a run with shuffled entrances. A marker whose checks
 * all lie inside one place the shuffle mixes leaves its vanilla spot: it
 * stands just above the first entrance noted to lead into that place (in
 * the pool's order), beside the place's other markers, or nowhere until
 * one is. Any other marker stays.
 * @param pool - The run's shuffle
 * @param noted - The entrances noted: entrance id to target id
 * @param markers - The run's world's markers
 */
export const placeMarkers = (
  pool: CrossedPool,
  noted: Readonly<Record<string, string>>,
  markers: readonly MapMarker[],
): MapMarker[] => {
  const doorOf = new Map<string, OverworldEntrance>();
  for (const entrance of pool.entrances) {
    const target = targetById(noted[entrance.id] ?? "");
    if (target !== undefined && !doorOf.has(target.place))
      doorOf.set(target.place, entrance);
  }
  const placed: MapMarker[] = [];
  const count = new Map<string, number>();
  for (const marker of markers) {
    const place = placeOf(marker);
    if (place === undefined) {
      placed.push(marker);
      continue;
    }
    const door = doorOf.get(place);
    if (door === undefined) continue;
    const index = count.get(place) ?? 0;
    count.set(place, index + 1);
    // Above the door's marker, the place's side by side, in its world
    const at = layoutOf(pool).get(door.id) ?? door;
    const left = door.world === "dark" ? 51 : 1;
    placed.push({
      ...marker,
      x: Math.min(left + 48, Math.max(left, at.x + index * SPREAD)),
      y: Math.max(1, at.y - SPREAD),
    });
  }
  return placed;
};

/** A target in words: "Elder House (East)", "Blind's Hideout". */
export const targetText = (target: EntranceTarget): string =>
  target.side === undefined ? target.place : `${target.place} (${target.side})`;

/** The headings a picker groups targets under, by kind. */
export const KIND_HEADINGS: Readonly<Record<EntranceTarget["kind"], string>> = {
  connector: "Caves with several doors",
  drop: "Where it drops",
  dungeon: "Dungeons",
  single: "Shops, houses and other places",
};

/**
 * An entrance's marker in words, for its accessible name and its tooltip:
 * "Kakariko Shop: leads to Elder House (East)", "…: not known yet".
 */
export const entranceText = (
  entrance: OverworldEntrance,
  target: EntranceTarget | undefined,
): string =>
  `${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""}: ${
    target === undefined ? "not known yet" : `leads to ${targetText(target)}`
  }`;

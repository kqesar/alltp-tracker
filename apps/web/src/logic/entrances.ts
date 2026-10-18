// The entrance assistant's model: what the pack's entrance randomizer tables
// (packs/alttpr/src/entrances.ts) mean for a run with shuffled entrances.
// Only the assistant's own components import it, each loaded on demand: a
// run without shuffled entrances never downloads the tables.

import {
  type CrossedPool,
  crossedPool,
  type EntranceTarget,
  type MapMarker,
  type OverworldEntrance,
  PLACE_OF_LOCATION,
  TARGETS,
} from "@alltp/pack-alttpr";
import type { RunSettings } from "@/data/presets";

const pools = {
  open: crossedPool("open"),
  standard: crossedPool("standard"),
} as const;

/**
 * The entrances a run shuffles, or null when the assistant has none for its
 * world: Inverted's crossed shuffle runs tables of its own, not ported yet.
 */
export const poolOf = (settings: RunSettings): CrossedPool | null =>
  settings.entranceShuffle === "none"
    ? null
    : settings.mode === "standard"
      ? pools.standard
      : settings.mode === "inverted"
        ? null
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
    // Above the door, the place's markers side by side, in its world
    const left = door.world === "dark" ? 51 : 1;
    placed.push({
      ...marker,
      x: Math.min(left + 48, Math.max(left, door.x + index * SPREAD)),
      y: Math.max(1, door.y - SPREAD),
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

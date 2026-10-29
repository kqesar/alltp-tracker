// A Door Randomizer run's own checks: its key drops, pots, enemy drops and
// shop items (the pack's door-rando/locations.ts), as the Checks list shows
// them. No rule of the pack reads them yet: DR's dungeon logic is a later
// step. Meanwhile a check shows maybe, but one in a dungeon the run cannot
// enter (its region `no` in the run's world), which shows out of logic: no
// way in, no way to it.
import { type DrLocation, type DungeonId, dungeon } from "@alltp/pack-alttpr";
import { doorLocationsOf } from "@/games/alttpr/data/doorRando";
import type { RunSettings } from "@/games/alttpr/data/presets";
import {
  type MarkerInputs,
  type MarkerState,
  solutionOf,
} from "@/games/alttpr/logic/solution";

/** What a run's DR check shows: done once checked, else maybe or out of logic. */
export const doorStateOf = (
  location: DrLocation,
  state: MarkerInputs,
): MarkerState => {
  if (state.checked[location.id]) return "opened";
  if (location.dungeon === null) return "possible";
  const solution = solutionOf(state);
  // Under logic the pack does not model, or a crossed world's own regions
  if (!solution.modelled || solution.crossed !== undefined) return "possible";
  return solution.keyed.solution.region(dungeon(location.dungeon).region) ===
    "no"
    ? "unavailable"
    : "possible";
};

/** One of a run's DR checks, by zone: a dungeon's, or a cave's or shop's. */
export type DoorZoneChecks = {
  /** The dungeon's name, or the DR region's ("Kakariko Shop"). */
  readonly name: string;
  readonly dungeon?: DungeonId;
  readonly locations: readonly DrLocation[];
};

const zones = new WeakMap<readonly DrLocation[], readonly DoorZoneChecks[]>();

/**
 * A run's DR checks by zone, in the pack's order: a dungeon's under its
 * name, a cave's or a shop's under its DR region. Memoized per list.
 */
export const doorZonesOf = (
  settings: RunSettings,
): readonly DoorZoneChecks[] => {
  const { locations } = doorLocationsOf(settings);
  const found = zones.get(locations);
  if (found !== undefined) return found;
  const byName = new Map<
    string,
    DoorZoneChecks & { locations: DrLocation[] }
  >();
  for (const location of locations) {
    const name =
      location.dungeon === null
        ? location.region
        : dungeon(location.dungeon).name;
    const zone = byName.get(name) ?? {
      ...(location.dungeon === null ? {} : { dungeon: location.dungeon }),
      locations: [],
      name,
    };
    zone.locations.push(location);
    byName.set(name, zone);
  }
  const made = [...byName.values()];
  zones.set(locations, made);
  return made;
};

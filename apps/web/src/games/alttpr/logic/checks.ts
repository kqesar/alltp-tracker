// The Checks panel's model: every location of the map's markers, grouped by
// zone in upstream's world order, and what each shows. The panel lists the
// same locations as the map, so the two never disagree on what is left. A
// Door Randomizer run adds its own (logic/doorChecks.ts), which no marker
// stands for: its key drops, pots, enemies and shop items.
import {
  type AlttprSettings,
  DUNGEONS,
  type DungeonId,
  dungeonLocations,
  MAP_LOCATIONS,
  regionModules,
  rupeeCostOf,
} from "@alltp/pack-alttpr";
import { doorLocationById } from "@/games/alttpr/data/doorRando";
import {
  type DoorZoneChecks,
  doorStateOf,
  doorZonesOf,
} from "@/games/alttpr/logic/doorChecks";
import { worldOf } from "@/games/alttpr/logic/settings";

import {
  clearedStateOf,
  isCountedOut,
  locationName,
  locationStateOf,
  type MarkerInputs,
  type MarkerState,
  solutionOf,
} from "@/games/alttpr/logic/solution";

/** One check: a location of a map marker. */
export type Check = {
  readonly id: string;
  /** Its name in its zone: "Compass Chest" in Eastern Palace. */
  readonly name: string;
  /** Rupees the game takes to give it; shown only, the logic ignores it. */
  readonly cost?: number;
  /**
   * A Door Randomizer location (a key drop, a pot, an enemy, a shop item),
   * which no rule reads yet: no analysis says what it misses.
   */
  readonly door?: true;
};

/** A zone of the world and the checks in it, in upstream's order. */
export type Zone = {
  /** A dungeon's name, or an upstream region's ("North East Light World"). */
  readonly name: string;
  /** The dungeon it is, whose counter may say it holds nothing more. */
  readonly dungeon?: DungeonId;
  readonly checks: readonly Check[];
};

const zones = new Map<string, readonly Zone[]>();

/**
 * The map's checks by zone, in upstream's world order: a dungeon's under the
 * dungeon's name (Hyrule Castle for upstream's Escape), any other under its
 * upstream region's, or the module's last named region for a part split off
 * one. Memoized per world.
 */
export const zonesOf = (settings: AlttprSettings): readonly Zone[] => {
  const world = worldOf(settings);
  const found = zones.get(world);
  if (found !== undefined) return found;
  const dungeonOf = new Map<string, (typeof DUNGEONS)[number]>(
    DUNGEONS.flatMap((d) => dungeonLocations(d, settings).map((id) => [id, d])),
  );
  const byName = new Map<string, { dungeon?: DungeonId; ids: string[] }>();
  for (const module of regionModules(settings)) {
    let regionName = "";
    for (const region of module.regions) {
      regionName = region.name ?? regionName;
      for (const { id } of region.locations) {
        if (!MAP_LOCATIONS.has(id)) continue;
        const d = dungeonOf.get(id);
        const name = d?.name ?? regionName;
        const zone = byName.get(name) ?? { dungeon: d?.id, ids: [] };
        zone.ids.push(id);
        byName.set(name, zone);
      }
    }
  }
  const made = [...byName].map(([name, { dungeon, ids }]) => ({
    checks: ids.map((id) => {
      const full = locationName(id);
      const cost = rupeeCostOf(id);
      return {
        ...(cost === undefined ? {} : { cost }),
        id,
        name: full.startsWith(`${name} - `)
          ? full.slice(name.length + 3)
          : full,
      };
    }),
    dungeon,
    name,
  }));
  zones.set(world, made);
  return made;
};

const withDoor = new WeakMap<
  readonly Zone[],
  WeakMap<readonly DoorZoneChecks[], readonly Zone[]>
>();

/**
 * The map's zones and a Door Randomizer run's checks: a dungeon's join its
 * zone, after the map's; a cave's or a shop's make zones of their own,
 * after the map's. Memoized per both.
 */
const joinZones = (
  map: readonly Zone[],
  door: readonly DoorZoneChecks[],
): readonly Zone[] => {
  if (door.length === 0) return map;
  let byDoor = withDoor.get(map);
  if (byDoor === undefined) {
    byDoor = new WeakMap();
    withDoor.set(map, byDoor);
  }
  const found = byDoor.get(door);
  if (found !== undefined) return found;
  const checksOf = (zone: DoorZoneChecks): Check[] =>
    zone.locations.map((location) => ({
      door: true,
      id: location.id,
      name: location.name.startsWith(`${zone.name} - `)
        ? location.name.slice(zone.name.length + 3)
        : location.name,
    }));
  const extra = new Map(door.map((zone) => [zone.name, zone]));
  const joined: Zone[] = map.map((zone) => {
    const more = extra.get(zone.name);
    if (more === undefined) return zone;
    extra.delete(zone.name);
    return { ...zone, checks: [...zone.checks, ...checksOf(more)] };
  });
  for (const zone of extra.values()) {
    joined.push({
      checks: checksOf(zone),
      ...(zone.dungeon === undefined ? {} : { dungeon: zone.dungeon }),
      name: zone.name,
    });
  }
  byDoor.set(door, joined);
  return joined;
};

/** The run's zones, in its world, a Door Randomizer run's checks joined. */
export const runZones = (state: MarkerInputs): readonly Zone[] =>
  joinZones(zonesOf(solutionOf(state).settings), doorZonesOf(state.settings));

/**
 * Whether a dungeon tracked by its counter alone is counted down to 0
 * (`isCountedOut`): its checks are then all done but its boss's, which
 * follows the boss (`clearedStateOf`).
 */
export const isCleared = (zone: Zone, state: MarkerInputs): boolean =>
  zone.dungeon !== undefined && isCountedOut(zone.dungeon, state);

/** What every check of the run shows, by location id. */
export const checkStates = (
  state: MarkerInputs,
): Record<string, MarkerState> => {
  const states: Record<string, MarkerState> = {};
  for (const zone of runZones(state)) {
    const { dungeon } = zone;
    const cleared = isCleared(zone, state);
    for (const check of zone.checks) {
      const door = check.door ? doorLocationById(check.id) : undefined;
      states[check.id] =
        cleared && dungeon !== undefined
          ? clearedStateOf(dungeon, check.id, state)
          : door !== undefined
            ? doorStateOf(door, state)
            : locationStateOf(check.id, state);
    }
  }
  return states;
};

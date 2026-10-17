// The Checks panel's model: every location of the map's markers, grouped by
// zone in upstream's world order, and what each shows. The panel lists the
// same locations as the map, so the two never disagree on what is left.
import {
  type AlttprSettings,
  DUNGEONS,
  type DungeonId,
  dungeonLocations,
  MARKERS,
  regionModules,
} from "@alltp/pack-alttpr";
import {
  dungeonCount,
  locationName,
  locationStateOf,
  type MarkerInputs,
  type MarkerState,
  solutionOf,
} from "@/logic/solution";

/** One check: a location of a map marker. */
export type Check = {
  readonly id: string;
  /** Its name in its zone: "Compass Chest" in Eastern Palace. */
  readonly name: string;
};

/** A zone of the world and the checks in it, in upstream's order. */
export type Zone = {
  /** A dungeon's name, or an upstream region's ("North East Light World"). */
  readonly name: string;
  /** The dungeon it is, whose counter may say it holds nothing more. */
  readonly dungeon?: DungeonId;
  readonly checks: readonly Check[];
};

const ON_MAP: ReadonlySet<string> = new Set(
  MARKERS.flatMap((marker) => marker.locations),
);

const zones = new Map<boolean, readonly Zone[]>();

/**
 * The map's checks by zone, in upstream's world order: a dungeon's under the
 * dungeon's name (Hyrule Castle for upstream's Escape), any other under its
 * upstream region's, or the module's last named region for a part split off
 * one. Memoized per world: Open's and Standard's.
 */
export const zonesOf = (settings: AlttprSettings): readonly Zone[] => {
  const found = zones.get(settings.standardMode);
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
        if (!ON_MAP.has(id)) continue;
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
      return {
        id,
        name: full.startsWith(`${name} - `)
          ? full.slice(name.length + 3)
          : full,
      };
    }),
    dungeon,
    name,
  }));
  zones.set(settings.standardMode, made);
  return made;
};

/** The run's zones: Open's or Standard's world. */
export const runZones = (state: MarkerInputs): readonly Zone[] =>
  zonesOf(solutionOf(state).settings);

/**
 * Whether a dungeon's counter says it holds nothing more: its checks are
 * then all done, whatever is checked.
 */
export const isCleared = (zone: Zone, state: MarkerInputs): boolean =>
  zone.dungeon !== undefined && dungeonCount(zone.dungeon, state) === 0;

/** What every check of the run shows, by location id. */
export const checkStates = (
  state: MarkerInputs,
): Record<string, MarkerState> => {
  const states: Record<string, MarkerState> = {};
  for (const zone of runZones(state)) {
    const cleared = isCleared(zone, state);
    for (const { id } of zone.checks) {
      states[id] = cleared ? "opened" : locationStateOf(id, state);
    }
  }
  return states;
};

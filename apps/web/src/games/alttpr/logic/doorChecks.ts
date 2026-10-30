// A Door Randomizer run's own checks: its key drops, pots, enemy drops and
// shop items (the pack's door-rando/locations.ts), as the Checks list shows
// them, and the Overworld Randomizer's bonk drops, which the map draws too
// (bonkPlacesOf). In a run DR's own world holds (doorLogic), each shows its tri
// there: the key drops, pots, enemy drops and shop items are locations of
// that world with DR's rules; a take-any cave's item, which it does not
// hold, shows its DR region's.
// Elsewhere no rule of the pack reads them: a check shows maybe, but one in
// a dungeon the run cannot enter (its region `no` in the run's world), which
// shows out of logic: no way in, no way to it.
import type { Tri } from "@alltp/engine";
import {
  type DrLocation,
  type DungeonId,
  dungeon,
  type MapMarker,
  markerStatus,
  markersOf,
} from "@alltp/pack-alttpr";
import { doorLocationsOf } from "@/games/alttpr/data/doorRando";
import type { RunSettings } from "@/games/alttpr/data/presets";
import { packSettings } from "@/games/alttpr/logic/settings";
import {
  type MarkerInputs,
  type MarkerState,
  solutionOf,
} from "@/games/alttpr/logic/solution";
import { toWorldPosition } from "@/games/alttpr/utils";

/** What a run's DR check shows: done once checked, else its state. */
export const doorStateOf = (
  location: DrLocation,
  state: MarkerInputs,
): MarkerState => {
  if (state.checked[location.id]) return "opened";
  const solution = solutionOf(state);
  const { door } = solution;
  if (door !== undefined) {
    const own: Tri | undefined = solution.tris[location.id];
    return markerStatus([own ?? door.solver.region(door, location.region)]);
  }
  if (location.dungeon === null) return "possible";
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

/** The OWR world map's size, a side of each world (64 screens of 512). */
const OWR_MAP_SIZE = 4096;

/**
 * Half a marker's side, in percent of its world: a location's at its
 * smallest (24 px, the WCAG 2.5.8 target size, on the 358 px world a
 * 390 px phone lays out) and a dungeon's square (10.86cqw).
 */
const HALF_MARKER = 3.4;
const HALF_DUNGEON = 5.43;

/** How far a bonk place may be moved off its spot to stand clear. */
const REACH = 16;

/** Where the fork's map draws bonk drops: one place, its drops. */
export type BonkPlace = {
  /** `bonk-<world>-<x>-<y>`: the place's own id. */
  readonly id: string;
  readonly world: "light" | "dark";
  /** Percent of its world's square, from the left and from the top. */
  readonly x: number;
  readonly y: number;
  /** How far it was moved off its spot to stand clear of other markers. */
  readonly moved: number;
  /** The drops drawn there, in the pack's order. */
  readonly locations: readonly DrLocation[];
};

/** A marker's square: its middle and half its side, in its world's percents. */
type Square = { readonly x: number; readonly y: number; readonly half: number };

const clear = (x: number, y: number, squares: readonly Square[]) =>
  squares.every(
    (s) =>
      Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) >= s.half + HALF_MARKER,
  );

/**
 * The first spot near `home` clear of every square, ring by ring (a
 * percent a step), kept inside the world; `home` itself when none is.
 */
const clearSpot = (
  home: { readonly x: number; readonly y: number },
  squares: readonly Square[],
): { x: number; y: number; moved: number } => {
  for (let r = 0; r <= REACH; r++) {
    let best: { x: number; y: number; moved: number } | undefined;
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = home.x + dx;
        const y = home.y + dy;
        if (x < HALF_MARKER || x > 100 - HALF_MARKER) continue;
        if (y < HALF_MARKER || y > 100 - HALF_MARKER) continue;
        const moved = Math.hypot(dx, dy);
        if (clear(x, y, squares) && (best === undefined || moved < best.moved))
          best = { moved, x, y };
      }
    if (best !== undefined) return best;
  }
  return { ...home, moved: 0 };
};

const places = new WeakMap<
  readonly DrLocation[],
  WeakMap<readonly MapMarker[], readonly BonkPlace[]>
>();

/**
 * A run's bonk drops by the place the fork's own world map draws them
 * (`bonk.map`, its 4096-pixel square, in the dark world from screen $40
 * on): several share a rock pile or a tree line. Each place stands clear
 * of the run's other markers and of each other (most lie where a chest or
 * a cave already is), moved to the nearest spot that is, so no marker
 * hides another. A drop with no place (the cave's statue) is in the Checks
 * list alone. Memoized per list and markers.
 */
export const bonkPlacesOf = (settings: RunSettings): readonly BonkPlace[] => {
  const { locations } = doorLocationsOf(settings);
  const markers = markersOf(packSettings(settings));
  const byMarkers = places.get(locations) ?? new WeakMap();
  places.set(locations, byMarkers);
  const found = byMarkers.get(markers);
  if (found !== undefined) return found;
  const byPlace = new Map<
    string,
    {
      id: string;
      world: "light" | "dark";
      home: { x: number; y: number };
      locations: DrLocation[];
    }
  >();
  for (const location of locations) {
    const map = location.bonk?.map;
    if (map === undefined || location.flag.memory !== "overworld") continue;
    const world = location.flag.screen >= 0x40 ? "dark" : "light";
    const id = `bonk-${world}-${map.x}-${map.y}`;
    const place = byPlace.get(id) ?? {
      home: {
        x: (map.x / OWR_MAP_SIZE) * 100,
        y: (map.y / OWR_MAP_SIZE) * 100,
      },
      id,
      locations: [],
      world,
    };
    place.locations.push(location);
    byPlace.set(id, place);
  }
  const squares: Record<"light" | "dark", Square[]> = { dark: [], light: [] };
  for (const marker of markers) {
    const at = toWorldPosition(`${marker.x}%`, `${marker.y}%`);
    squares[at.world].push({
      half: marker.dungeon === undefined ? HALF_MARKER : HALF_DUNGEON,
      x: at.x,
      y: at.y,
    });
  }
  const made = [...byPlace.values()].map((place): BonkPlace => {
    const spot = clearSpot(place.home, squares[place.world]);
    squares[place.world].push({ half: HALF_MARKER, x: spot.x, y: spot.y });
    return {
      id: place.id,
      locations: place.locations,
      moved: spot.moved,
      world: place.world,
      x: spot.x,
      y: spot.y,
    };
  });
  byMarkers.set(markers, made);
  return made;
};

/** Which state a place with several drops left shows: the best of them. */
const ORDER: readonly MarkerState[] = [
  "available",
  "possible",
  "margin",
  "trick",
  "seen",
  "unavailable",
];

/** What a bonk place shows: done once every drop is checked, else its best. */
export const bonkPlaceStateOf = (
  place: BonkPlace,
  state: MarkerInputs,
): MarkerState => {
  const left = place.locations.filter(
    (location) => !state.checked[location.id],
  );
  if (left.length === 0) return "opened";
  const states = new Set(left.map((location) => doorStateOf(location, state)));
  return ORDER.find((s) => states.has(s)) ?? "possible";
};

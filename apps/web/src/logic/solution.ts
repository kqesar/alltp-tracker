// The run, solved by the alltpr pack: what each location of the world shows
// for what the player recorded, and the hooks the map reads it through.
//
// There is no second store. The solution is derived from the game store by
// a selector memoized on the four slices it reads (items, medallions, small
// keys, settings), so it is computed once per change of the run, by the
// first component to ask, and is never out of step with the store: a click
// on a map marker, which only checks locations, solves nothing. Each hook
// returns a string, which Zustand compares by value, so a change re-renders
// only the markers whose status it changed.
import type { Tri } from "@alltp/engine";
import {
  type AlttprSettings,
  compile,
  type DungeonId,
  dungeon,
  dungeonItemCount,
  dungeonLocations,
  dungeonRegions,
  dungeonStatus,
  type Filler,
  filler,
  fromLegacy,
  LEGACY_DUNGEONS,
  MARKERS,
  type MapMarker,
  type MarkerStatus,
  markerStatus,
  OPEN,
  regionModules,
  STANDARD,
  solveWithKeys,
  type TrackerInput,
  toState,
} from "@alltp/pack-alttpr";
import { BOSS_STATES } from "@/constants";
import { packSettings } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";
import type { Progress } from "@/stores/persistence";

/** What a marker shows: what is left in logic, or done. */
export type MarkerState = MarkerStatus | "opened";

/** The words a screen reader hears for each state; the glyph says it on screen. */
export const STATE_LABELS: Record<MarkerState, string> = {
  available: "available",
  opened: "done",
  possible: "maybe available",
  unavailable: "out of logic",
};

/** The slices of the run the solution reads. */
export type Inputs = Pick<
  Progress,
  "items" | "medallions" | "settings" | "smallKeys"
>;

/** The slices a marker's status reads: the solution's, and what is checked. */
type MarkerInputs = Inputs & Pick<Progress, "checked">;

/** A dungeon counter's item id. */
const COUNTER = /^chest\d$/;

/**
 * What the player recorded, as the pack's TrackerInput. The items keep the
 * tracker's ids, so they go through the pack's legacy table: the bow and
 * its silver arrows, bosses beaten, prizes, the medallion pads, the small
 * keys. A dungeon counter is no item. Like a legacy run, a run counts
 * Hyrule Castle finished, Zelda rescued: the tracker does not record the
 * escape, which in Standard opens the Light World.
 */
export const trackerInput = ({
  items,
  medallions,
  smallKeys,
}: Inputs): TrackerInput => {
  const legacy: Record<string, number | boolean> = {};
  for (const [id, value] of Object.entries(items)) {
    if (!COUNTER.test(id) && id !== "agahnim2") legacy[id] = value;
  }
  const { input } = fromLegacy({
    chestsOpened: [],
    items: legacy,
    medallions,
    smallKeys,
  });
  return items.agahnim2 === 1
    ? { ...input, beaten: { ...input.beaten, "ganons-tower": true } }
    : input;
};

const fillers = new WeakMap<AlttprSettings, Filler>();

/** The run's world, compiled once per settings, with its key model. */
const fillerOf = (settings: AlttprSettings): Filler => {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compile(settings), settings);
    fillers.set(settings, found);
  }
  return found;
};

/** A run, solved. */
export interface Solution {
  /** The pack's settings it was solved under. */
  readonly settings: AlttprSettings;
  /** Every location of the run's world, as the tracker shows it. */
  readonly tris: Readonly<Record<string, Tri>>;
}

let last: { inputs: Inputs; solution: Solution } | undefined;

/**
 * The run solved: the pack's key model over the state of what the player
 * recorded. Memoized on the slices it reads, so every component asking
 * after one change gets the one solution computed for it, and a change to
 * anything else (a checked location, a preference) computes nothing.
 * @param state - The game store's state, or any object with those slices
 */
export const solutionOf = (state: Inputs): Solution => {
  if (
    last !== undefined &&
    last.inputs.items === state.items &&
    last.inputs.medallions === state.medallions &&
    last.inputs.settings === state.settings &&
    last.inputs.smallKeys === state.smallKeys
  ) {
    return last.solution;
  }
  const settings = packSettings(state.settings);
  const keyed = solveWithKeys(
    fillerOf(settings),
    toState(trackerInput(state), settings),
  );
  const solution = { settings, tris: keyed.locations() };
  last = {
    inputs: {
      items: state.items,
      medallions: state.medallions,
      settings: state.settings,
      smallKeys: state.smallKeys,
    },
    solution,
  };
  return solution;
};

const MARKER_BY_ID: ReadonlyMap<string, MapMarker> = new Map(
  MARKERS.map((marker) => [marker.id, marker]),
);

/** A marker by id; throws a RangeError for an id the map does not have. */
export const markerById = (id: string): MapMarker => {
  const marker = MARKER_BY_ID.get(id);
  if (marker === undefined) throw new RangeError(`No map marker "${id}"`);
  return marker;
};

const tri = (solution: Solution, id: string): Tri => solution.tris[id] ?? "no";

/**
 * What a location marker shows: done once every location it stands for is
 * checked, else markerStatus of those left.
 */
export const markerStateOf = (
  marker: MapMarker,
  state: MarkerInputs,
): MarkerState => {
  const left = marker.locations.filter((id) => !state.checked[id]);
  if (left.length === 0) return "opened";
  const solution = solutionOf(state);
  return markerStatus(left.map((id) => tri(solution, id)));
};

const itemLocations = new Map<string, readonly string[]>();

/** A dungeon's item locations in the run's world. */
const itemLocationsOf = (
  id: DungeonId,
  settings: AlttprSettings,
): readonly string[] => {
  const key = `${settings.standardMode}/${id}`;
  let found = itemLocations.get(key);
  if (found === undefined) {
    found = dungeonLocations(dungeon(id), settings);
    itemLocations.set(key, found);
  }
  return found;
};

/** A dungeon's index in the grid (0-9), or -1 for one it lacks. */
const gridIndex = (id: DungeonId): number =>
  (LEGACY_DUNGEONS as readonly string[]).indexOf(id);

/**
 * The items a dungeon's counter has left: the grid's ten dungeons have one;
 * Castle Tower and Ganon's Tower do not (undefined).
 */
export const dungeonCount = (
  id: DungeonId,
  state: Pick<Progress, "items">,
): number | undefined => {
  const index = gridIndex(id);
  return index >= 0 ? Number(state.items[`chest${index}`]) : undefined;
};

/**
 * What a dungeon's square shows. With a counter (the ten dungeons of the
 * grid), done at 0, else dungeonStatus: the pigeonhole rule over its item
 * locations, from the items left. Castle Tower and Ganon's Tower have no
 * counter, so what is left is unknown: they show markerStatus of all their
 * item locations, and Castle Tower is done when it holds nothing for the
 * player (its two chests keep their keys outside keysanity).
 */
export const dungeonStateOf = (id: DungeonId, state: Inputs): MarkerState => {
  const solution = solutionOf(state);
  const tris = itemLocationsOf(id, solution.settings).map((location) =>
    tri(solution, location),
  );
  const left = dungeonCount(id, state);
  if (left !== undefined) {
    return left > 0 ? dungeonStatus(left, tris) : "opened";
  }
  return dungeonItemCount(dungeon(id), solution.settings) > 0
    ? markerStatus(tris)
    : "opened";
};

/**
 * How many of a dungeon's items left are surely in logic: those the
 * locations out of logic cannot all hold (pigeonholes). 0 without a counter.
 */
export const itemsSurelyInLogic = (id: DungeonId, state: Inputs): number => {
  const left = dungeonCount(id, state);
  if (left === undefined) return 0;
  const solution = solutionOf(state);
  const notYes = itemLocationsOf(id, solution.settings).filter(
    (location) => tri(solution, location) !== "yes",
  ).length;
  return Math.max(0, left - notYes);
};

/** Whether the player marked a dungeon's boss beaten. */
export const isBeaten = (id: DungeonId, items: Progress["items"]): boolean => {
  const index = gridIndex(id);
  if (index >= 0) return items[`boss${index}`] === BOSS_STATES.BEATEN;
  if (id === "castle-tower") return items.agahnim === 1;
  return id === "ganons-tower" && items.agahnim2 === 1;
};

/** The location of a dungeon's prize, whose rule is its boss's. */
const prizeOf = (id: DungeonId, settings: AlttprSettings): string => {
  const prize = dungeonRegions(dungeon(id), settings).find(
    (region) => region.prize !== undefined,
  )?.prize;
  if (prize === undefined) throw new RangeError(`No prize for ${id}`);
  return prize;
};

/**
 * What a dungeon's boss shows: done once beaten, else the status of its
 * prize, which upstream gives the boss's own rule (Agahnim's for Castle
 * Tower, Agahnim 2's for Ganon's Tower).
 */
export const bossStateOf = (id: DungeonId, state: Inputs): MarkerState => {
  if (isBeaten(id, state.items)) return "opened";
  const solution = solutionOf(state);
  return markerStatus([tri(solution, prizeOf(id, solution.settings))]);
};

/** Every location's official name, Open's and Standard's worlds together. */
const NAMES: ReadonlyMap<string, string> = new Map(
  [OPEN, STANDARD].flatMap((settings) =>
    regionModules(settings).flatMap((module) =>
      module.regions.flatMap((region) =>
        region.locations.map((location) => [location.id, location.name]),
      ),
    ),
  ),
);

/**
 * A location's name under its marker: its official name, without the
 * marker's own name when it starts with it ("Kakariko Well - Top" is "Top"
 * under Kakariko Well).
 */
export const locationLabel = (marker: MapMarker, id: string): string => {
  const name = NAMES.get(id) ?? id;
  if (!name.startsWith(marker.name) || name === marker.name) return name;
  return name.slice(marker.name.length).replace(/^\s*-?\s*/, "") || name;
};

/**
 * What each location of a marker shows, in the marker's order: done once
 * checked, else its own status. A dungeon's locations are counted, never
 * checked, so they show their status.
 */
export const markerDetail = (
  marker: MapMarker,
  state: MarkerInputs,
): MarkerState[] => {
  const solution = solutionOf(state);
  return marker.locations.map((id) =>
    state.checked[id] ? "opened" : markerStatus([tri(solution, id)]),
  );
};

/** A location's tri as the tracker shows it, stable between changes. */
export const useLocationStatus = (id: string): Tri =>
  useGameStore((state) => tri(solutionOf(state), id));

/**
 * What a map marker shows: a location marker's status, or a dungeon
 * marker's square (its counter).
 */
export const useMarkerStatus = (markerId: string): MarkerState => {
  const marker = markerById(markerId);
  return useGameStore((state) =>
    marker.dungeon === undefined
      ? markerStateOf(marker, state)
      : dungeonStateOf(marker.dungeon, state),
  );
};

/** What a dungeon's counter shows, by the pigeonhole rule. */
export const useDungeonStatus = (id: DungeonId): MarkerState =>
  useGameStore((state) => dungeonStateOf(id, state));

/** What a dungeon's boss shows. */
export const useBossStatus = (id: DungeonId): MarkerState =>
  useGameStore((state) => bossStateOf(id, state));

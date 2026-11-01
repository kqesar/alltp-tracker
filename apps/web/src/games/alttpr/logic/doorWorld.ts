// The logic of a Door Randomizer run (doorLogic), on its entrances and
// doors as noted where DR shuffled them: the pack's port of DR's own world (packs/alttpr/src/
// door-world/), its rules, crystal switches and key analysis, built for the
// run's settings. Loaded on demand for such a run (hooks/useDoorLogic.ts),
// with DR's rules and region graph: no other run downloads them, so
// whatever reads that world goes through this module. An Overworld
// Randomizer run is solved in the same world built on the fork's own data
// (logic/owrWorld.ts, `doorSolverOf`). Neither release's data is imported
// here: each solver's module brings its own (logic/drSolver.ts,
// logic/owrWorld.ts), so an OWR run never downloads DR's world.

import type { Settings, State, Tri } from "@alltp/engine";
import {
  type DrData,
  type DrNotedDoors,
  type DrNotedEntrances,
  type DrWorld,
  drRegionId,
  drWorld,
  KEY_ITEMS,
  type OwrNotes,
} from "@alltp/pack-alttpr/door-world";
import {
  type OwnWorldRun,
  type OwnWorldSolver,
  ownWorldSolver,
  solveIn,
} from "@/games/alttpr/logic/ownWorld";

/** A Door Randomizer run, solved. */
export type DoorRun = OwnWorldRun<DrWorld>;

/**
 * Hyrule Castle's big key, which DR's key drops may shuffle and the board
 * has no cell for: it reads maybe until then (the pack's `unrecorded`).
 */
const UNRECORDED = ["bigKeyH2"];

/** A run's pots and enemy drops, each in its DR region. */
type Added = readonly { readonly name: string; readonly region: string }[];

type Built = WeakMap<
  Settings,
  {
    added: Added;
    doors?: DrNotedDoors;
    entrances?: DrNotedEntrances;
    overworld?: OwrNotes;
    world: DrWorld;
  }
>;

/** Whether two runs' noted doors are the same notes of the same shuffle. */
const sameDoors = (a?: DrNotedDoors, b?: DrNotedDoors) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.notes === b.notes &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings));

/** Whether two runs' noted entrances are the same notes of the same pool. */
const sameEntrances = (a?: DrNotedEntrances, b?: DrNotedEntrances) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.noted === b.noted &&
    a.shuffle === b.shuffle &&
    JSON.stringify(a.pool) === JSON.stringify(b.pool));

/**
 * The world of a run's settings (drSettingsOf, the same object for the
 * same run), its pots and drops (doorLocationsOf's, memoized per modes) and
 * its entrances as noted, where DR shuffled them (the store's notes, the
 * same object until one changes), built again only when they change: tens
 * of milliseconds, DR's key analysis included. Kept per settings, so the
 * board's run and a review's sweep (its keys tracked) never rebuild each
 * other's.
 */
const worldOf = (
  data: DrData,
  built: Built,
  settings: Settings,
  added: Added,
  entrances?: DrNotedEntrances,
  doors?: DrNotedDoors,
  overworld?: OwrNotes,
): DrWorld => {
  const found = built.get(settings);
  if (
    found?.added === added &&
    sameEntrances(found.entrances, entrances) &&
    sameDoors(found.doors, doors) &&
    found.overworld === overworld
  )
    return found.world;
  const world = drWorld(settings, {
    data,
    dropsAndPots: added,
    ...(entrances === undefined ? {} : { entrances }),
    ...(doors === undefined ? {} : { doors }),
    ...(overworld === undefined ? {} : { overworld }),
    unrecorded: UNRECORDED,
  });
  built.set(settings, {
    added,
    ...(doors === undefined ? {} : { doors }),
    ...(entrances === undefined ? {} : { entrances }),
    ...(overworld === undefined ? {} : { overworld }),
    world,
  });
  return world;
};

/** What the tracker asks of a Door Randomizer run. */
export interface DoorSolver extends OwnWorldSolver {
  /**
   * The run solved: every location of DR's world, its pots and drops
   * (`added`) among them, on its entrances as noted where DR shuffled them.
   */
  solve(
    settings: Settings,
    added: Added,
    state: State,
    entrances?: DrNotedEntrances,
    doors?: DrNotedDoors,
    /** An OWR run's whirlpools and flute spots as noted (`owrNotesOf`). */
    overworld?: OwrNotes,
  ): DoorRun;
  /**
   * Where a region of DR's stands (a DR location's, by DR's name): maybe
   * for one the world does not hold (a take-any cave).
   */
  region(run: DoorRun, name: string): Tri;
}

/**
 * The solver of runs in DR's world built on `data`: DR's own, or the
 * Overworld Randomizer's (logic/owrWorld.ts), each world kept per settings.
 */
export const doorSolverOf = (data: DrData): DoorSolver => {
  const built: Built = new WeakMap();
  return {
    // Every key held beside vt's pool: DR's dungeons hold more (their drops)
    ...ownWorldSolver(() =>
      Object.fromEntries(
        KEY_ITEMS.map((item) => [item, item.startsWith("big") ? 1 : 99]),
      ),
    ),
    region: ({ solution }, name) => {
      const id = drRegionId(name, data);
      return id === undefined ? "maybe" : solution.region(id);
    },
    solve: (settings, added, state, entrances, doors, overworld) =>
      solveIn(
        worldOf(data, built, settings, added, entrances, doors, overworld),
        state,
      ),
  };
};

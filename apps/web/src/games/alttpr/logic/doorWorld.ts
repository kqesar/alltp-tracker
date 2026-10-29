// The logic of a Door Randomizer run whose doors and entrances are vanilla
// (doorLogic): the pack's port of DR's own world (packs/alttpr/src/
// door-world/), its rules, crystal switches and key analysis, built for the
// run's settings. Loaded on demand for such a run (hooks/useDoorLogic.ts),
// with DR's rules and region graph: no other run downloads them, so
// whatever reads that world goes through this module.

import type { Settings, State, Tri } from "@alltp/engine";
import {
  type DrWorld,
  drRegionId,
  drWorld,
  KEY_ITEMS,
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

let built: { settings: Settings; world: DrWorld } | undefined;

/**
 * The world of a run's settings (drSettingsOf, the same object for the
 * same run), built again only when they change: tens of milliseconds, DR's
 * key analysis included, once per settings.
 */
const worldOf = (settings: Settings): DrWorld => {
  if (built?.settings === settings) return built.world;
  const world = drWorld(settings, { unrecorded: UNRECORDED });
  built = { settings, world };
  return world;
};

/** What the tracker asks of a Door Randomizer run. */
export interface DoorSolver extends OwnWorldSolver {
  /** The run solved: every location of DR's world. */
  solve(settings: Settings, state: State): DoorRun;
  /** Where a region of DR's stands (a DR location's, by DR's name). */
  region(run: DoorRun, name: string): Tri;
}

export const solver: DoorSolver = {
  // Every key held beside vt's pool: DR's dungeons hold more (their drops)
  ...ownWorldSolver(() =>
    Object.fromEntries(
      KEY_ITEMS.map((item) => [item, item.startsWith("big") ? 1 : 99]),
    ),
  ),
  region: ({ solution }, name) => solution.region(drRegionId(name)),
  solve: (settings, state) => solveIn(worldOf(settings), state),
};

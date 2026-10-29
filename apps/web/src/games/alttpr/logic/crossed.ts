// The logic of a run with shuffled entrances: the pack's port of the
// entrance randomizer's world (packs/alttpr/src/er-world.ts), built for the
// entrances the player noted. A door not noted leads nowhere, so a check is
// in logic only through doors the player knows. Loaded on demand for such a
// run (hooks/useCrossedLogic.ts), with the randomizer's rules: no other run
// downloads them, so whatever reads that world goes through this module.

import type { State } from "@alltp/engine";
import {
  type AlttprSettings,
  crossedConnections,
  type ErWorld,
  erWorld,
} from "@alltp/pack-alttpr";
import {
  type OwnWorldRun,
  type OwnWorldSolver,
  ownWorldSolver,
  solveIn,
} from "@/games/alttpr/logic/ownWorld";

/** The entrances noted: an entrance id to its target's (the store's). */
type Noted = Readonly<Record<string, string>>;

/** A run with shuffled entrances, solved. */
export type CrossedRun = OwnWorldRun<ErWorld>;

let built:
  | { entrances: Noted; settings: AlttprSettings; world: ErWorld }
  | undefined;

/**
 * The world of a run's settings and noted entrances, built again only when
 * either changes: a few milliseconds, once per entrance noted.
 */
const worldOf = (settings: AlttprSettings, entrances: Noted): ErWorld => {
  if (built?.settings === settings && built.entrances === entrances)
    return built.world;
  const mode = settings.standardMode ? "standard" : "open";
  const world = erWorld(settings, crossedConnections(mode, entrances));
  built = { entrances, settings, world };
  return world;
};

/** What the tracker asks of a run with shuffled entrances. */
export interface CrossedSolver extends OwnWorldSolver {
  /** The run solved: every location of its world. */
  solve(settings: AlttprSettings, entrances: Noted, state: State): CrossedRun;
}

export const solver: CrossedSolver = {
  ...ownWorldSolver(),
  solve: (settings, entrances, state) =>
    solveIn(worldOf(settings, entrances), state),
};

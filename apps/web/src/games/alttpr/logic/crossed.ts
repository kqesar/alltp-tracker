// The logic of a run with shuffled entrances: the pack's port of the
// entrance randomizer's world (packs/alttpr/src/er-world.ts), built for the
// entrances the player noted. A door not noted leads nowhere, so a check is
// in logic only through doors the player knows. The keys the randomizer kept
// in their dungeons (any dungeon items but `full`) are read by that world's
// own key model (packs/alttpr/src/er-keys.ts). Loaded on demand for such a
// run (hooks/useCrossedLogic.ts), with the randomizer's rules: no other run
// downloads them, so whatever reads that world goes through this module.

import type { State } from "@alltp/engine";
import {
  type AlttprSettings,
  type ErShuffle,
  type ErWorld,
  erConnections,
  erUntracked,
  erWorld,
  type GoMode,
  type GoModeStatus,
  goModeStatusBy,
  type KeyedSolution,
  solveErWithKeys,
  solveFactsState,
  type UntrackedItem,
  withErUntracked,
} from "@alltp/pack-alttpr";
import {
  type OwnWorldRun,
  type OwnWorldSolver,
  ownWorldSolver,
} from "@/games/alttpr/logic/ownWorld";

/** The entrances noted: an entrance id to its target's (the store's). */
type Noted = Readonly<Record<string, string>>;

/**
 * A run with shuffled entrances, solved: its `state` the player's with the
 * keys surely in hand and the facts gained, its `solution` that state's
 * (its regions, what can be seen).
 */
export interface CrossedRun extends OwnWorldRun<ErWorld> {
  /** Every location as the tracker shows it: the key model's. */
  readonly keyed: KeyedSolution;
}

let built:
  | {
      entrances: Noted;
      settings: AlttprSettings;
      shuffle: ErShuffle;
      world: ErWorld;
    }
  | undefined;

/**
 * The world of a run's settings, shuffle and noted entrances, built again
 * only when one changes: a few milliseconds, once per entrance noted.
 */
const worldOf = (
  settings: AlttprSettings,
  shuffle: ErShuffle,
  entrances: Noted,
): ErWorld => {
  if (
    built?.settings === settings &&
    built.shuffle === shuffle &&
    built.entrances === entrances
  )
    return built.world;
  const mode = settings.standardMode ? "standard" : "open";
  const world = erWorld(settings, erConnections(shuffle, mode, entrances));
  built = { entrances, settings, shuffle, world };
  return world;
};

/**
 * What the tracker asks of a run with shuffled entrances: what any world of
 * its own answers (`OwnWorldSolver`), its go mode stepped through its key
 * model, and its untracked keys.
 */
export interface CrossedSolver extends OwnWorldSolver {
  /** The run solved: every location of its world, its keys read. */
  solve(
    settings: AlttprSettings,
    shuffle: ErShuffle,
    entrances: Noted,
    state: State,
  ): CrossedRun;
  /** Where the run stands against its go mode, step by step, keys read. */
  goMode(run: CrossedRun, mode: GoMode): GoModeStatus;
  /**
   * The items the player does not track in the run's world, with where
   * each may sit: none in keysanity.
   */
  untracked(run: CrossedRun): readonly UntrackedItem[];
  /**
   * `state` with every untracked item at its full count, and the facts
   * that gains: a key is never something to find, so the analysis asks
   * with them all.
   */
  withUntracked(run: CrossedRun, state: State): State;
}

export const solver: CrossedSolver = {
  ...ownWorldSolver(),
  goMode: ({ keyed, state, world }, mode) =>
    goModeStatusBy((s) => solveErWithKeys(world, s), state, mode, keyed),
  solve: (settings, shuffle, entrances, state) => {
    const world = worldOf(settings, shuffle, entrances);
    const keyed = solveErWithKeys(world, state);
    return { keyed, solution: keyed.solution, state: keyed.state, world };
  },
  untracked: ({ world }) => erUntracked(world),
  withUntracked: ({ world }, state) =>
    solveFactsState(world, withErUntracked(world, state)).state,
};

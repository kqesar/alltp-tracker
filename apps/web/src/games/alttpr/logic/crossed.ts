// The logic of a run with shuffled entrances: the pack's port of the
// entrance randomizer's world (packs/alttpr/src/er-world.ts), built for the
// entrances the player noted. A door not noted leads nowhere, so a check is
// in logic only through doors the player knows. The keys the randomizer kept
// in their dungeons (any dungeon items but `full`) are read by that world's
// own key model (packs/alttpr/src/er-keys.ts). Loaded on demand for such a
// run (hooks/useCrossedLogic.ts), with the randomizer's rules: no other run
// downloads them, so whatever reads that world goes through this module.

import type {
  Analysis,
  AnalyzeOptions,
  Solution as EngineSolution,
  State,
} from "@alltp/engine";
import {
  type AlttprSettings,
  analyzeFacts,
  crossedConnections,
  type ErWorld,
  erUntracked,
  erWorld,
  everything,
  type GoMode,
  type GoModeStatus,
  goModeStatusBy,
  type KeyedSolution,
  solveErWithKeys,
  solveFacts,
  solveFactsState,
  type UntrackedItem,
  withErUntracked,
} from "@alltp/pack-alttpr";

/** The entrances noted: an entrance id to its target's (the store's). */
type Noted = Readonly<Record<string, string>>;

/** A run with shuffled entrances, solved. */
export interface CrossedRun {
  /** Its world, for the settings and the entrances noted. */
  readonly world: ErWorld;
  /**
   * The state solved: the player's, with the keys surely in hand and the
   * facts gained.
   */
  readonly state: State;
  /** Every location as the tracker shows it: the key model's. */
  readonly keyed: KeyedSolution;
  /** That state's solution: its regions, what can be seen. */
  readonly solution: EngineSolution;
}

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
export interface CrossedSolver {
  /** The run solved: every location of its world, its keys read. */
  solve(settings: AlttprSettings, entrances: Noted, state: State): CrossedRun;
  /** Where the run stands against its go mode, step by step. */
  goMode(run: CrossedRun, mode: GoMode): GoModeStatus;
  /**
   * The engine's analysis of a state of the run's world, its facts read
   * through (`analyzeFacts`): what brings each location, in items.
   */
  analyze(run: CrossedRun, state: State, options: AnalyzeOptions): Analysis;
  /**
   * The run's world solved with everything held: what is not reached then
   * waits on a door not noted, whatever the player finds.
   */
  everything(run: CrossedRun, settings: AlttprSettings): EngineSolution;
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

const solvedWithAll = new WeakMap<ErWorld, EngineSolution>();

export const solver: CrossedSolver = {
  analyze: ({ world }, state, options) =>
    analyzeFacts(world, solveFactsState(world, state).state, options),
  everything: ({ world }, settings) => {
    let found = solvedWithAll.get(world);
    if (found === undefined) {
      found = solveFacts(world, everything(settings));
      solvedWithAll.set(world, found);
    }
    return found;
  },
  goMode: ({ keyed, state, world }, mode) =>
    goModeStatusBy((s) => solveErWithKeys(world, s), state, mode, keyed),
  solve: (settings, entrances, state) => {
    const world = worldOf(settings, entrances);
    const keyed = solveErWithKeys(world, state);
    return { keyed, solution: keyed.solution, state: keyed.state, world };
  },
  untracked: ({ world }) => erUntracked(world),
  withUntracked: ({ world }, state) =>
    solveFactsState(world, withErUntracked(world, state)).state,
};

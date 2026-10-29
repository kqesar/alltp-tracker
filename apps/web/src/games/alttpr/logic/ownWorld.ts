// What the tracker asks of a run solved in a world of the pack's other than
// vt's: the entrance randomizer's (logic/crossed.ts) or the Door
// Randomizer's (logic/doorWorld.ts). Both are fact worlds (the pack's
// src/facts.ts: events and regions reached as facts), solved, analyzed and
// stepped through to the go mode the same way; only how each world is built
// differs. Imported by those two modules alone, each a chunk loaded on
// demand, so no other run downloads it.

import type {
  Analysis,
  AnalyzeOptions,
  Solution as EngineSolution,
  State,
} from "@alltp/engine";
import {
  type AlttprSettings,
  analyzeFacts,
  everything,
  type FactWorld,
  type GoMode,
  type GoModeStatus,
  goModeStatusBy,
  solveFacts,
  solveFactsState,
} from "@alltp/pack-alttpr";

/** A run solved in a world of its own. */
export interface OwnWorldRun<W extends FactWorld = FactWorld> {
  /** Its world, for the run's settings (and the entrances noted). */
  readonly world: W;
  /** The state solved: the player's, with the facts gained. */
  readonly state: State;
  readonly solution: EngineSolution;
}

/** What the tracker asks of a run solved in a world of its own. */
export interface OwnWorldSolver {
  /** Where the run stands against its go mode, step by step. */
  goMode(run: OwnWorldRun, mode: GoMode): GoModeStatus;
  /**
   * The engine's analysis of a state of the run's world, its facts read
   * through (`analyzeFacts`): what brings each location, in items.
   */
  analyze(run: OwnWorldRun, state: State, options: AnalyzeOptions): Analysis;
  /**
   * The run's world solved with everything held: what is not reached then
   * waits on something no item brings (a door not noted).
   */
  everything(run: OwnWorldRun, settings: AlttprSettings): EngineSolution;
}

/** A world solved, its facts gained. */
export const solveIn = <W extends FactWorld>(
  world: W,
  state: State,
): OwnWorldRun<W> => ({ ...solveFactsState(world, state), world });

/**
 * The solver's shared part.
 * @param more - What a world holds beside `everything` once all is found
 *   (the Door Randomizer's keys, which vt's pool does not count)
 */
export const ownWorldSolver = (
  more: (settings: AlttprSettings) => State = () => ({}),
): OwnWorldSolver => {
  const solvedWithAll = new WeakMap<FactWorld, EngineSolution>();
  return {
    analyze: ({ world }, state, options) =>
      analyzeFacts(world, solveFactsState(world, state).state, options),
    everything: ({ world }, settings) => {
      let found = solvedWithAll.get(world);
      if (found === undefined) {
        found = solveFacts(world, {
          ...everything(settings),
          ...more(settings),
        });
        solvedWithAll.set(world, found);
      }
      return found;
    },
    goMode: ({ solution, state, world }, mode) =>
      goModeStatusBy((s) => solveFacts(world, s), state, mode, solution),
  };
};

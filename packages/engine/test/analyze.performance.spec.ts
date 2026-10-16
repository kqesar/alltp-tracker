import { isMainThread } from "node:worker_threads";
import { describe, expect, inject, it } from "vitest";
import { analyze } from "../src/analyze";
import type { State } from "../src/evaluate";
import { compileWorld } from "../src/world";
import { syntheticGame } from "./synthetic";

declare module "vitest" {
  export interface ProvidedContext {
    /** Set by vitest.config.ts when the run instruments code for coverage. */
    coverage: boolean;
  }
}

// Blockers are asked for on demand (a hover, a "what next?" panel), but a
// panel may want every location at once. The budget is 10 ms for all 1000
// locations of the synthetic world, both targets, on average over a game;
// the analysis needs 2 to 3 ms.
//
// A few ms is easy to lose to a busy machine (parallel test files, other
// processes), so the test times CPU rather than the wall clock: Vitest runs
// each test file in a process of its own, whose CPU time does not count the
// time spent waiting for a core. Each stage is timed several times and its
// fastest run counts.
//
// Coverage instrumentation (`pnpm test:coverage`, what CI runs) makes this
// code several times slower, so it measures the instrumentation more than
// the engine. Under coverage the test allows 8x the budget: it still catches
// a blow-up, and a plain `pnpm test` holds the real budget.
const BUDGET_MS = 10;
const COVERAGE_FACTOR = 8;
const RUNS = 7;
// Wall time, for Vitest's timeout only: 160 passes take well under a second
// on a quiet machine, but much longer under coverage on a loaded one.
const TIMEOUT_MS = 60_000;

/**
 * Milliseconds of this process's CPU time. In a worker thread (another
 * Vitest pool), the process also runs other test files: fall back to the
 * wall clock there.
 */
const clock = (): number => {
  if (!isMainThread) return performance.now();
  const { system, user } = process.cpuUsage();
  return (system + user) / 1000;
};

describe("analyze performance", () => {
  const game = syntheticGame();
  const world = compileWorld(game.world, game.rules, { items: game.items });
  const states = Array.from({ length: 20 }, (_, i) =>
    game.randomState(0.1 + (0.8 * i) / 19),
  );
  const everything = (state: State) => {
    const analysis = analyze(world, state);
    return world.locationIds.flatMap((id) => [
      analysis.blockers(id, "yes"),
      analysis.blockers(id, "maybe"),
    ]);
  };

  it("analyzes a world of the intended size, with work to do", () => {
    expect(world.regionIds).toHaveLength(300);
    expect(world.locationIds).toHaveLength(1000);
    // Early in the game, many locations must be a few atoms away, or the
    // timing below would measure a trivial pass.
    const tally = { done: 0, nothing: 0, sets: 0 };
    for (const { sets } of everything(states[2] ?? {})) {
      if (sets.length === 0) tally.nothing++;
      else if (sets[0]?.length === 0) tally.done++;
      else tally.sets++;
    }
    // Of the 2000 results (1488, 366 and 146 when this test was written):
    expect(tally.sets).toBeGreaterThan(1000);
    expect(tally.done).toBeGreaterThan(200);
    expect(tally.nothing).toBeGreaterThan(50);
  });

  const budget = inject("coverage") ? BUDGET_MS * COVERAGE_FACTOR : BUDGET_MS;

  it(
    `analyzes every location in under ${budget} ms on average`,
    () => {
      for (const state of states) everything(state); // warm up the JIT
      let total = 0;
      for (const state of states) {
        let fastest = Number.POSITIVE_INFINITY;
        for (let run = 0; run < RUNS; run++) {
          const start = clock();
          everything(state);
          fastest = Math.min(fastest, clock() - start);
        }
        total += fastest;
      }
      expect(total / states.length).toBeLessThan(budget);
    },
    TIMEOUT_MS,
  );
});

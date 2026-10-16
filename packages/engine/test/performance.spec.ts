import { describe, expect, it } from "vitest";
import { solve } from "../src/solve";
import type { Tri } from "../src/tri";
import { compileWorld } from "../src/world";
import { syntheticGame } from "./synthetic";
import { fastest, TIMING_TIMEOUT_MS } from "./timing";

// The tracker re-solves on every click, so a full solve must stay far under
// a frame. The budget is 5 ms; the solver is expected to need well under
// 1 ms, which leaves room for slow CI machines and for coverage
// instrumentation without relaxing it. The 2000 solves are timed as 20
// batches of 100 on CPU time (see timing.ts), and the fastest batch counts.
const BUDGET_MS = 5;
const BATCH = 100;
const BATCHES = 20;

describe("solver performance", () => {
  const game = syntheticGame();
  const world = compileWorld(game.world, game.rules, { items: game.items });
  const states = Array.from({ length: 50 }, (_, i) =>
    game.randomState(0.1 + (0.8 * i) / 49),
  );

  it("benchmarks a world of the intended size", () => {
    expect(world.regionIds).toHaveLength(300);
    expect(world.locationIds).toHaveLength(1000);
    // A mid-game state must exercise all three outcomes, or the timing
    // below would measure a trivial solve.
    const tally: Record<Tri, number> = { maybe: 0, no: 0, yes: 0 };
    for (const tri of Object.values(
      solve(world, states[25] ?? {}).locations(),
    )) {
      tally[tri]++;
    }
    expect(tally.yes).toBeGreaterThan(100);
    expect(tally.maybe).toBeGreaterThan(10);
    expect(tally.no).toBeGreaterThan(100);
  });

  it(
    `solves 300 regions / 1000 locations in under ${BUDGET_MS} ms`,
    () => {
      for (const state of states) solve(world, state); // warm up the JIT
      let next = 0;
      // Each batch cycles through all 50 states twice.
      const batch = fastest(() => {
        for (let i = 0; i < BATCH; i++) {
          solve(world, states[next++ % states.length] ?? {});
        }
      }, BATCHES);
      expect(batch / BATCH).toBeLessThan(BUDGET_MS);
    },
    TIMING_TIMEOUT_MS,
  );
});

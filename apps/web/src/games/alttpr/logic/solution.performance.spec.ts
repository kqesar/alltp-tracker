// The solve a click runs must leave a frame most of its 16.7 ms: React's
// render and the browser's paint come after it. This times solutionOf (the
// pack's key model over the run's state, every location of the world) along
// a whole game, by the CPU time of this test's own process, keeping the
// fastest of several runs of each stage, so a busy machine does not fail it.
import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  budgetOf,
  fastest,
  GRID_ITEMS,
  stage,
} from "@/games/alttpr/logic/performance.fixtures";
import { type Inputs, solutionOf } from "@/games/alttpr/logic/solution";

/** A solve's budget: a quarter of a frame, more when coverage slows it. */
const BUDGET_MS = 4;

describe("a click's solve", () => {
  it.each(["open", "standard", "keysanity"])(
    "stays a fraction of a frame along a whole %s game",
    (preset) => {
      const settings = getPreset(preset).settings;
      const stages = Array.from({ length: GRID_ITEMS.length + 1 }, (_, i) =>
        stage(i, settings),
      );
      // The first solve of a world compiles it and builds its key model
      const cold = fastest(() => solutionOf(stage(0, settings)), 1);

      // A new items object each time: the memo must not answer for it
      const times = stages.map((inputs) =>
        fastest(() => solutionOf({ ...inputs, items: { ...inputs.items } }), 5),
      );
      const mean = times.reduce((sum, ms) => sum + ms, 0) / times.length;
      const budget = budgetOf(BUDGET_MS);

      // Real work: the end of the game opens most of the world
      const end = solutionOf(stages.at(-1) as Inputs).tris;
      expect(
        Object.values(end).filter((tri) => tri === "yes").length,
      ).toBeGreaterThan(100);
      console.info(
        `${preset}: first solve ${cold.toFixed(1)} ms, then ${mean.toFixed(2)} ms on average, ${Math.max(...times).toFixed(2)} ms at most`,
      );
      expect(mean).toBeLessThan(budget);
    },
    120_000,
  );
});

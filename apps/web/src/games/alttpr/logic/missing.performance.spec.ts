// What every check is missing is worked out when the browser is idle, once
// per change of the run, and must not hold the page up when it runs: this
// times analyzeRun (the blockers of every location not in logic, both
// targets, and an explanation for each one only possible) along a whole
// game, by the CPU time of this test's own process, keeping the fastest of
// several runs of each stage, so a busy machine does not fail it.
import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import { DEFAULT_TRICKS } from "@/games/alttpr/data/tricks";
import { analyzeRun } from "@/games/alttpr/logic/missing";
import {
  budgetOf,
  fastest,
  GRID_ITEMS,
  stage,
} from "@/games/alttpr/logic/performance.fixtures";
import { solutionOf, trickSolutionOf } from "@/games/alttpr/logic/solution";

/**
 * An idle moment's worth: well under a frame, so even a browser without an
 * idle callback, which runs it right after the click's frame, drops none.
 */
const BUDGET_MS = 5;

describe("the run's analysis", () => {
  it.each(["open", "standard", "keysanity"])(
    "stays within an idle moment along a whole %s game",
    (preset) => {
      const settings = getPreset(preset).settings;
      const solutions = Array.from({ length: GRID_ITEMS.length + 1 }, (_, i) =>
        solutionOf(stage(i, settings)),
      );
      // The first analysis of a world places its untracked items once
      analyzeRun(solutions[0], settings);

      const times = solutions.map((solution) =>
        fastest(() => analyzeRun(solution, settings), 5),
      );
      const mean = times.reduce((sum, ms) => sum + ms, 0) / times.length;
      const budget = budgetOf(BUDGET_MS);

      // Real work: the start of a run has most of the world to explain
      const start = analyzeRun(solutions[0], settings);
      expect(start.missing.size).toBeGreaterThan(150);
      expect(
        [...start.missing.values()].filter((m) => m.inLogic.sets.length > 0)
          .length,
      ).toBeGreaterThan(50);
      console.info(
        `${preset}: ${mean.toFixed(2)} ms on average, ${Math.max(...times).toFixed(2)} ms at most`,
      );
      expect(mean).toBeLessThan(budget);
    },
    120_000,
  );
});

describe("the run's analysis with every trick known", () => {
  it.each(["open", "keysanity"])(
    "stays within an idle moment along a whole %s game",
    (preset) => {
      const settings = getPreset(preset).settings;
      const tricks = { ...DEFAULT_TRICKS, enabled: true };
      const runs = Array.from({ length: GRID_ITEMS.length + 1 }, (_, i) => {
        const inputs = { ...stage(i, settings), tricks };
        return { solution: solutionOf(inputs), trick: trickSolutionOf(inputs) };
      });
      // The first analysis of a world places its untracked items once
      analyzeRun(runs[0].solution, settings, runs[0].trick);

      const times = runs.map(({ solution, trick }) =>
        fastest(() => analyzeRun(solution, settings, trick), 5),
      );
      const mean = times.reduce((sum, ms) => sum + ms, 0) / times.length;

      // Real work: the start of a run has checks only a trick opens
      const start = analyzeRun(runs[0].solution, settings, runs[0].trick);
      expect(
        [...start.missing.values()].filter((m) => m.tricks !== undefined)
          .length,
      ).toBeGreaterThan(2);
      console.info(
        `${preset} with tricks: ${mean.toFixed(2)} ms on average, ${Math.max(...times).toFixed(2)} ms at most`,
      );
      expect(mean).toBeLessThan(budgetOf(BUDGET_MS));
    },
    120_000,
  );
});

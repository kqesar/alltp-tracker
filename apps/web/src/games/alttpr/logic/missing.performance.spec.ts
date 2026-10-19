// What every check is missing is worked out when the browser is idle, once
// per change of the run, and must not hold the page up when it runs: this
// times analyzeRun (the blockers of every location not in logic, both
// targets, and an explanation for each one only possible) along a whole
// game, by the CPU time of this test's own process, keeping the fastest of
// several runs of each stage, so a busy machine does not fail it.
import { describe, expect, inject, it } from "vitest";
import {
  defaultItemGrid,
  items as freshItems,
  itemsMax,
} from "@/games/alttpr/data/items";
import { getPreset } from "@/games/alttpr/data/presets";
import { analyzeRun } from "@/games/alttpr/logic/missing";
import { type Inputs, solutionOf } from "@/games/alttpr/logic/solution";

/** Node's process, reached through globalThis: the app's code has no Node types. */
const node = (
  globalThis as {
    process?: { cpuUsage: () => { system: number; user: number } };
  }
).process;

/** Milliseconds of this process's CPU time. */
const cpuNow = () => {
  if (node === undefined) return performance.now();
  const { system, user } = node.cpuUsage();
  return (system + user) / 1000;
};

/** The CPU time of the fastest of `times` runs of `run`, in ms. */
const fastest = (run: () => void, times: number) => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times; i++) {
    const start = cpuNow();
    run();
    best = Math.min(best, cpuNow() - start);
  }
  return best;
};

/**
 * An idle moment's worth: well under a frame, so even a browser without an
 * idle callback, which runs it right after the click's frame, drops none.
 * Coverage instrumentation slows the analysis several times over.
 */
const BUDGET_MS = 5;
const COVERAGE_FACTOR = 6;

/** The grid's items, in reading order: the order a run finds them in. */
const GRID_ITEMS = defaultItemGrid
  .flat()
  .filter((id) => id && id !== "blank" && !id.startsWith("bigkey"));

/** A run with the first `found` grid items at their highest. */
const stage = (found: number, settings: Inputs["settings"]): Inputs => ({
  items: {
    ...freshItems,
    ...Object.fromEntries(
      GRID_ITEMS.slice(0, found).map((id) => [
        id,
        typeof freshItems[id] === "boolean" ? true : itemsMax[id],
      ]),
    ),
  } as Inputs["items"],
  medallions: Array(10).fill(0),
  settings,
  smallKeys: Array(10).fill(0),
});

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
      const budget = BUDGET_MS * (inject("coverage") ? COVERAGE_FACTOR : 1);

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

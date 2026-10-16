// The solve a click runs must leave a frame most of its 16.7 ms: React's
// render and the browser's paint come after it. This times solutionOf (the
// pack's key model over the run's state, every location of the world) along
// a whole game, by the CPU time of this test's own process, keeping the
// fastest of several runs of each stage, so a busy machine does not fail it.
import { describe, expect, inject, it } from "vitest";
import { defaultItemGrid, items as freshItems, itemsMax } from "@/data/items";
import { getPreset } from "@/data/presets";
import { type Inputs, solutionOf } from "@/logic/solution";

declare module "vitest" {
  export interface ProvidedContext {
    /** Set by vitest.config.ts when the run instruments code for coverage. */
    coverage: boolean;
  }
}

/** Node's process, reached through globalThis: the app's code has no Node types. */
const node = (
  globalThis as {
    process?: { cpuUsage: () => { system: number; user: number } };
  }
).process;

/**
 * Milliseconds of this process's CPU time: Vitest runs each test file in a
 * process of its own (the forks pool), so that time is the solve's, whatever
 * else the machine runs.
 */
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

/** A solve's budget: a quarter of a frame, more when coverage slows it. */
const BUDGET_MS = 4;
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
      const budget = BUDGET_MS * (inject("coverage") ? COVERAGE_FACTOR : 1);

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

// What the timing specs (`*.performance.spec.ts`) share: the CPU clock, the
// best-of-N runner and the staged runs they time along a whole game.

import { inject } from "vitest";
import {
  defaultItemGrid,
  items as freshItems,
  itemsMax,
} from "@/games/alttpr/data/items";
import type { Inputs } from "@/games/alttpr/logic/solution";

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
 * process of its own (the forks pool), so that time is the code's, whatever
 * else the machine runs.
 */
const cpuNow = () => {
  if (node === undefined) return performance.now();
  const { system, user } = node.cpuUsage();
  return (system + user) / 1000;
};

/** The CPU time of the fastest of `times` runs of `run`, in ms. */
export const fastest = (run: () => void, times: number) => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times; i++) {
    const start = cpuNow();
    run();
    best = Math.min(best, cpuNow() - start);
  }
  return best;
};

/** A budget, more when coverage instrumentation slows the code several times over. */
export const budgetOf = (ms: number) => ms * (inject("coverage") ? 6 : 1);

/** The grid's items, in reading order: the order a run finds them in. */
export const GRID_ITEMS = defaultItemGrid
  .flat()
  .filter((id) => id && id !== "blank" && !id.startsWith("bigkey"));

/** A run with the first `found` grid items at their highest. */
export const stage = (found: number, settings: Inputs["settings"]): Inputs => ({
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

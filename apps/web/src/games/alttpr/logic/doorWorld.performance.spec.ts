// A Door Randomizer run's click solves the pack's port of DR's world, about
// four times the size of vt's (its overworld screens, 578 dungeon regions
// split by crystal state, the facts swept in passes): the design's budget
// is 5 ms a click, facts included (study step 4.17). Timed as the vt solve
// is (solution.performance.spec.ts), by the CPU time of this process,
// keeping the fastest of several runs of each stage.
import { beforeAll, describe, expect, it } from "vitest";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import {
  budgetOf,
  fastest,
  GRID_ITEMS,
  stage,
} from "@/games/alttpr/logic/performance.fixtures";
import {
  type Inputs,
  setDoorSolver,
  solutionOf,
} from "@/games/alttpr/logic/solution";

/** A click's budget in DR's world (dr-logic-design §2.8). */
const BUDGET_MS = 5;

/** A world compiled with its key analysis, once per settings. */
const COLD_BUDGET_MS = 400;

beforeAll(async () => {
  const { solver } = await import("@/games/alttpr/logic/doorWorld");
  setDoorSolver(solver);
});

describe("a Door Randomizer run's solve", () => {
  const DR = getPreset("door-randomizer").settings;
  it.each<[string, RunSettings]>([
    ["keys in their dungeons", DR],
    [
      "keysanity, key drops shuffled",
      { ...DR, dropShuffle: "keys", dungeonItems: "full", pottery: "keys" },
    ],
    // The heaviest world: every pot (lottery) and every enemy's drop
    // (underworld) joins it, about 1,500 locations more
    [
      "every pot and every enemy",
      { ...DR, dropShuffle: "underworld", pottery: "lottery" },
    ],
  ])(
    "stays within the budget along a whole game: %s",
    (_name, settings) => {
      const stages = Array.from({ length: GRID_ITEMS.length + 1 }, (_, i) =>
        stage(i, settings),
      );
      const cold = fastest(() => solutionOf(stage(0, settings)), 1);
      const times = stages.map((inputs) =>
        fastest(() => solutionOf({ ...inputs, items: { ...inputs.items } }), 3),
      );
      const mean = times.reduce((sum, ms) => sum + ms, 0) / times.length;
      // Real work, in DR's world: the end of the game opens most of it
      const end = solutionOf(stages.at(-1) as Inputs);
      expect(end.door).toBeDefined();
      expect(
        Object.values(end.tris).filter((tri) => tri === "yes").length,
      ).toBeGreaterThan(150);
      console.info(
        `DR ${_name}: first solve ${cold.toFixed(1)} ms, then ${mean.toFixed(2)} ms on average, ${Math.max(...times).toFixed(2)} ms at most`,
      );
      expect(cold).toBeLessThan(budgetOf(COLD_BUDGET_MS));
      expect(mean).toBeLessThan(budgetOf(BUDGET_MS));
    },
    120_000,
  );
});

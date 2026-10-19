import { describe, expect, it } from "vitest";
import { markerState, solutionOf } from "@/games/smz3/logic";
import { freshProgress } from "@/games/smz3/store";

describe("the run's logic", () => {
  it("solves once per change of items, pads or settings", () => {
    const run = freshProgress();
    expect(solutionOf(run)).toBe(solutionOf({ ...run }));
    expect(solutionOf(run)).not.toBe(
      solutionOf({ ...run, items: { ...run.items, sword: 1 } }),
    );
  });

  it("colours a marker by its open locations, and opens it once all are checked", () => {
    const run = freshProgress();
    expect(markerState(run, ["links-house"])).toBe("available");
    expect(markerState(run, ["eastern-palace/big-chest"])).toBe("unavailable");
    expect(markerState(run, ["links-house", "eastern-palace/big-chest"])).toBe(
      "possible",
    );
    expect(
      markerState({ ...run, checked: ["links-house"] }, ["links-house"]),
    ).toBe("opened");
  });

  it("reads Hard logic and the pads the player knows", () => {
    const items = { ...freshProgress().items, bombs: 1, morph: 1 };
    const gauntlet = ["energy-tank-gauntlet"];
    const normal = { ...freshProgress(), items };
    expect(markerState(normal, gauntlet)).toBe("unavailable");
    const hard = {
      ...normal,
      settings: { ...normal.settings, smLogic: "hard" as const },
    };
    expect(markerState(hard, gauntlet)).toBe("available");
  });
});

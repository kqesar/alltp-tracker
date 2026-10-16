// The branches of East Death Mountain that upstream's tests cannot reach:
// no test checks the Floating Island, and none says what the player sees.
// Mimic Cave reaches Turtle Rock, whose test file holds it. The contract
// covers the rest (test/contract.spec.ts).
import { explain, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../../pack";
import { OPEN } from "../../../../settings";

const ISLAND = "floating-island";
/** West Death Mountain, by the flute. */
const UP = { flute: 1, rescueZelda: 1 };

describe("East Death Mountain", () => {
  it("is entered from West Death Mountain by the hookshot, or from Tower of Hera by the hammer", () => {
    const world = compile(OPEN);
    const region = (state: Record<string, number>) =>
      solve(world, state).region("eastDeathMountain");
    expect(region(UP)).toBe("no");
    expect(region({ ...UP, hookshot: 1 })).toBe("yes");
    expect(region({ ...UP, magicMirror: 1 })).toBe("no");
    const why = explain(world, { ...UP, hammer: 1, magicMirror: 1 }, ISLAND);
    expect(why.path.map((step) => step.region)).toEqual([
      "start",
      "westDeathMountain",
      "towerOfHeraMain",
      "towerOfHera",
      "eastDeathMountain",
    ]);
  });

  it("shows the Floating Island from its own side of the mountain", () => {
    const seen = (state: Record<string, number>) =>
      solve(compile(OPEN), state).visible(ISLAND);
    expect(seen({ ...UP, hookshot: 1 })).toBe("yes");
    expect(seen(UP)).toBe("no");
  });
});

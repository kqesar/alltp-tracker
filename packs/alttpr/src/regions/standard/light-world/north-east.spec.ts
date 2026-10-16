// What upstream's tests cannot say of the North East Light World: what the
// player sees. The contract covers the rules (test/contract.spec.ts).
import { solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../../pack";
import { OPEN } from "../../../settings";

const LEDGE = "zoras-ledge";

describe("North East Light World", () => {
  it("shows Zora's Ledge from the waterfall, which a glove or the flippers lead to", () => {
    const world = compile(OPEN);
    const seen = (state: Record<string, number>) => {
      const solution = solve(world, state);
      return [solution.location(LEDGE), solution.visible(LEDGE)];
    };
    expect(seen({})).toEqual(["no", "no"]);
    expect(seen({ rescueZelda: 1 })).toEqual(["no", "no"]);
    expect(seen({ glove: 1, rescueZelda: 1 })).toEqual(["no", "yes"]);
    expect(seen({ flippers: 1, rescueZelda: 1 })).toEqual(["yes", "yes"]);
    // Seen exactly where King Zora is met
    for (const state of [
      {},
      { rescueZelda: 1 },
      { glove: 1, rescueZelda: 1 },
    ]) {
      expect(solve(world, state).visible(LEDGE)).toBe(
        solve(world, state).location("king-zora"),
      );
    }
  });
});

// The medallion pads have no rule upstream: they are open from the start,
// in either world, before Zelda is rescued. No upstream test checks them.
import { solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import { OPEN, STANDARD } from "../../settings";

describe("Medallions", () => {
  it("holds both pads open with nothing", () => {
    for (const settings of [OPEN, STANDARD]) {
      const solution = solve(compile(settings), {});
      expect(solution.location("misery-mire-medallion")).toBe("yes");
      expect(solution.location("turtle-rock-medallion")).toBe("yes");
    }
  });
});

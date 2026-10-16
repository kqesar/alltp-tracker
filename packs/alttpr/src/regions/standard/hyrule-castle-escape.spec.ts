// What upstream's tests of the Standard escape leave out: they check its
// locations, not its prize, Zelda. The contract covers the rest
// (test/contract.spec.ts).
import { explain, type State, solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../../pack";
import { STANDARD, UPSTREAM_TEST } from "../../settings";

describe("Hyrule Castle Escape (Standard)", () => {
  it("is entered from the start with nothing, as the run begins there", () => {
    const why = explain(compile(UPSTREAM_TEST), {}, "links-uncle");
    expect(why.path).toEqual([
      { region: "start" },
      {
        exit: { from: "start", req: "true", value: "yes" },
        region: "escape",
      },
    ]);
    expect(solve(compile(UPSTREAM_TEST), {}).location("links-uncle")).toBe(
      "yes",
    );
  });

  it("rescues Zelda exactly when the Sanctuary opens", () => {
    const states: State[] = [
      {},
      { sword: 1 },
      { keyH2: 1 },
      { keyH2: 1, sword: 1 },
      { bow: 1, keyH2: 1 },
      { fireRod: 1, keyH2: 1 },
    ];
    for (const settings of [STANDARD, UPSTREAM_TEST]) {
      const world = compile(settings);
      for (const state of states) {
        const solution = solve(world, state);
        expect(solution.location("zelda")).toBe(solution.location("sanctuary"));
      }
    }
    expect(
      solve(compile(STANDARD), { keyH2: 1, sword: 1 }).location("zelda"),
    ).toBe("yes");
    expect(solve(compile(STANDARD), { sword: 1 }).location("zelda")).toBe("no");
  });
});

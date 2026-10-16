import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  anyExpr,
  canonicalExpr,
  rules,
  state,
  stateAndMore,
  world,
} from "../test/arbitraries";
import { evaluate, type State } from "./evaluate";
import { parse } from "./parser";
import { print } from "./printer";
import type { Rules } from "./rules";
import { solve } from "./solve";
import { and, compare, type Tri } from "./tri";
import { compileWorld, type World } from "./world";

const RUNS = { numRuns: 500 };

/**
 * The fixpoint definition, iterated literally until nothing changes
 * (Bellman-Ford style, every requirement re-evaluated each round): slow, but
 * obviously the specification. The real solver must agree with it.
 */
function referenceSolve(w: World, s: State, r: Rules) {
  const req = (text: string | undefined): Tri =>
    text === undefined ? "yes" : evaluate(parse(text), s, r);
  const regions: Record<string, Tri> = {};
  for (const region of w.regions) {
    regions[region.id] = region.id === w.start ? "yes" : "no";
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of w.regions) {
      for (const exit of region.exits ?? []) {
        const via = and(regions[region.id] ?? "no", req(exit.req));
        if (compare(via, regions[exit.to] ?? "no") > 0) {
          regions[exit.to] = via;
          changed = true;
        }
      }
    }
  }
  const locations: Record<string, Tri> = {};
  for (const region of w.regions) {
    for (const location of region.locations ?? []) {
      locations[location.id] = and(
        regions[region.id] ?? "no",
        req(location.req),
      );
    }
  }
  return { locations, regions };
}

describe("printer/parser round trip", () => {
  it("parse(print(ast)) gives back any tree the parser can build", () => {
    fc.assert(
      fc.property(canonicalExpr, (expr) => {
        expect(parse(print(expr))).toEqual(expr);
      }),
      { numRuns: 1000 },
    );
  });

  it("print(ast) of any other tree parses to an equivalent requirement", () => {
    fc.assert(
      fc.property(anyExpr, state, (expr, s) => {
        expect(evaluate(parse(print(expr)), s, rules)).toBe(
          evaluate(expr, s, rules),
        );
      }),
      RUNS,
    );
  });
});

describe("compiled evaluation", () => {
  it("agrees with the reference evaluator", () => {
    fc.assert(
      fc.property(canonicalExpr, state, (expr, s) => {
        const compiled = compileWorld(
          {
            regions: [{ id: "r", locations: [{ id: "l", req: print(expr) }] }],
            start: "r",
          },
          rules,
        );
        expect(solve(compiled, s).location("l")).toBe(evaluate(expr, s, rules));
      }),
      RUNS,
    );
  });
});

describe("solver", () => {
  it("agrees with the literal fixpoint on random worlds, cycles included", () => {
    fc.assert(
      fc.property(world, state, (w, s) => {
        const solution = solve(compileWorld(w, rules), s);
        const expected = referenceSolve(w, s, rules);
        expect(solution.regions()).toEqual(expected.regions);
        expect(solution.locations()).toEqual(expected.locations);
      }),
      RUNS,
    );
  });
});

describe("monotonicity: more items never lowers anything", () => {
  it("holds for every requirement", () => {
    fc.assert(
      fc.property(anyExpr, stateAndMore, (expr, [less, more]) => {
        const before = evaluate(expr, less, rules);
        const after = evaluate(expr, more, rules);
        expect(compare(before, after)).toBeLessThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it("holds for every region and location of a world", () => {
    fc.assert(
      fc.property(world, stateAndMore, (w, [less, more]) => {
        const compiled = compileWorld(w, rules);
        const before = solve(compiled, less);
        const after = solve(compiled, more);
        for (const id of compiled.regionIds) {
          expect(
            compare(before.region(id), after.region(id)),
            `region ${id}`,
          ).toBeLessThanOrEqual(0);
        }
        for (const id of compiled.locationIds) {
          expect(
            compare(before.location(id), after.location(id)),
            `location ${id}`,
          ).toBeLessThanOrEqual(0);
        }
      }),
      RUNS,
    );
  });
});

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  anyExpr,
  canonicalExpr,
  regionLevels,
  rules,
  settings,
  state,
  stateAndMore,
  world,
} from "../test/arbitraries";
import { type Expr, walk } from "./ast";
import { evaluate, type State } from "./evaluate";
import { parse } from "./parser";
import { print } from "./printer";
import type { Rules } from "./rules";
import { foldRules, foldSettings, type Settings } from "./settings";
import { solve } from "./solve";
import { and, compare, type Tri } from "./tri";
import { compileWorld, type World } from "./world";

const RUNS = { numRuns: 500 };

/**
 * The fixpoint definition, iterated literally until nothing changes
 * (Bellman-Ford style, every requirement re-evaluated each round): slow, but
 * obviously the specification. Locations come after, once every region level
 * is known, which is what `reach()` reads. The real solver must agree.
 */
function referenceSolve(w: World, s: State, r: Rules, set: Settings) {
  const regions: Record<string, Tri> = {};
  const req = (text: string | undefined): Tri =>
    text === undefined
      ? "yes"
      : evaluate(parse(text), s, r, { regions, settings: set });
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

/** Every setting node or setting threshold left in `expr`. */
function settingsLeft(expr: Expr): string[] {
  const left: string[] = [];
  walk(expr, (node) => {
    if (node.type === "setting") left.push(print(node));
    if (
      (node.type === "item" || node.type === "count") &&
      typeof node.min !== "number"
    ) {
      left.push(print(node));
    }
  });
  return left;
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
      fc.property(
        anyExpr,
        state,
        settings,
        regionLevels,
        (expr, s, set, regions) => {
          const options = { regions, settings: set };
          expect(evaluate(parse(print(expr)), s, rules, options)).toBe(
            evaluate(expr, s, rules, options),
          );
        },
      ),
      RUNS,
    );
  });
});

describe("settings folding", () => {
  it("leaves no setting, keeps the meaning and the parser's shape", () => {
    fc.assert(
      fc.property(
        canonicalExpr,
        state,
        settings,
        regionLevels,
        (expr, s, set, regions) => {
          const folded = foldSettings(expr, set, "Requirement");
          expect(settingsLeft(folded)).toEqual([]);
          expect(evaluate(folded, s, foldRules(rules, set), { regions })).toBe(
            evaluate(expr, s, rules, { regions, settings: set }),
          );
          expect(parse(print(folded))).toEqual(folded);
        },
      ),
      RUNS,
    );
  });

  it("folds every helper body too", () => {
    fc.assert(
      fc.property(settings, (set) => {
        for (const body of foldRules(rules, set).helpers.values()) {
          expect(settingsLeft(body)).toEqual([]);
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe("compiled evaluation", () => {
  it("agrees with the reference evaluator, reach() included", () => {
    fc.assert(
      fc.property(canonicalExpr, state, settings, (expr, s, set) => {
        // r1 and r2 get levels that vary with the state, for reach().
        const compiled = compileWorld(
          {
            regions: [
              {
                exits: [
                  { req: "bow", to: "r1" },
                  { req: "?hammer", to: "r2" },
                ],
                id: "r0",
                locations: [{ id: "l", req: print(expr) }],
              },
              { exits: [{ req: "glove", to: "r2" }], id: "r1" },
              { id: "r2" },
            ],
            start: "r0",
          },
          rules,
          { settings: set },
        );
        const solution = solve(compiled, s);
        const options = { regions: solution.regions(), settings: set };
        expect(solution.location("l")).toBe(evaluate(expr, s, rules, options));
      }),
      RUNS,
    );
  });
});

describe("solver", () => {
  it("agrees with the literal fixpoint on random worlds, cycles included", () => {
    fc.assert(
      fc.property(world, state, settings, (w, s, set) => {
        const solution = solve(compileWorld(w, rules, { settings: set }), s);
        const expected = referenceSolve(w, s, rules, set);
        expect(solution.regions()).toEqual(expected.regions);
        expect(solution.locations()).toEqual(expected.locations);
      }),
      RUNS,
    );
  });
});

describe("monotonicity: more items never lowers anything", () => {
  it("holds for every requirement, settings and their negations included", () => {
    fc.assert(
      fc.property(
        anyExpr,
        stateAndMore,
        settings,
        regionLevels,
        (expr, [less, more], set, regions) => {
          const options = { regions, settings: set };
          const before = evaluate(expr, less, rules, options);
          const after = evaluate(expr, more, rules, options);
          expect(compare(before, after)).toBeLessThanOrEqual(0);
        },
      ),
      RUNS,
    );
  });

  it("holds for every region and location of a compiled world", () => {
    fc.assert(
      fc.property(world, stateAndMore, settings, (w, [less, more], set) => {
        const compiled = compileWorld(w, rules, { settings: set });
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

// blockers() against brute force. Random small worlds over five items (one
// of them progressive) and a group; for each, every need of at most maxAtoms
// atoms is applied to the state and solved, and the minimal ones that reach
// the target must be exactly what blockers() lists.
//
// A group count is its own quantity in the analysis (one atom, whichever
// members). The oracle models that literally: `count(gem) >= n` becomes the
// item test `gemCount >= n` on a virtual item that starts at the members'
// sum, and atoms on members do not move it.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type Atom, analyze } from "./analyze";
import type { Expr } from "./ast";
import { itemValue, type State } from "./evaluate";
import { parse } from "./parser";
import { print } from "./printer";
import { loadRules } from "./rules";
import { solve } from "./solve";
import { compare, type Tri } from "./tri";
import { compileWorld, type World } from "./world";

const ITEMS = ["a", "b", "g1", "g2", "s"] as const;
const MAX: Readonly<Record<string, number>> = {
  a: 1,
  b: 1,
  g1: 1,
  g2: 1,
  s: 3,
};
const GROUP = "gem";
const VIRTUAL = "gemCount";

const HELPERS = {
  // A group count inside a helper, used by exits and locations.
  gems: "count(gem) >= 2 | s >= 3",
  light: "a | ?b",
  // reach() through a helper: locations only.
  near: "reach(r0) & ?(s >= 2)",
};
const EXIT_HELPERS = ["gems", "light"];
const ALL_HELPERS = Object.keys(HELPERS);

/** Group counts as the virtual item the oracle reads. */
function virtualize(expr: Expr): Expr {
  switch (expr.type) {
    case "count":
      return expr.names.every((name) => name === GROUP)
        ? { min: expr.min, name: VIRTUAL, type: "item" }
        : expr;
    case "maybe":
      return { expr: virtualize(expr.expr), type: "maybe" };
    case "and":
    case "or":
      return { args: expr.args.map(virtualize), type: expr.type };
    default:
      return expr;
  }
}

const rules = loadRules({ groups: { gem: ["g1", "g2"] }, helpers: HELPERS });
const oracleRules = loadRules({
  groups: { gem: ["g1", "g2"] },
  helpers: Object.fromEntries(
    Object.entries(HELPERS).map(([name, text]) => [
      name,
      print(virtualize(parse(text))),
    ]),
  ),
});

const DEPTH = { depthIdentifier: "expr", maxDepth: 3 } as const;

function exprs(regions: readonly string[], helpers: readonly string[]) {
  // Weighted towards item tests and counts: they are what blockers propose.
  const leaves: fc.WeightedArbitrary<Expr>[] = [
    {
      // Mostly within the item's range; sometimes past it (never reachable).
      arbitrary: fc.constantFrom(...ITEMS).chain((name) =>
        fc.record({
          min: fc.oneof(
            {
              arbitrary: fc.integer({ max: MAX[name] ?? 1, min: 1 }),
              weight: 4,
            },
            { arbitrary: fc.integer({ max: 3, min: 0 }), weight: 1 },
          ),
          name: fc.constant(name),
          type: fc.constant("item" as const),
        }),
      ),
      weight: 6,
    },
    {
      arbitrary: fc.record({
        min: fc.oneof(
          { arbitrary: fc.integer({ max: 3, min: 1 }), weight: 4 },
          { arbitrary: fc.integer({ max: 5, min: 0 }), weight: 1 },
        ),
        names: fc.constantFrom([GROUP], ["a", "s"], ["a", GROUP], ["s", "g1"]),
        type: fc.constant("count" as const),
      }),
      weight: 3,
    },
    {
      arbitrary: fc.record({
        type: fc.constant("const" as const),
        value: fc.constantFrom("yes" as const, "maybe" as const, "no" as const),
      }),
      weight: 1,
    },
    {
      arbitrary: fc.record({
        name: fc.constantFrom(...helpers),
        type: fc.constant("helper" as const),
      }),
      weight: 1,
    },
  ];
  if (regions.length > 0) {
    leaves.push({
      arbitrary: fc.record({
        region: fc.constantFrom(...regions),
        type: fc.constant("reach" as const),
      }),
      weight: 1,
    });
  }
  const leaf = fc.oneof(...leaves);
  return fc.letrec<{ expr: Expr }>((tie) => ({
    expr: fc.oneof(
      DEPTH,
      leaf,
      fc.record({ expr: tie("expr"), type: fc.constant("maybe" as const) }),
      fc.record({
        args: fc.array(tie("expr"), { maxLength: 3, minLength: 2 }),
        type: fc.constantFrom("and" as const, "or" as const),
      }),
    ),
  })).expr;
}

interface Spec {
  readonly exits: readonly { from: number; to: number; req: Expr }[];
  readonly locations: readonly { region: number; req: Expr }[];
  readonly regions: number;
}

const spec: fc.Arbitrary<Spec> = fc
  .integer({ max: 5, min: 1 })
  .chain((count) => {
    const ids = Array.from({ length: count }, (_, i) => `r${i}`);
    const region = fc.integer({ max: count - 1, min: 0 });
    const exitReq = exprs([], EXIT_HELPERS);
    // A spanning tree from r0 (every region reachable with enough items),
    // then random exits that close cycles and open longer, cheaper routes:
    // what makes the worklist expand a region again.
    const tree = fc.tuple(
      ...ids.slice(1).map((_, i) =>
        fc.record({
          from: fc.integer({ max: i, min: 0 }),
          req: exitReq,
          to: fc.constant(i + 1),
        }),
      ),
    );
    const extra = fc.array(
      fc.record({ from: region, req: exitReq, to: region }),
      { maxLength: 2 * count },
    );
    return fc.record({
      exits: fc
        .tuple(tree, extra)
        .map(([spanning, more]) => [...spanning, ...more]),
      locations: fc.array(fc.record({ region, req: exprs(ids, ALL_HELPERS) }), {
        maxLength: 4,
        minLength: 1,
      }),
      regions: fc.constant(count),
    });
  });

function build(s: Spec, map: (expr: Expr) => Expr): World {
  return {
    regions: Array.from({ length: s.regions }, (_, r) => ({
      exits: s.exits
        .filter((exit) => exit.from === r)
        .map((exit) => ({ req: print(map(exit.req)), to: `r${exit.to}` })),
      id: `r${r}`,
      locations: s.locations.flatMap((location, l) =>
        location.region === r
          ? [{ id: `l${l}`, req: print(map(location.req)) }]
          : [],
      ),
    })),
    start: "r0",
  };
}

// Mostly empty-handed, so that there is something left to collect.
const held = (arbitrary: fc.Arbitrary<number | boolean>) =>
  fc.oneof({ arbitrary: fc.constant(0), weight: 2 }, { arbitrary, weight: 1 });
const stateArb: fc.Arbitrary<State> = fc.record({
  a: held(fc.constant(1)),
  b: held(fc.constant(true)),
  g1: held(fc.constant(1)),
  g2: held(fc.constant(true)),
  s: held(fc.integer({ max: 3, min: 1 })),
});
const acquirableArb = fc.oneof(
  { arbitrary: fc.constant([...ITEMS]), weight: 2 },
  { arbitrary: fc.subarray([...ITEMS]), weight: 1 },
);
const maxAtomsArb = fc.oneof(
  { arbitrary: fc.constant(3), weight: 2 },
  { arbitrary: fc.integer({ max: 3, min: 0 }), weight: 1 },
);

/** A need as `name>=level` atoms, sorted: comparable as a string. */
type Vector = ReadonlyMap<string, number>;
const keyOfVector = (vector: Vector) =>
  [...vector]
    .map(([name, level]) => `${name}>=${level}`)
    .sort()
    .join(",");
const keyOfAtoms = (atoms: readonly Atom[]) =>
  atoms
    .map((atom) =>
      "item" in atom ? `${atom.item}>=${atom.min}` : `${VIRTUAL}>=${atom.min}`,
    )
    .sort()
    .join(",");

/** `w <= v` pointwise. */
const below = (w: Vector, v: Vector) =>
  [...w].every(([name, level]) => (v.get(name) ?? -1) >= level);

const reaches = (value: Tri, target: "yes" | "maybe") =>
  compare(value, target) >= 0;

const tally = { exact: 0, informative: 0, truncated: 0 };

describe("analyze: blockers against brute force", () => {
  it("lists exactly the minimal needs within maxAtoms", () => {
    fc.assert(
      fc.property(
        spec,
        stateArb,
        acquirableArb,
        maxAtomsArb,
        (s, state, acquirableItems, maxAtoms) => {
          const acquirable = new Set<string>(acquirableItems);
          const world = compileWorld(
            build(s, (e) => e),
            rules,
          );
          const oracle = compileWorld(build(s, virtualize), oracleRules);
          const analysis = analyze(world, state, {
            acquirable: (x) => acquirable.has(x),
            maxAtoms,
            maxLevel: (x) => MAX[x] ?? 1,
          });

          // The variables and the levels an atom may raise each one to.
          const cap = (x: string) =>
            acquirable.has(x)
              ? Math.max(itemValue(state, x), MAX[x] ?? 1)
              : itemValue(state, x);
          const gems = itemValue(state, "g1") + itemValue(state, "g2");
          const variables = [
            ...ITEMS.map((x) => ({
              cap: cap(x),
              cur: itemValue(state, x),
              name: x,
            })),
            { cap: cap("g1") + cap("g2"), cur: gems, name: VIRTUAL },
          ];
          const vectors: Vector[] = [];
          const enumerate = (i: number, chosen: Map<string, number>) => {
            if (i === variables.length) {
              vectors.push(new Map(chosen));
              return;
            }
            enumerate(i + 1, chosen);
            const variable = variables[i];
            if (variable === undefined || chosen.size >= maxAtoms) return;
            for (let level = variable.cur + 1; level <= variable.cap; level++) {
              chosen.set(variable.name, level);
              enumerate(i + 1, chosen);
              chosen.delete(variable.name);
            }
          };
          enumerate(0, new Map());
          const base: Record<string, number | boolean | undefined> = {
            ...state,
            [VIRTUAL]: gems,
          };
          const solved = vectors.map((vector) => ({
            solution: solve(oracle, { ...base, ...Object.fromEntries(vector) }),
            vector,
          }));

          const current = solve(oracle, base);
          expect(analysis.doableNow()).toEqual(
            oracle.locationIds.filter((id) => current.location(id) === "yes"),
          );

          for (const id of world.locationIds) {
            for (const target of ["yes", "maybe"] as const) {
              const result = analysis.blockers(id, target);
              if (result.truncated) {
                // Still sound: every listed set gets there.
                tally.truncated++;
                for (const atoms of result.sets) {
                  const applied = { ...base };
                  for (const atom of atoms) {
                    applied["item" in atom ? atom.item : VIRTUAL] = atom.min;
                  }
                  expect(
                    reaches(solve(oracle, applied).location(id), target),
                  ).toBe(true);
                }
                continue;
              }
              const good = solved
                .filter(({ solution }) =>
                  reaches(solution.location(id), target),
                )
                .map(({ vector }) => vector);
              const minimal = good.filter(
                (v) => !good.some((w) => w !== v && below(w, v)),
              );
              const expected = minimal.map(keyOfVector).sort();
              expect(
                result.sets.map(keyOfAtoms).sort(),
                `${id} ${target}`,
              ).toEqual(expected);
              tally.exact++;
              if (expected.length > 0 && expected[0] !== "")
                tally.informative++;
            }
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  afterAll(() => {
    // The comparison must not pass vacuously: nearly every case compared
    // exactly, and many had something to collect (about a third does; the
    // rest is already there, or out of reach within maxAtoms).
    expect(tally.truncated).toBeLessThan(tally.exact / 20);
    expect(tally.informative).toBeGreaterThan(tally.exact / 5);
  });
});

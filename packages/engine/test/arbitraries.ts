// fast-check generators shared by the property tests: requirements over a
// small item alphabet (so random states and requirements overlap), settings,
// region levels, states, "more items" extensions of a state, and random
// worlds with cycles.
import fc from "fast-check";
import type { Expr, Threshold } from "../src/ast";
import { itemValue, type State } from "../src/evaluate";
import { print } from "../src/printer";
import { loadRules } from "../src/rules";
import type { Settings } from "../src/settings";
import { TRI_VALUES, type Tri } from "../src/tri";
import type { World } from "../src/world";

export const ITEMS = [
  "bow",
  "c1",
  "c2",
  "c3",
  "glove",
  "hammer",
  "lantern",
  "moonPearl",
  "sword_2",
] as const;

/** Settings every generated `settings` value defines, flags and numbers. */
export const FLAG_SETTINGS = ["open", "swordless"] as const;
export const NUMBER_SETTINGS = ["crystals", "minSword"] as const;

/** Regions free-standing requirements may `reach()`; worlds use their own. */
export const REGIONS = ["r0", "r1", "r2"] as const;

export const rules = loadRules({
  groups: { crystal: ["c1", "c2", "c3"] },
  helpers: {
    canLiftRocks: "glove",
    crystals: "count(crystal) >= 2",
    darkRoom: "?lantern",
    heavy: "@canLiftRocks & glove >= 2 | hammer & @darkRoom",
    // reach() through a helper: usable in locations only. Every generated
    // world has an r0 (its start).
    seesStart: "reach(r0) & ?@darkRoom",
    // Settings inside a helper: folded with the world's settings.
    swordGate:
      "!setting(swordless) & sword_2 >= setting(minSword) | setting(swordless) & hammer",
  },
});

/** Helpers an exit may use: none of them reaches reach(), even indirectly. */
const EXIT_HELPERS = [...rules.helpers.keys()].filter((h) => h !== "seesStart");
const ALL_HELPERS = [...rules.helpers.keys()];
const DEPTH = { depthIdentifier: "expr", maxDepth: 4 } as const;

const threshold = (max: number): fc.Arbitrary<Threshold> =>
  fc.oneof(
    { arbitrary: fc.integer({ max, min: 0 }), weight: 4 },
    {
      arbitrary: fc.record({ setting: fc.constantFrom(...NUMBER_SETTINGS) }),
      weight: 1,
    },
  );

interface ExprArbitraries {
  /** Trees in the parser's shape: parse(print(x)) must give x back. */
  readonly canonical: fc.Arbitrary<Expr>;
  /** Any tree, including shapes the parser never builds (empty, nested). */
  readonly any: fc.Arbitrary<Expr>;
}

/**
 * Requirement generators. `regions` are what `reach()` may name (none: no
 * reach at all), `helpers` the helpers they may call.
 */
export function exprArbitraries(
  regions: readonly string[],
  helpers: readonly string[] = ALL_HELPERS,
): ExprArbitraries {
  const leaves: fc.Arbitrary<Expr>[] = [
    fc.record({
      min: threshold(3),
      name: fc.constantFrom(...ITEMS),
      type: fc.constant("item" as const),
    }),
    fc.record({
      min: threshold(5),
      names: fc.array(fc.constantFrom(...ITEMS, "crystal"), {
        maxLength: 3,
        minLength: 1,
      }),
      type: fc.constant("count" as const),
    }),
    fc.record({
      name: fc.constantFrom(...helpers),
      type: fc.constant("helper" as const),
    }),
    fc.record({
      type: fc.constant("const" as const),
      value: fc.constantFrom(...TRI_VALUES),
    }),
    fc.record({
      name: fc.constantFrom(...FLAG_SETTINGS),
      negated: fc.boolean(),
      type: fc.constant("setting" as const),
    }),
  ];
  if (regions.length > 0) {
    leaves.push(
      fc.record({
        region: fc.constantFrom(...regions),
        type: fc.constant("reach" as const),
      }),
    );
  }
  const leaf = fc.oneof(...leaves);

  const canonical = fc.letrec<{
    and: Expr;
    expr: Expr;
    maybe: Expr;
    or: Expr;
  }>((tie) => ({
    and: fc
      .array(fc.oneof(DEPTH, leaf, tie("maybe"), tie("or")), {
        maxLength: 3,
        minLength: 2,
      })
      .map((args): Expr => ({ args, type: "and" })),
    expr: fc.oneof(DEPTH, leaf, tie("maybe"), tie("and"), tie("or")),
    maybe: fc.record({
      expr: tie("expr"),
      type: fc.constant("maybe" as const),
    }),
    or: fc
      .array(fc.oneof(DEPTH, leaf, tie("maybe"), tie("and")), {
        maxLength: 3,
        minLength: 2,
      })
      .map((args): Expr => ({ args, type: "or" })),
  })).expr;

  const any = fc.letrec<{ expr: Expr }>((tie) => ({
    expr: fc.oneof(
      DEPTH,
      leaf,
      fc.record({ expr: tie("expr"), type: fc.constant("maybe" as const) }),
      fc.record({
        args: fc.array(tie("expr"), { maxLength: 3 }),
        type: fc.constantFrom("and" as const, "or" as const),
      }),
    ),
  })).expr;

  return { any, canonical };
}

const free = exprArbitraries(REGIONS);

/** Parser-shaped requirements that may reach REGIONS. */
export const canonicalExpr: fc.Arbitrary<Expr> = free.canonical;
/** Any requirement tree that may reach REGIONS. */
export const anyExpr: fc.Arbitrary<Expr> = free.any;

/** A flag, or one not known yet. */
const flagArb = fc.oneof(fc.boolean(), fc.constant({ unknown: true } as const));

/** A number up to `max`, or a range of them not known yet. */
const numberArb = (max: number) =>
  fc.oneof(
    fc.integer({ max, min: 0 }),
    fc
      .tuple(fc.integer({ max, min: 0 }), fc.integer({ max, min: 0 }))
      .map(([a, b]) => ({
        between: [Math.min(a, b), Math.max(a, b)] as const,
      })),
  );

/**
 * A value for every setting the generated requirements can use: known, or
 * not known yet (a flag either way, a number in a range).
 */
export const settings: fc.Arbitrary<Settings> = fc.record({
  crystals: numberArb(4),
  minSword: numberArb(3),
  open: flagArb,
  swordless: flagArb,
});

/**
 * Settings, and the same ones with every setting not known yet given one of
 * its values: what the run turns out to be.
 */
export const settingsAndKnown: fc.Arbitrary<[Settings, Settings]> =
  settings.chain((set) =>
    fc.tuple(
      fc.constant(set),
      fc.record(
        Object.fromEntries(
          Object.entries(set).map(([name, value]) => [
            name,
            typeof value !== "object"
              ? fc.constant(value)
              : "unknown" in value
                ? fc.boolean()
                : fc.integer({ max: value.between[1], min: value.between[0] }),
          ]),
        ),
      ) as fc.Arbitrary<Settings>,
    ),
  );

/** A level for every region in REGIONS, for evaluating `reach()`. */
export const regionLevels: fc.Arbitrary<Record<string, Tri>> = fc.record(
  Object.fromEntries(REGIONS.map((id) => [id, fc.constantFrom(...TRI_VALUES)])),
);

const itemValueArb = fc.oneof(fc.boolean(), fc.integer({ max: 3, min: 0 }));

/** A random inventory over ITEMS; missing keys are "not collected". */
export const state: fc.Arbitrary<State> = fc.record(
  Object.fromEntries(ITEMS.map((item) => [item, itemValueArb])),
  { requiredKeys: [] },
);

/** A state and a second one holding at least as much of every item. */
export const stateAndMore: fc.Arbitrary<[State, State]> = fc
  .tuple(
    state,
    fc.record(
      Object.fromEntries(
        ITEMS.map((item) => [item, fc.integer({ max: 2, min: 0 })]),
      ),
    ),
  )
  .map(([less, extra]) => [
    less,
    Object.fromEntries(
      ITEMS.map((item) => [item, itemValue(less, item) + (extra[item] ?? 0)]),
    ),
  ]);

const exitReq = fc.option(
  exprArbitraries([], EXIT_HELPERS).canonical.map(print),
  {
    nil: undefined,
  },
);

/**
 * A world of 1 to 8 regions starting at r0, each with up to 4 exits to any
 * region (cycles and self-loops included) and up to 3 locations, about a
 * third of them visible from somewhere (their own region or any other).
 * Location and visible requirements may reach() any region; exit
 * requirements never do.
 */
export const world: fc.Arbitrary<World> = fc
  .integer({ max: 8, min: 1 })
  .chain((count) => {
    const ids = Array.from({ length: count }, (_, i) => `r${i}`);
    const locationReq = fc.option(exprArbitraries(ids).canonical.map(print), {
      nil: undefined,
    });
    const visible = fc.option(
      fc.record({
        from: fc.option(fc.constantFrom(...ids), { nil: undefined }),
        req: locationReq,
      }),
      { freq: 2, nil: undefined },
    );
    const region = fc.record({
      exits: fc.array(
        fc.record({ req: exitReq, to: fc.constantFrom(...ids) }),
        { maxLength: 4 },
      ),
      locations: fc.array(fc.record({ req: locationReq, visible }), {
        maxLength: 3,
      }),
    });
    return fc.array(region, { maxLength: count, minLength: count }).map(
      (regions): World => ({
        regions: regions.map((r, i) => ({
          exits: r.exits,
          id: `r${i}`,
          locations: r.locations.map((location, j) => ({
            id: `r${i}l${j}`,
            ...location,
          })),
        })),
        start: "r0",
      }),
    );
  });

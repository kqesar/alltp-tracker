import { describe, expect, it } from "vitest";
import { type AnalyzeOptions, type Atom, analyze, MAX_SETS } from "./analyze";
import type { State } from "./evaluate";
import { loadRules, type Rules } from "./rules";
import { compileWorld, type World } from "./world";

const item = (name: string, min = 1): Atom => ({ item: name, min });
const group = (name: string, min: number): Atom => ({ group: name, min });

/** One location `l` in the start region, behind nothing. */
const single = (req: string): World => ({
  regions: [{ id: "r", locations: [{ id: "l", req }] }],
  start: "r",
});

const blockersOf = (
  world: World,
  state: State = {},
  options: AnalyzeOptions = {},
  target: "yes" | "maybe" = "yes",
  rules?: Rules,
  location = "l",
) =>
  analyze(compileWorld(world, rules), state, options).blockers(
    location,
    target,
  );

const setsOf = (...args: Parameters<typeof blockersOf>) => {
  const result = blockersOf(...args);
  expect(result.truncated).toBe(false);
  return result.sets;
};

describe("analyze: blockers", () => {
  it("asks for the one missing item", () => {
    expect(setsOf(single("hammer"))).toEqual([[item("hammer")]]);
  });

  it("asks for the next level of a progressive item, as one atom", () => {
    expect(setsOf(single("sword >= 2"), { sword: 1 })).toEqual([
      [item("sword", 2)],
    ]);
    // From nothing, still one atom: sword >= 2, not sword then sword again.
    expect(setsOf(single("sword >= 2"))).toEqual([[item("sword", 2)]]);
  });

  it("lists each way out of an or, and only the minimal ones", () => {
    expect(setsOf(single("hammer | hookshot"))).toEqual([
      [item("hammer")],
      [item("hookshot")],
    ]);
    expect(
      setsOf(single("hammer | hammer & hookshot | hookshot & boots")),
    ).toEqual([[item("hammer")], [item("boots"), item("hookshot")]]);
  });

  it("joins what the path needs with what the location needs", () => {
    const world: World = {
      regions: [
        { exits: [{ req: "glove", to: "dw" }], id: "lw" },
        { id: "dw", locations: [{ id: "l", req: "moonpearl" }] },
      ],
      start: "lw",
    };
    expect(setsOf(world)).toEqual([[item("glove"), item("moonpearl")]]);
    expect(setsOf(world, { glove: 1 })).toEqual([[item("moonpearl")]]);
    expect(setsOf(world, { moonpearl: true })).toEqual([[item("glove")]]);
  });

  it("keeps the cheapest route through a cycle of regions", () => {
    // r1 by a, or by c through r2; r2 by c, or by a then b through r1.
    const world: World = {
      regions: [
        {
          exits: [
            { req: "a", to: "r1" },
            { req: "c", to: "r2" },
          ],
          id: "r0",
        },
        { exits: [{ req: "b", to: "r2" }], id: "r1" },
        { exits: [{ to: "r1" }], id: "r2", locations: [{ id: "l" }] },
      ],
      start: "r0",
    };
    expect(setsOf(world)).toEqual([[item("c")], [item("a"), item("b")]]);
  });

  it("passes on what a region gains after it was first expanded", () => {
    // r1 is expanded with [a, b] first; the longer way r0 -> r2 -> r3 -> r1
    // brings [c] later, and r4 must hear of it.
    const world: World = {
      regions: [
        {
          exits: [
            { req: "a & b", to: "r1" },
            { req: "c", to: "r2" },
          ],
          id: "r0",
        },
        { exits: [{ req: "d", to: "r4" }], id: "r1" },
        { exits: [{ to: "r3" }], id: "r2" },
        { exits: [{ to: "r1" }], id: "r3" },
        { id: "r4", locations: [{ id: "l" }] },
      ],
      start: "r0",
    };
    expect(setsOf(world)).toEqual([
      [item("c"), item("d")],
      [item("a"), item("b"), item("d")],
    ]);
  });

  it("drops a need once a cheaper way into the region covers it", () => {
    // r1 is first reached needing a and b; the way through r2 needs a only.
    const world: World = {
      regions: [
        {
          exits: [
            { req: "a & b", to: "r1" },
            { req: "a", to: "r2" },
          ],
          id: "r0",
        },
        { id: "r1", locations: [{ id: "l" }] },
        { exits: [{ to: "r1" }], id: "r2" },
      ],
      start: "r0",
    };
    expect(setsOf(world)).toEqual([[item("a")]]);
  });

  it("reads a group count as one atom, whichever members", () => {
    const rules = loadRules({
      groups: { crystal: ["c1", "c2", "c3", "c4", "c5", "c6", "c7"] },
    });
    const world = single("count(crystal) >= 7");
    const five = { c1: 1, c2: 1, c3: 1, c4: 1, c5: 1 };
    expect(setsOf(world, five, {}, "yes", rules)).toEqual([
      [group("crystal", 7)],
    ]);
    // c6 cannot be had: seven is out of reach whatever else is collected.
    expect(
      setsOf(world, five, { acquirable: (x) => x !== "c6" }, "yes", rules),
    ).toEqual([]);
    // The count is its own quantity: c6 does not stand in for one crystal.
    expect(
      setsOf(single("c6 & count(crystal) >= 7"), five, {}, "yes", rules),
    ).toEqual([[item("c6"), group("crystal", 7)]]);
  });

  it("spreads the units a count over items lacks on the items that can give them", () => {
    const world = single("count(a, b, c) >= 2");
    // Each item is a flag by default (no test of a above 1).
    expect(setsOf(world, { a: 1 })).toEqual([[item("b")], [item("c")]]);
    expect(setsOf(world)).toEqual([
      [item("a"), item("b")],
      [item("a"), item("c")],
      [item("b"), item("c")],
    ]);
    // With a able to reach 2, a alone can add the missing unit.
    expect(
      setsOf(world, { a: 1 }, { maxLevel: (x) => (x === "a" ? 3 : 1) }),
    ).toEqual([[item("a", 2)], [item("b")], [item("c")]]);
  });

  it("bounds an item by the highest level the world tests, or maxLevel", () => {
    // sword >= 3 elsewhere lets the count take up to 3 from the sword.
    const world: World = {
      regions: [
        {
          id: "r",
          locations: [
            { id: "l", req: "count(sword, bow) >= 4" },
            { id: "tablet", req: "sword >= 3" },
          ],
        },
      ],
      start: "r",
    };
    expect(setsOf(world)).toEqual([[item("bow"), item("sword", 3)]]);
    expect(setsOf(single("sword >= 5"), {}, { maxLevel: () => 4 })).toEqual([]);
  });

  it("says [[]] when there and [] when nothing within maxAtoms gets there", () => {
    expect(setsOf(single("hammer"), { hammer: true })).toEqual([[]]);
    expect(setsOf(single("a & b & c & d"))).toEqual([]);
    expect(setsOf(single("a & b & c & d"), {}, { maxAtoms: 4 })).toEqual([
      [item("a"), item("b"), item("c"), item("d")],
    ]);
    expect(setsOf(single("a"), {}, { maxAtoms: 0 })).toEqual([]);
    expect(setsOf(single("false"))).toEqual([]);
  });

  it("thresholds maybe: ?x needs x for yes and nothing for maybe", () => {
    const world: World = {
      regions: [
        { exits: [{ req: "?lantern", to: "dark" }], id: "r" },
        { id: "dark", locations: [{ id: "l", req: "bow | maybe" }] },
      ],
      start: "r",
    };
    expect(setsOf(world, {}, {}, "maybe")).toEqual([[]]);
    expect(setsOf(world, {}, {}, "yes")).toEqual([
      [item("bow"), item("lantern")],
    ]);
    expect(setsOf(single("?lantern & glove"), {}, {}, "maybe")).toEqual([
      [item("glove")],
    ]);
  });

  it("proposes only acquirable items", () => {
    const options = { acquirable: (x: string) => x !== "hammer" };
    expect(setsOf(single("hammer | hookshot"), {}, options)).toEqual([
      [item("hookshot")],
    ]);
    expect(setsOf(single("hammer"), {}, options)).toEqual([]);
  });

  it("goes through helpers and reach() (the Mimic Cave pattern)", () => {
    const rules = loadRules({
      helpers: { canMirror: "mirror & reach(ledge)" },
    });
    const world: World = {
      regions: [
        {
          exits: [{ req: "hookshot", to: "ledge" }],
          id: "mountain",
          locations: [{ id: "l", req: "@canMirror" }],
        },
        { id: "ledge" },
      ],
      start: "mountain",
    };
    expect(setsOf(world, {}, {}, "yes", rules)).toEqual([
      [item("hookshot"), item("mirror")],
    ]);
  });

  it("caps a node at MAX_SETS sets, cheapest first, and says so", () => {
    const many = Array.from({ length: 40 }, (_, i) => `i${i}`);
    const world: World = {
      regions: [
        { exits: [{ req: many.join(" | "), to: "far" }], id: "r" },
        { id: "far", locations: [{ id: "l", req: "boots" }] },
      ],
      start: "r",
    };
    const result = blockersOf(world);
    expect(result.truncated).toBe(true);
    expect(result.sets).toHaveLength(MAX_SETS);
    for (const set of result.sets) {
      expect(set).toHaveLength(2);
      expect(set).toContainEqual(item("boots"));
    }
    // Forty exits into one region: its own antichain is cut, and so is
    // everything downstream of it.
    const funnel = compileWorld({
      regions: [
        { exits: many.map((req) => ({ req, to: "hub" })), id: "r" },
        {
          exits: [{ req: "flute", to: "beyond" }],
          id: "hub",
          locations: [{ id: "h" }],
        },
        { id: "beyond", locations: [{ id: "b" }] },
      ],
      start: "r",
    });
    const analysis = analyze(funnel, {});
    for (const [id, size] of [
      ["h", 1],
      ["b", 2],
    ] as const) {
      const cut = analysis.blockers(id, "yes");
      expect(cut.truncated, id).toBe(true);
      expect(cut.sets, id).toHaveLength(MAX_SETS);
      for (const set of cut.sets) expect(set, id).toHaveLength(size);
    }
    // A location that does not depend on the capped node is exact.
    const near = compileWorld({
      regions: [
        {
          exits: [{ req: many.join(" | "), to: "far" }],
          id: "r",
          locations: [{ id: "l", req: "a | b" }],
        },
        { id: "far" },
      ],
      start: "r",
    });
    expect(analyze(near, {}).blockers("l", "yes")).toEqual({
      sets: [[item("a")], [item("b")]],
      truncated: false,
    });
  });

  it("memoizes, lists what is doable now, and rejects bad input", () => {
    const world = compileWorld({
      regions: [
        {
          id: "r",
          locations: [
            { id: "free" },
            { id: "l", req: "hammer" },
            { id: "dark", req: "?lantern" },
          ],
        },
      ],
      start: "r",
    });
    const analysis = analyze(world, {});
    expect(analysis.blockers("l", "yes")).toBe(analysis.blockers("l", "yes"));
    expect(analysis.doableNow()).toEqual(["free"]);
    expect(() => analysis.blockers("nowhere", "yes")).toThrow(
      'Unknown location "nowhere"',
    );
    expect(() => analysis.blockers("l", "no" as unknown as "yes")).toThrow(
      'Unknown target "no"',
    );
    expect(() => analyze(world, {}, { maxAtoms: -1 })).toThrow(RangeError);
    expect(() => analyze(world, {}, { maxAtoms: 1.5 })).toThrow(RangeError);
  });
});

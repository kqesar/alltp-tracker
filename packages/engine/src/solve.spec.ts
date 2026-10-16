import { describe, expect, it } from "vitest";
import type { State } from "./evaluate";
import { ParseError } from "./parser";
import { DefinitionError, loadRules, type Rules } from "./rules";
import { solve } from "./solve";
import type { Tri } from "./tri";
import { type CompileOptions, compileWorld, type World } from "./world";

const run = (world: World, state: State = {}, rules?: Rules) =>
  solve(compileWorld(world, rules), state);

describe("solve: reachability", () => {
  const chain: World = {
    regions: [
      {
        exits: [{ to: "b" }],
        id: "a",
        locations: [{ id: "la" }],
      },
      {
        exits: [{ req: "hammer", to: "c" }],
        id: "b",
        locations: [{ id: "lb", req: "bow" }],
      },
      { id: "c", locations: [{ id: "lc", req: "true" }] },
    ],
    start: "a",
  };

  it("follows exits whose requirements hold", () => {
    const empty = run(chain);
    expect(empty.regions()).toEqual({ a: "yes", b: "yes", c: "no" });
    expect(empty.locations()).toEqual({ la: "yes", lb: "no", lc: "no" });

    const hammer = run(chain, { bow: true, hammer: true });
    expect(hammer.regions()).toEqual({ a: "yes", b: "yes", c: "yes" });
    expect(hammer.locations()).toEqual({ la: "yes", lb: "yes", lc: "yes" });
  });

  it("leaves regions out of reach at no, whatever their requirements", () => {
    const solution = run({
      regions: [
        { exits: [{ req: "false", to: "walled" }], id: "home" },
        { id: "walled", locations: [{ id: "behindWall" }] },
        // No exit leads here; its own exits and free locations do not count.
        {
          exits: [{ to: "home" }, { to: "onlyFromIsland" }],
          id: "island",
          locations: [{ id: "free" }],
        },
        { id: "onlyFromIsland", locations: [{ id: "far" }] },
      ],
      start: "home",
    });
    expect(solution.regions()).toEqual({
      home: "yes",
      island: "no",
      onlyFromIsland: "no",
      walled: "no",
    });
    expect(solution.locations()).toEqual({
      behindWall: "no",
      far: "no",
      free: "no",
    });
  });

  it("always reaches the start, even when every way back is out of logic", () => {
    const solution = run({
      regions: [
        { exits: [{ req: "false", to: "home" }], id: "home" },
        { exits: [{ req: "false", to: "home" }], id: "other" },
      ],
      start: "home",
    });
    expect(solution.region("home")).toBe("yes");
    expect(solution.region("other")).toBe("no");
  });
});

describe("solve: maybe", () => {
  const cave: World = {
    regions: [
      { exits: [{ req: "?lantern", to: "dark" }], id: "entrance" },
      {
        exits: [{ to: "deeper" }],
        id: "dark",
        locations: [
          { id: "torch", req: "?firerod" },
          { id: "never", req: "false" },
        ],
      },
      { id: "deeper", locations: [{ id: "treasure" }] },
    ],
    start: "entrance",
  };

  it("propagates a maybe exit to everything behind it", () => {
    const solution = run(cave);
    expect(solution.regions()).toEqual({
      dark: "maybe",
      deeper: "maybe",
      entrance: "yes",
    });
    expect(solution.locations()).toEqual({
      never: "no",
      torch: "maybe",
      treasure: "maybe",
    });
  });

  it("takes the lower of region and location", () => {
    const solution = run(cave, { lantern: true });
    expect(solution.region("dark")).toBe("yes");
    expect(solution.location("treasure")).toBe("yes");
    // In a "yes" region, the location's own maybe still shows.
    expect(solution.location("torch")).toBe("maybe");
    expect(solution.location("never")).toBe("no");
  });

  it("rates a path by its weakest exit and keeps the best path", () => {
    const solution = run({
      regions: [
        { exits: [{ to: "b" }, { to: "f" }], id: "a" },
        { exits: [{ req: "?x", to: "c" }], id: "b" },
        { exits: [{ to: "d" }], id: "c" },
        { exits: [{ to: "e" }], id: "d" },
        { exits: [{ to: "g" }], id: "f" },
        { exits: [{ to: "e" }], id: "g" },
        { id: "e" },
      ],
      start: "a",
    });
    // c and d sit behind the maybe exit; e is also reachable along a-f-g.
    expect(solution.regions()).toEqual({
      a: "yes",
      b: "yes",
      c: "maybe",
      d: "maybe",
      e: "yes",
      f: "yes",
      g: "yes",
    });
  });

  // The maybe route to "t" is listed (and so found) first, then the yes route
  // must raise it: in both orders the answer is the same.
  it.each([
    [[{ req: "?x", to: "t" }, { to: "m" }]],
    [[{ to: "m" }, { req: "?x", to: "t" }]],
  ])("raises a region found as maybe when a yes path appears (%j)", (exits) => {
    const solution = run({
      regions: [
        { exits, id: "a" },
        { exits: [{ to: "t" }], id: "m" },
        { id: "t" },
      ],
      start: "a",
    });
    expect(solution.region("t")).toBe("yes");
  });
});

describe("solve: cycles", () => {
  it("terminates on cycles and self-loops", () => {
    const solution = run({
      regions: [
        { exits: [{ to: "a" }, { to: "b" }], id: "a" },
        { exits: [{ to: "c" }, { to: "a" }], id: "b" },
        { exits: [{ to: "a" }, { req: "false", to: "d" }], id: "c" },
        { exits: [{ to: "d" }], id: "d" },
      ],
      start: "a",
    });
    expect(solution.regions()).toEqual({
      a: "yes",
      b: "yes",
      c: "yes",
      d: "no",
    });
  });

  const loop: World = {
    regions: [
      {
        exits: [
          { req: "?x", to: "b" },
          { req: "y", to: "c" },
        ],
        id: "a",
      },
      { exits: [{ to: "c" }], id: "b", locations: [{ id: "lb" }] },
      { exits: [{ to: "b" }, { to: "a" }], id: "c" },
    ],
    start: "a",
  };

  it.each<[State, Tri]>([
    [{}, "maybe"],
    [{ x: 1 }, "yes"],
    // Entering the cycle at c with "yes" raises b, already reached as maybe.
    [{ y: 1 }, "yes"],
  ])("solves a cycle entered through a maybe exit (%j)", (state, expected) => {
    const solution = run(loop, state);
    expect(solution.region("b")).toBe(expected);
    expect(solution.region("c")).toBe(expected);
    expect(solution.location("lb")).toBe(expected);
  });
});

describe("solve: compiled worlds", () => {
  const rules = loadRules({
    groups: { crystal: ["c1", "c2", "c3"] },
    helpers: { canLiftRocks: "glove", darkWorld: "moonpearl & @canLiftRocks" },
  });
  const world: World = {
    regions: [
      { exits: [{ req: "@darkWorld", to: "dw" }], id: "lw" },
      {
        id: "dw",
        locations: [
          { id: "pyramid" },
          { id: "tower", req: "count(crystal) >= 2" },
          { id: "rock", req: "@canLiftRocks" },
        ],
      },
    ],
    start: "lw",
  };

  it("resolves helpers and groups", () => {
    const compiled = compileWorld(world, rules);
    const state = { c1: true, c3: 1, glove: 1, moonpearl: true };
    expect(solve(compiled, state).locations()).toEqual({
      pyramid: "yes",
      rock: "yes",
      tower: "yes",
    });
    expect(solve(compiled, { ...state, c3: 0 }).location("tower")).toBe("no");
  });

  it("is reusable: nothing from one solve leaks into the next", () => {
    const compiled = compileWorld(world, rules);
    const strong = { glove: 1, moonpearl: true };
    expect(solve(compiled, strong).location("rock")).toBe("yes");
    // The memoized @canLiftRocks of the previous solve must not be reused.
    expect(solve(compiled, { moonpearl: true }).region("dw")).toBe("no");
    expect(solve(compiled, strong).location("rock")).toBe("yes");
  });

  it("lists the items its requirements read", () => {
    const compiled = compileWorld(world, rules);
    expect([...compiled.items].sort()).toEqual([
      "c1",
      "c2",
      "c3",
      "glove",
      "moonpearl",
    ]);
  });

  it("rejects ids the world does not have", () => {
    const solution = solve(compileWorld(world, rules), {});
    expect(() => solution.region("nowhere")).toThrow(RangeError);
    expect(() => solution.location("nothing")).toThrow(
      'Unknown location "nothing"',
    );
  });
});

describe("compileWorld: definition errors", () => {
  const rules = loadRules({
    groups: { crystal: ["c1"] },
    helpers: { canSwim: "flippers" },
  });
  const failure = (world: World, options?: CompileOptions) => {
    try {
      compileWorld(world, rules, options);
    } catch (error) {
      if (error instanceof DefinitionError) return error;
      throw error;
    }
    throw new Error("expected compileWorld to throw a DefinitionError");
  };
  const oneRegion = (req: string): World => ({
    regions: [{ id: "r", locations: [{ id: "l", req }] }],
    start: "r",
  });

  it.each<[string, World, string]>([
    [
      "a duplicate region",
      { regions: [{ id: "r" }, { id: "r" }], start: "r" },
      'Duplicate region "r"',
    ],
    [
      "a duplicate location",
      {
        regions: [
          { id: "r", locations: [{ id: "l" }] },
          { id: "s", locations: [{ id: "l" }] },
        ],
        start: "r",
      },
      'Duplicate location "l" (regions "r" and "s")',
    ],
    [
      "an exit to nowhere",
      { regions: [{ exits: [{ to: "s" }], id: "r" }], start: "r" },
      'Region "r" has an exit to unknown region "s"',
    ],
    [
      "an unknown start",
      { regions: [{ id: "r" }], start: "s" },
      'Start region "s" does not exist',
    ],
    [
      "no regions at all",
      { regions: [], start: "r" },
      'Start region "r" does not exist',
    ],
    [
      "an unknown helper",
      oneRegion("@canFly"),
      'Location "l" uses unknown helper "@canFly"',
    ],
    [
      "a group outside count()",
      oneRegion("crystal"),
      'Location "l" uses the group "crystal" outside count()',
    ],
  ])("rejects %s", (_, world, message) => {
    expect(failure(world).message).toBe(message);
  });

  it("names the exit whose requirement does not parse, and where", () => {
    const error = failure({
      regions: [
        { exits: [{ req: "hammer |", to: "s" }], id: "r" },
        { id: "s" },
      ],
      start: "r",
    });
    expect(error.message).toMatch(/^Exit "r" -> "s": .* at position 8$/);
    expect(error.cause).toBeInstanceOf(ParseError);
  });

  it("checks every name against the item list when one is given", () => {
    const items = ["c1", "flippers", "hammer"];
    expect(failure(oneRegion("hammer & hamer"), { items }).message).toBe(
      'Location "l" uses unknown item "hamer"',
    );
    expect(
      failure(oneRegion("count(crystal, bow) >= 1"), { items }).message,
    ).toBe('Location "l" uses unknown item "bow"');
    expect(failure(oneRegion("true"), { items: ["hammer"] }).message).toBe(
      'Group "crystal" has unknown item "c1"',
    );
    expect(failure(oneRegion("true"), { items: ["c1"] }).message).toBe(
      'Helper "@canSwim" uses unknown item "flippers"',
    );
    expect(() =>
      compileWorld(oneRegion("hammer & @canSwim"), rules, { items }),
    ).not.toThrow();
  });
});

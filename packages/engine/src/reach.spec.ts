import { describe, expect, it } from "vitest";
import { evaluate, type State } from "./evaluate";
import { parse } from "./parser";
import { DefinitionError, loadRules, type RulesSource } from "./rules";
import { solve } from "./solve";
import type { Tri } from "./tri";
import { compileWorld, type World } from "./world";

function definitionError(run: () => unknown): DefinitionError {
  try {
    run();
  } catch (error) {
    if (error instanceof DefinitionError) return error;
    throw error;
  }
  throw new Error("expected a DefinitionError");
}

describe("reach() in a location requirement", () => {
  // The Mimic Cave pattern: the cave is a location of east Death Mountain,
  // but its door is only reachable from Turtle Rock's ledge, in the Dark
  // World, through the mirror. Its rule needs a second region reached.
  const world: World = {
    regions: [
      { exits: [{ req: "glove", to: "deathMountain" }], id: "lightWorld" },
      {
        exits: [{ req: "moonpearl & ?somaria", to: "turtleRockLedge" }],
        id: "deathMountain",
        locations: [
          { id: "mimicCave", req: "mirror & reach(turtleRockLedge)" },
          { id: "spiralCave" },
        ],
      },
      { id: "turtleRockLedge" },
    ],
    start: "lightWorld",
  };
  const compiled = compileWorld(world);

  it.each<[string, State, Tri]>([
    ["the ledge out of reach", { glove: 1, mirror: true }, "no"],
    [
      "the ledge reached, no mirror",
      { glove: 1, moonpearl: true, somaria: true },
      "no",
    ],
    [
      "the ledge reached as a maybe",
      { glove: 1, mirror: true, moonpearl: true },
      "maybe",
    ],
    [
      "everything",
      { glove: 1, mirror: true, moonpearl: true, somaria: true },
      "yes",
    ],
  ])("Mimic Cave with %s (%j) is %s", (_, state, expected) => {
    const solution = solve(compiled, state);
    expect(solution.location("spiralCave")).toBe("yes");
    expect(solution.location("mimicCave")).toBe(expected);
  });

  it("reads the final level of a region raised after its own region", () => {
    // The start's location reaches "far", which is found as a maybe first,
    // then raised to yes by a longer path.
    const solution = solve(
      compileWorld({
        regions: [
          {
            exits: [{ req: "?x", to: "far" }, { to: "a" }],
            id: "home",
            locations: [{ id: "view", req: "reach(far)" }],
          },
          { exits: [{ to: "b" }], id: "a" },
          { exits: [{ to: "far" }], id: "b" },
          { id: "far" },
        ],
        start: "home",
      }),
      {},
    );
    expect(solution.region("far")).toBe("yes");
    expect(solution.location("view")).toBe("yes");
  });

  it("works through a helper used by locations", () => {
    const rules = loadRules({
      helpers: { canMirrorIn: "mirror & reach(ledge)" },
    });
    const solution = solve(
      compileWorld(
        {
          regions: [
            {
              exits: [{ req: "hookshot", to: "ledge" }],
              id: "home",
              locations: [{ id: "cave", req: "@canMirrorIn | flute" }],
            },
            { id: "ledge" },
          ],
          start: "home",
        },
        rules,
      ),
      { hookshot: true, mirror: true },
    );
    expect(solution.location("cave")).toBe("yes");
  });

  it("is evaluated by evaluate() against the region levels it is given", () => {
    const expr = parse("reach(ledge) & mirror");
    const regions = { ledge: "maybe" } as const;
    expect(evaluate(expr, { mirror: true }, undefined, { regions })).toBe(
      "maybe",
    );
    expect(() => evaluate(expr, { mirror: true })).toThrow(
      "Requirement uses reach(ledge), but no level is known for that region",
    );
  });
});

describe("reach(): definition errors", () => {
  const twoRegions = (exitReq: string, locationReq = "true"): World => ({
    regions: [
      {
        exits: [{ req: exitReq, to: "s" }],
        id: "r",
        locations: [{ id: "l", req: locationReq }],
      },
      { id: "s" },
    ],
    start: "r",
  });
  const failure = (world: World, rules: RulesSource = {}) =>
    definitionError(() => compileWorld(world, loadRules(rules))).message;

  it("rejects reach() written in an exit", () => {
    expect(failure(twoRegions("hammer & reach(s)"))).toBe(
      'Exit "r" -> "s" uses reach(s): reach() is allowed only in location and visible requirements',
    );
  });

  it("rejects reach() an exit uses through a chain of helpers", () => {
    const rules = { helpers: { a: "x | @b", b: "?@c", c: "y & reach(r)" } };
    expect(failure(twoRegions("@a"), rules)).toBe(
      'Exit "r" -> "s" uses reach(r) through @a -> @b -> @c: reach() is allowed only in location and visible requirements',
    );
  });

  it("rejects it even when a reach-free helper was checked first", () => {
    // @free is checked (and cached) for the first exit; @mixed reuses it.
    const rules = { helpers: { free: "x", mixed: "@free | reach(r)" } };
    const world: World = {
      regions: [
        {
          exits: [
            { req: "@free", to: "s" },
            { req: "@mixed", to: "s" },
          ],
          id: "r",
        },
        { id: "s" },
      ],
      start: "r",
    };
    expect(failure(world, rules)).toBe(
      'Exit "r" -> "s" uses reach(r) through @mixed: reach() is allowed only in location and visible requirements',
    );
  });

  it("accepts a helper with reach() in locations beside a reach-free one in exits", () => {
    const rules = loadRules({
      helpers: { free: "x", mixed: "@free & reach(s)" },
    });
    const compiled = compileWorld(twoRegions("@free", "@mixed"), rules);
    expect(solve(compiled, { x: 1 }).location("l")).toBe("yes");
    expect(solve(compiled, {}).location("l")).toBe("no");
  });

  it.each<[string, World, RulesSource, string]>([
    [
      "a location",
      twoRegions("true", "reach(nowhere)"),
      {},
      'Location "l" uses reach() of unknown region "nowhere"',
    ],
    [
      "a helper, even unused",
      twoRegions("true"),
      { helpers: { far: "reach(nowhere)" } },
      'Helper "@far" uses reach() of unknown region "nowhere"',
    ],
  ])("rejects an unknown region in %s", (_, world, rules, message) => {
    expect(failure(world, rules)).toBe(message);
  });
});

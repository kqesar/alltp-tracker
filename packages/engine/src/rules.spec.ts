import { describe, expect, it } from "vitest";
import { ParseError } from "./parser";
import { countedItems, DefinitionError, loadRules } from "./rules";

function loadError(source: Parameters<typeof loadRules>[0]): DefinitionError {
  try {
    loadRules(source);
  } catch (error) {
    if (error instanceof DefinitionError) return error;
    throw error;
  }
  throw new Error("expected loadRules to throw a DefinitionError");
}

describe("loadRules", () => {
  it("parses helpers and de-duplicates group members", () => {
    const rules = loadRules({
      groups: { crystal: ["crystal1", "crystal2", "crystal1"] },
      helpers: {
        canDarkWorld: "moonpearl & @canLiftRocks",
        canLiftRocks: "glove",
      },
    });
    expect(rules.helpers.get("canLiftRocks")).toEqual({
      min: 1,
      name: "glove",
      type: "item",
    });
    expect(rules.helpers.get("canDarkWorld")?.type).toBe("and");
    expect(rules.groups.get("crystal")).toEqual(["crystal1", "crystal2"]);
  });

  it("accepts helpers that share a dependency (a diamond is not a cycle)", () => {
    const rules = loadRules({
      helpers: { a: "@b & @c", b: "@d", c: "@d | x", d: "y" },
    });
    expect([...rules.helpers.keys()]).toEqual(["a", "b", "c", "d"]);
  });

  it.each([
    [{ a: "@a" }, "@a -> @a"],
    [{ a: "x & @b", b: "@a" }, "@a -> @b -> @a"],
    [{ a: "@b", b: "y | ?@c", c: "z & (w | @a)" }, "@a -> @b -> @c -> @a"],
    // The cycle does not include the helper the search started from.
    [{ a: "@b", b: "@c", c: "@b" }, "@b -> @c -> @b"],
  ])("rejects the helper cycle in %j", (helpers, cycle) => {
    const error = loadError({ helpers });
    expect(error.message).toBe(`Helpers form a cycle: ${cycle}`);
  });

  it("rejects a reference to an unknown helper, naming both", () => {
    const error = loadError({ helpers: { a: "x | @missing" } });
    expect(error.message).toBe('Helper "@a" uses unknown helper "@missing"');
  });

  it("wraps a parse error with the helper's name and keeps it as cause", () => {
    const error = loadError({ helpers: { canSwim: "flippers &" } });
    expect(error.message).toBe(
      'Helper "@canSwim": Expected an item, a "@helper", "?" or "(" but found end of input at position 10',
    );
    expect(error.cause).toBeInstanceOf(ParseError);
    expect((error.cause as ParseError).pos).toBe(10);
  });

  it.each([
    [
      { helpers: { CanSwim: "flippers" } },
      'Helper "@CanSwim" is not a valid name',
    ],
    [{ groups: { Crystal: ["a"] } }, 'Group "Crystal" is not a valid name'],
    [{ groups: { count: ["a"] } }, 'Group "count" is not a valid name'],
    [{ groups: { crystal: [] } }, 'Group "crystal" is empty'],
    [
      { groups: { crystal: ["ok", "Bad"] } },
      'Group "crystal" has an invalid member "Bad"',
    ],
    [
      { groups: { all: ["a", "pendant"], pendant: ["p1"] } },
      'Group "all" contains the group "pendant": groups do not nest',
    ],
    [
      { groups: { crystal: ["c1"] }, helpers: { a: "crystal >= 7" } },
      'Helper "@a" uses the group "crystal" outside count()',
    ],
  ])("rejects %j", (source, message) => {
    expect(loadError(source).message).toBe(message);
  });
});

describe("countedItems", () => {
  it("expands groups and counts each item once", () => {
    const groups = new Map([["crystal", ["c1", "c2", "c3"]]]);
    expect(countedItems(["c2", "crystal", "bow"], groups)).toEqual([
      "c2",
      "c1",
      "c3",
      "bow",
    ]);
  });
});

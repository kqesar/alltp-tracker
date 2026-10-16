import { describe, expect, it } from "vitest";
import type { Expr } from "./ast";
import { evaluate, itemValue, type State } from "./evaluate";
import { parse } from "./parser";
import { DefinitionError, loadRules, type Rules } from "./rules";
import type { Tri } from "./tri";

const rules = loadRules({
  groups: { crystal: ["c1", "c2", "c3", "c4", "c5", "c6", "c7"] },
  helpers: {
    canLiftDarkRocks: "glove >= 2",
    canLiftRocks: "glove",
    canLightTorches: "firerod | lantern",
    darkRoom: "?lantern",
  },
});

const check = (source: string, state: State): Tri =>
  evaluate(parse(source), state, rules);

describe("itemValue", () => {
  it("reads true as 1 and anything but a number as 0", () => {
    const state = { bow: true, glove: 2, hammer: false, junk: undefined };
    expect(itemValue(state, "bow")).toBe(1);
    expect(itemValue(state, "glove")).toBe(2);
    expect(itemValue(state, "hammer")).toBe(0);
    expect(itemValue(state, "junk")).toBe(0);
    expect(itemValue(state, "missing")).toBe(0);
    // Inherited Object.prototype members are not items.
    expect(itemValue(state, "constructor")).toBe(0);
  });
});

describe("evaluate", () => {
  it.each<[string, State, Tri]>([
    ["sword", {}, "no"],
    ["sword", { sword: 1 }, "yes"],
    ["sword", { sword: true }, "yes"],
    ["sword", { sword: false }, "no"],
    ["sword >= 2", { sword: 1 }, "no"],
    ["sword >= 2", { sword: 2 }, "yes"],
    ["sword >= 2", { sword: 4 }, "yes"],
    ["sword >= 2", { sword: true }, "no"],
    ["sword >= 0", {}, "yes"],
    ["true", {}, "yes"],
    ["false", { sword: 4 }, "no"],
    ["maybe", {}, "maybe"],
  ])("%s with %j is %s", (source, state, expected) => {
    expect(check(source, state)).toBe(expected);
  });

  it("softens with ? and maybe() but never lowers", () => {
    expect(check("?lantern", {})).toBe("maybe");
    expect(check("?lantern", { lantern: true })).toBe("yes");
    expect(check("maybe(lantern & firerod)", { lantern: true })).toBe("maybe");
    expect(check("?maybe", {})).toBe("maybe");
    expect(check("glove & ?lantern", {})).toBe("no");
    expect(check("glove & ?lantern", { glove: 1 })).toBe("maybe");
    expect(check("glove & ?lantern", { glove: 1, lantern: true })).toBe("yes");
  });

  it("combines with Kleene and/or", () => {
    expect(check("maybe & true", {})).toBe("maybe");
    expect(check("maybe & false", {})).toBe("no");
    expect(check("maybe | false", {})).toBe("maybe");
    expect(check("maybe | true", {})).toBe("yes");
    expect(check("a | ?b", {})).toBe("maybe");
    expect(check("a | ?b", { a: 1 })).toBe("yes");
  });

  it("counts the sum of item values, groups expanded, each item once", () => {
    const sevenCrystals = "count(crystal) >= 7";
    const six = { c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: true };
    expect(check(sevenCrystals, six)).toBe("no");
    expect(check(sevenCrystals, { ...six, c7: true })).toBe("yes");
    // c1 is in the group: naming it again does not count it twice.
    expect(check("count(crystal, c1) >= 7", six)).toBe("no");
    expect(check("count(bow, sword) >= 3", { bow: true, sword: 2 })).toBe(
      "yes",
    );
    expect(check("count(bow, sword) >= 4", { bow: true, sword: 2 })).toBe("no");
  });

  it("resolves helpers, including helpers using helpers", () => {
    const viaHelpers = loadRules({
      helpers: { a: "@b & @b", b: "@c | x", c: "?lantern" },
    });
    expect(evaluate(parse("@a"), {}, viaHelpers)).toBe("maybe");
    expect(evaluate(parse("@a"), { x: 1 }, viaHelpers)).toBe("yes");
    expect(check("@canLiftDarkRocks", { glove: 1 })).toBe("no");
    expect(check("@canLiftDarkRocks", { glove: 2 })).toBe("yes");
    expect(check("@canLightTorches & @darkRoom", { firerod: true })).toBe(
      "maybe",
    );
  });

  it("evaluates the reference example", () => {
    const source = "moonpearl & (hammer | glove >= 1 & flippers)";
    expect(check(source, { hammer: true })).toBe("no");
    expect(check(source, { hammer: true, moonpearl: true })).toBe("yes");
    expect(check(source, { glove: 1, moonpearl: true })).toBe("no");
    expect(check(source, { flippers: true, glove: 1, moonpearl: true })).toBe(
      "yes",
    );
  });

  it("throws on a helper missing from the rules", () => {
    expect(() => evaluate(parse("@nowhere"), {})).toThrow(DefinitionError);
  });

  it("refuses a hand-built helper cycle instead of overflowing the stack", () => {
    const loop: Expr = { name: "loop", type: "helper" };
    const cyclic: Rules = {
      groups: new Map(),
      helpers: new Map([["loop", loop]]),
    };
    expect(() => evaluate(loop, {}, cyclic)).toThrow(
      'Helper "@loop" uses itself',
    );
  });
});

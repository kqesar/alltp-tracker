import { evaluate, loadRules, parse, type Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { ITEM_IDS } from "./items";
import {
  MEDALLION_FACTS,
  type Medallion,
  medallionFacts,
  type PadKnowledge,
  padsFromUpstream,
} from "./medallions";
import { RULES } from "./rules";
import { UPSTREAM_TEST } from "./settings";

const rules = loadRules(RULES);

function opens(
  rule: "hasMireMedallion" | "hasTurtleRockMedallion",
  known: PadKnowledge,
  held: readonly Medallion[],
): Tri {
  const state = {
    ...Object.fromEntries(held.map((m) => [m, 1])),
    ...medallionFacts(known),
  };
  return evaluate(parse(`@${rule}`), state, rules, { settings: UPSTREAM_TEST });
}

describe("the medallion pads", () => {
  it.each([
    // Known: the medallion it wants, and only that one
    [{ mire: "ether" }, ["ether"], "yes"],
    [{ mire: "ether" }, ["bombos", "quake"], "no"],
    [{ mire: "bombos" }, ["bombos"], "yes"],
    [{ mire: "quake" }, ["quake"], "yes"],
    [{ mire: "quake" }, ["ether"], "no"],
    // Unknown: one medallion might be it, all three surely are
    [{ mire: "unknown" }, ["bombos"], "maybe"],
    [{ mire: "unknown" }, ["ether", "quake"], "maybe"],
    [{ mire: "unknown" }, ["bombos", "ether", "quake"], "yes"],
    [{ mire: "unknown" }, [], "no"],
    // Nothing placed, as upstream's tests leave a pad: closed
    [{}, ["bombos", "ether", "quake"], "no"],
    // The other pad's knowledge does not open this one
    [{ turtleRock: "ether" }, ["ether"], "no"],
  ] as const)(
    "Misery Mire, knowing %o, with %o: %s",
    (known, held, expected) => {
      expect(opens("hasMireMedallion", known, held)).toBe(expected);
    },
  );

  it("read Turtle Rock's own facts the same way", () => {
    expect(
      opens("hasTurtleRockMedallion", { turtleRock: "quake" }, ["quake"]),
    ).toBe("yes");
    expect(
      opens("hasTurtleRockMedallion", { turtleRock: "quake" }, ["ether"]),
    ).toBe("no");
    expect(
      opens("hasTurtleRockMedallion", { turtleRock: "unknown" }, ["ether"]),
    ).toBe("maybe");
    expect(opens("hasTurtleRockMedallion", { mire: "quake" }, ["quake"])).toBe(
      "no",
    );
  });

  it("are facts of their own, apart from the items", () => {
    expect(MEDALLION_FACTS).toEqual([
      "mireIsBombos",
      "mireIsEther",
      "mireIsQuake",
      "mireUnknown",
      "turtleRockIsBombos",
      "turtleRockIsEther",
      "turtleRockIsQuake",
      "turtleRockUnknown",
    ]);
    expect(
      MEDALLION_FACTS.filter((fact) => ITEM_IDS.includes(fact as never)),
    ).toEqual([]);
    expect(medallionFacts({ mire: "ether", turtleRock: "unknown" })).toEqual({
      mireIsEther: 1,
      turtleRockUnknown: 1,
    });
  });
});

describe("padsFromUpstream", () => {
  it("reads the medallions upstream's tests place", () => {
    expect(
      padsFromUpstream({
        "Misery Mire Medallion": "Ether",
        "Turtle Rock Medallion": "Quake",
      }),
    ).toEqual({ mire: "ether", turtleRock: "quake" });
    expect(padsFromUpstream({})).toEqual({});
  });

  it("refuses any other placement, which no state could carry", () => {
    expect(() => padsFromUpstream({ "Link's Uncle": "Ether" })).toThrow(
      /Cannot place Ether at Link's Uncle/,
    );
    expect(() =>
      padsFromUpstream({ "Misery Mire Medallion": "Hammer" }),
    ).toThrow(/Cannot place Hammer at Misery Mire Medallion/);
  });
});

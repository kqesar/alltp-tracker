import {
  compileWorld,
  DefinitionError,
  loadRules,
  type State,
} from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { DERIVED, DERIVED_FACTS, derivedFacts } from "./derived";
import { ITEM_IDS } from "./items";
import { MEDALLION_FACTS } from "./medallions";
import { RULES } from "./rules";
import { settingsFromUpstream, UPSTREAM_TEST } from "./settings";
import { UNKNOWN_COUNT_FACTS } from "./unknown-counts";

const NO_LAMP_RULE = settingsFromUpstream("standard", {
  "item.require.Lamp": 0,
});

const fewer = (items: State, settings = UPSTREAM_TEST) =>
  derivedFacts(items, settings).podFewerKeysSuffice;

describe("podFewerKeysSuffice", () => {
  it("holds while Link lacks the hammer, a bow or the lamp", () => {
    expect(fewer({})).toBe(1);
    expect(fewer({ hammer: 1 })).toBe(1);
    expect(fewer({ bow: 1, hammer: 1 })).toBe(1);
    expect(fewer({ bow: 1, lamp: 1 })).toBe(1);
    expect(fewer({ hammer: 1, lamp: 1 })).toBe(1);
  });

  it("fails once he holds all three, whichever bow", () => {
    expect(fewer({ bow: 1, hammer: 1, lamp: 1 })).toBe(0);
    expect(fewer({ bow: 2, hammer: 1, lamp: 1 })).toBe(0);
    expect(fewer({ bow: 1, hammer: 1, keyD1: 6, lamp: 1, moonPearl: 1 })).toBe(
      0,
    );
  });

  it("asks for no lamp when the customizer drops the lamp rule", () => {
    expect(fewer({ bow: 1, hammer: 1 }, NO_LAMP_RULE)).toBe(0);
    expect(fewer({ bow: 1, hammer: 1 })).toBe(1);
    expect(fewer({ hammer: 1, lamp: 1 }, NO_LAMP_RULE)).toBe(1);
  });
});

describe("derivedFacts", () => {
  it("gives every fact, so spreading it overwrites a stale one", () => {
    const items = { bow: 1, hammer: 1, lamp: 1 };
    expect(Object.keys(derivedFacts({}, UPSTREAM_TEST))).toEqual(DERIVED_FACTS);
    const stale = { ...items, podFewerKeysSuffice: 1 };
    expect({ ...stale, ...derivedFacts(stale, UPSTREAM_TEST) }).toMatchObject({
      podFewerKeysSuffice: 0,
    });
  });

  it("reads only items, helpers and settings the pack has, and no region", () => {
    // Each condition as an exit, which compileWorld checks the names of and
    // refuses reach() in. The medallion facts are there for the pads'
    // helpers, which it checks too; no derived fact is
    const conditions = {
      regions: [
        {
          exits: Object.values(DERIVED).map(({ unless }) => ({
            req: unless,
            to: "after",
          })),
          id: "start",
        },
        { id: "after" },
      ],
      start: "start",
    };
    const check = (items: readonly string[]) =>
      compileWorld(conditions, loadRules(RULES), {
        items,
        settings: UPSTREAM_TEST,
      });
    const known = [...ITEM_IDS, ...MEDALLION_FACTS, ...UNKNOWN_COUNT_FACTS];
    expect(() => check(known)).not.toThrow();
    expect(() => check(known.filter((id) => id !== "hammer"))).toThrow(
      DefinitionError,
    );
    for (const { source } of Object.values(DERIVED)) {
      expect(source).toMatch(/^app\/Region\/.+\.php:\d+$/);
    }
  });

  it("names no item and no medallion fact", () => {
    for (const fact of DERIVED_FACTS) {
      expect(ITEM_IDS).not.toContain(fact);
      expect(MEDALLION_FACTS).not.toContain(fact);
    }
  });
});

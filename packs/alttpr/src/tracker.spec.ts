// toState: what the player records, as the state the rules read.
import { solve } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DUNGEON_IDS, type DungeonId } from "./dungeons";
import { filler } from "./fill";
import { ITEMS } from "./items";
import { solveWithKeys } from "./keys";
import { MEDALLIONS } from "./medallions";
import { compile, STATE_NAMES } from "./pack";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";
import {
  EMPTY_INPUT,
  INVENTORY_ITEM_IDS,
  type InventoryItemId,
  PRIZES,
  type Prize,
  type TrackerInput,
  toState,
} from "./tracker";

const KEYSANITY = settingsFromUpstream("open", { dungeonItems: "full" });
const PRIZE_DUNGEONS = DUNGEON_IDS.filter(
  (d) => !["castle-tower", "ganons-tower", "hyrule-castle"].includes(d),
);

const input = (changes: Partial<TrackerInput>): TrackerInput => ({
  ...EMPTY_INPUT,
  ...changes,
});

describe("toState", () => {
  it("keeps the items the player marks, within their pool", () => {
    const state = toState(
      input({ items: { bow: 1, hammer: 1, sword: 9, tenBombs: -1 } }),
      OPEN,
    );
    expect(state).toMatchObject({ bow: 1, hammer: 1, sword: 4 });
    expect(state).not.toHaveProperty("tenBombs");
    expect(
      toState(input({ items: { sword: Number.NaN } }), OPEN),
    ).not.toHaveProperty("sword");
  });

  it("refuses an item the player does not mark", () => {
    const bad = (items: object) => () =>
      toState(input({ items: items as TrackerInput["items"] }), OPEN);
    expect(bad({ crystal5: 1 })).toThrow(/"crystal5" is not an item/);
    expect(bad({ defeatAgahnim: 1 })).toThrow(RangeError);
    expect(bad({ keyD1: 1 })).toThrow(RangeError);
    expect(bad({ triforce: 1 })).toThrow(RangeError);
  });

  it("rescues Zelda from the start in Open, after the escape in Standard", () => {
    expect(toState(EMPTY_INPUT, OPEN).rescueZelda).toBe(1);
    expect(toState(EMPTY_INPUT, STANDARD)).not.toHaveProperty("rescueZelda");
    const escaped = input({ beaten: { "hyrule-castle": true } });
    expect(toState(escaped, STANDARD).rescueZelda).toBe(1);
  });

  it("defeats Agahnim and Agahnim 2 with their towers", () => {
    const state = toState(
      input({ beaten: { "castle-tower": true, "ganons-tower": true } }),
      OPEN,
    );
    expect(state).toMatchObject({ defeatAgahnim: 1, defeatAgahnim2: 1 });
    expect(toState(EMPTY_INPUT, OPEN)).not.toHaveProperty("defeatAgahnim");
  });

  it("sells the big bomb once the Bomb Merchant is checked", () => {
    const inverted = settingsFromUpstream("inverted", {});
    const bought = input({
      checked: { "bomb-merchant": true, sanctuary: true },
    });
    expect(toState(bought, inverted)).toMatchObject({ bigRedBomb: 1 });
    expect(toState(bought, inverted)).not.toHaveProperty("sanctuary");
    expect(
      toState(input({ checked: { "bomb-merchant": false } }), inverted),
    ).not.toHaveProperty("bigRedBomb");
    expect(toState(EMPTY_INPUT, inverted)).not.toHaveProperty("bigRedBomb");
  });

  it("gives a finished dungeon's known prize, the next of its class", () => {
    const state = toState(
      input({
        beaten: {
          "eastern-palace": true,
          "ice-palace": true,
          "misery-mire": true,
          "palace-of-darkness": true,
          "tower-of-hera": true,
        },
        prizes: {
          "desert-palace": "greenPendant",
          "eastern-palace": "pendant",
          "ice-palace": "redCrystal",
          "misery-mire": "redCrystal",
          "palace-of-darkness": "crystal",
        },
      }),
      OPEN,
    );
    // Desert Palace is not finished, Tower of Hera's prize is not known
    expect(state).not.toHaveProperty("pendantOfCourage");
    expect(state).toMatchObject({
      crystal1: 1,
      crystal5: 1,
      crystal6: 1,
      pendantOfPower: 1,
    });
    expect(state).not.toHaveProperty("pendantOfWisdom");
  });

  it("gives nothing for a prize the pool has no item left for", () => {
    const three = ["ice-palace", "misery-mire", "turtle-rock"] as const;
    const state = toState(
      input({
        beaten: Object.fromEntries(three.map((d) => [d, true])),
        prizes: Object.fromEntries(three.map((d) => [d, "redCrystal"])),
      }),
      OPEN,
    );
    expect(Object.keys(state).filter((k) => k.startsWith("crystal"))).toEqual([
      "crystal5",
      "crystal6",
    ]);
  });

  it("reads an unknown pad as unknown, a known one as known", () => {
    expect(toState(EMPTY_INPUT, OPEN)).toMatchObject({
      mireUnknown: 1,
      turtleRockUnknown: 1,
    });
    const state = toState(input({ medallions: { mire: "ether" } }), OPEN);
    expect(state).toMatchObject({ mireIsEther: 1, turtleRockUnknown: 1 });
    expect(state).not.toHaveProperty("mireUnknown");
  });

  it("derives the facts from the items it gives", () => {
    const armed = { bow: 1, hammer: 1, lamp: 1 } as const;
    expect(toState(input({ items: armed }), OPEN).podFewerKeysSuffice).toBe(0);
    expect(
      toState(input({ items: { ...armed, hammer: 0 } }), OPEN)
        .podFewerKeysSuffice,
    ).toBe(1);
  });

  it("counts the keys found with wild keys only", () => {
    const keys = input({
      keys: { "eastern-palace": 3, "palace-of-darkness": 4, "swamp-palace": 9 },
    });
    expect(toState(keys, KEYSANITY)).toMatchObject({ keyD1: 4, keyD2: 1 });
    // Eastern Palace has no small key to find
    expect(toState(keys, KEYSANITY)).not.toHaveProperty("keyP1");
    expect(toState(keys, OPEN)).not.toHaveProperty("keyD1");
    // Generic keys belong to no dungeon: the key model reads them
    expect(toState(keys, settingsFromUpstream("retro"))).not.toHaveProperty(
      "keyD1",
    );
  });

  it("recomputes everything: learning the pad can close it", () => {
    const items = {
      bombos: 1,
      flute: 2,
      glove: 2,
      hookshot: 1,
      moonPearl: 1,
      sword: 1,
    } as const;
    const world = compile(OPEN);
    const at = (mire?: "bombos" | "ether") =>
      solve(
        world,
        toState(input({ items, medallions: mire ? { mire } : {} }), OPEN),
      ).region("miseryMire");
    expect(at()).toBe("maybe");
    expect(at("bombos")).toBe("yes");
    expect(at("ether")).toBe("no");
    // The same input gives the same state, a new one each time
    const once = toState(input({ items }), OPEN);
    expect(toState(input({ items }), OPEN)).toEqual(once);
    expect(toState(input({ items }), OPEN)).not.toBe(once);
  });

  it("tops up the prizes the dungeons give with those held, regular crystals first", () => {
    const has = (state: Record<string, number>, items: readonly string[]) =>
      items.filter((item) => state[item] === 1);
    const crystals = [...PRIZES.crystal, ...PRIZES.redCrystal];
    // Five crystals counted: five regular ones, no red crystal told
    const five = toState(input({ held: { crystal: 5 } }), OPEN) as Record<
      string,
      number
    >;
    expect(has(five, crystals)).toEqual([...PRIZES.crystal]);
    // Six: one must be red; seven: both are
    const six = toState(input({ held: { crystal: 6 } }), OPEN);
    expect(has(six as Record<string, number>, PRIZES.redCrystal)).toEqual([
      "crystal5",
    ]);
    const seven = toState(input({ held: { crystal: 9 } }), OPEN);
    expect(has(seven as Record<string, number>, crystals)).toHaveLength(7);
    // A red crystal the player named counts toward the crystals held
    const named = toState(
      input({
        beaten: { "palace-of-darkness": true },
        held: { crystal: 2, greenPendant: 1, pendant: 1 },
        prizes: { "palace-of-darkness": "redCrystal" },
      }),
      OPEN,
    ) as Record<string, number>;
    expect(has(named, crystals)).toEqual(["crystal1", "crystal5"]);
    expect(has(named, [...PRIZES.greenPendant, ...PRIZES.pendant])).toEqual([
      "pendantOfCourage",
      "pendantOfPower",
    ]);
    // None held, or a count the dungeons already give: nothing more
    expect(toState(input({ held: {} }), OPEN)).toEqual(
      toState(input({}), OPEN),
    );
  });

  it("feeds the key model: a run's state, read without its keys", () => {
    const run = input({
      beaten: { "eastern-palace": true },
      items: { bookOfMudora: 1, glove: 1, lamp: 1, pegasusBoots: 1, sword: 1 },
      prizes: { "eastern-palace": "greenPendant" },
    });
    const keyed = solveWithKeys(
      filler(compile(OPEN), OPEN),
      toState(run, OPEN),
    );
    expect(keyed.location("sahasrahla")).toBe("yes");
    expect(keyed.location("desert-palace/big-key-chest")).toBe("yes");
  });
});

/** Any input, its values in and out of range. */
const anyInput = fc.record({
  beaten: fc.dictionary(fc.constantFrom(...DUNGEON_IDS), fc.boolean()),
  items: fc.dictionary(
    fc.constantFrom(...INVENTORY_ITEM_IDS),
    fc.integer({ max: 30, min: -2 }),
  ),
  keys: fc.dictionary(
    fc.constantFrom(...DUNGEON_IDS),
    fc.integer({ max: 9, min: -1 }),
  ),
  medallions: fc.record(
    {
      mire: fc.constantFrom(...MEDALLIONS, "unknown" as const),
      turtleRock: fc.constantFrom(...MEDALLIONS, "unknown" as const),
    },
    { requiredKeys: [] },
  ),
  prizes: fc.dictionary(
    fc.constantFrom(...PRIZE_DUNGEONS),
    fc.constantFrom(...(Object.keys(PRIZES) as Prize[])),
  ),
}) as fc.Arbitrary<TrackerInput>;

describe("toState over any input", () => {
  it("gives only names the rules may read, each within its range", () => {
    const names = new Set(STATE_NAMES);
    const max = new Map<string, number>(ITEMS.map((i) => [i.id, i.max]));
    for (const settings of [OPEN, STANDARD, KEYSANITY]) {
      fc.assert(
        fc.property(anyInput, (any) => {
          const state = toState(any, settings);
          return Object.entries(state).every(
            ([name, value]) =>
              names.has(name) &&
              typeof value === "number" &&
              value >= 0 &&
              value <= (max.get(name) ?? 1),
          );
        }),
        { numRuns: 200, seed: 5 },
      );
    }
  });

  it("lists the items the player marks: no prize, event or small key", () => {
    const marked = new Set<string>(INVENTORY_ITEM_IDS);
    for (const items of Object.values(PRIZES)) {
      for (const item of items) expect(marked.has(item), item).toBe(false);
    }
    for (const id of [
      "rescueZelda",
      "defeatAgahnim",
      "defeatAgahnim2",
      "bigRedBomb",
    ]) {
      expect(marked.has(id), id).toBe(false);
    }
    expect([...marked].filter((id) => id.startsWith("key"))).toEqual([]);
    expect(marked.has("bigKeyD1" satisfies InventoryItemId)).toBe(true);
    // Every prize item belongs to one class, and the classes cover the ten
    // dungeons' prizes: three pendants, seven crystals
    expect(Object.values(PRIZES).flat().sort()).toEqual(
      ITEMS.map((i) => i.id)
        .filter((id) => /^(crystal\d|pendantOf)/.test(id))
        .sort(),
    );
    expect(PRIZE_DUNGEONS satisfies DungeonId[]).toHaveLength(10);
  });
});

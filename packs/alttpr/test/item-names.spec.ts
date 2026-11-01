import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  codeKey,
  drCodes,
  erCodes,
  joinDr,
  joinOnCode,
  vtCodes,
} from "../scripts/import-item-names.mjs";
import { UPSTREAM_ITEMS } from "../src/items";
import DR_ITEMS from "../src/spoiler/dr-items.json";
import ER_ITEMS from "../src/spoiler/er-items.json";
import ITEM_NAMES from "../src/spoiler/item-names.json";
import { loadItemTable } from "./fixtures";
import { loadManifest } from "./manifest";

const manifest = loadManifest();

describe("item-names.json", () => {
  it("is vt's English table, as the other fixture reads it", () => {
    const fixture = loadItemTable();
    expect(ITEM_NAMES.names).toEqual(fixture.english);
    expect(ITEM_NAMES.upstream).toEqual({
      commit: manifest.commit,
      repo: manifest.repo,
    });
  });

  it("names classes the pack knows, and a label for the common ones", () => {
    for (const itemClass of Object.keys(ITEM_NAMES.names)) {
      expect(UPSTREAM_ITEMS.has(itemClass), itemClass).toBe(true);
    }
    expect(ITEM_NAMES.names.ProgressiveSword).toBe("Progressive Sword");
    expect(ITEM_NAMES.names.Hookshot).toBe("Hookshot");
  });
});

describe("er-items.json", () => {
  const items = ER_ITEMS.items as Record<string, string | null>;

  it("is pinned to the commits of both programs", () => {
    expect(ER_ITEMS.upstream.vt).toEqual({
      commit: manifest.commit,
      repo: manifest.repo,
    });
    expect(ER_ITEMS.upstream.er).toEqual({
      commit: manifest.entranceRandomizer.commit,
      repo: manifest.entranceRandomizer.repo,
    });
  });

  it("maps each item to a class of the pack, or to none for an event", () => {
    for (const [name, itemClass] of Object.entries(items)) {
      if (itemClass !== null) {
        expect(UPSTREAM_ITEMS.has(itemClass), `${name} -> ${itemClass}`).toBe(
          true,
        );
      }
    }
    expect(
      Object.entries(items)
        .filter(([, itemClass]) => itemClass === null)
        .map(([name]) => name)
        .sort(),
    ).toEqual([
      "Beat Agahnim 1",
      "Beat Agahnim 2",
      "Get Frog",
      "Open Floodgate",
      "Pick Up Purple Chest",
      "Return Smith",
    ]);
  });

  it("gives no two items the same class", () => {
    const classes = Object.values(items).filter((c) => c !== null);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("joins the names that differ between the two programs", () => {
    expect(items).toMatchObject({
      "Blue Boomerang": "Boomerang",
      "Bottle (Good Bee)": "BottleWithGoldBee",
      "Fighter Sword": "L1Sword",
      "Green Pendant": "PendantOfCourage",
      "Magic Powder": "Powder",
      Ocarina: "OcarinaInactive",
      "Red Pendant": "PendantOfPower",
      "Sanctuary Heart Container": "HeartContainer",
      "Small Key (Palace of Darkness)": "KeyD1",
      "Small Key (Universal)": "KeyGK",
      "Titans Mitts": "TitansMitt",
    });
  });
});

describe("dr-items.json", () => {
  const items = DR_ITEMS.items as Record<string, string | null>;

  it("is pinned to the Door Randomizer's release and vt's commit", () => {
    expect(DR_ITEMS.upstream).toEqual({
      dr: {
        commit: manifest.doorRandomizer.commit,
        repo: manifest.doorRandomizer.repo,
      },
      vt: { commit: manifest.commit, repo: manifest.repo },
    });
    expect(manifest.doorRandomizer.spoilerItems).toBe(
      "src/spoiler/dr-items.json",
    );
  });

  it("maps each item to a class of the pack, none for an event", () => {
    for (const [name, itemClass] of Object.entries(items)) {
      if (itemClass !== null) {
        expect(UPSTREAM_ITEMS.has(itemClass), `${name} -> ${itemClass}`).toBe(
          true,
        );
      }
    }
    expect(items).toMatchObject({
      "Beat Agahnim 1": null,
      "Crystal 5": "Crystal5",
      "Green Pendant": "PendantOfCourage",
      Nothing: "Nothing",
      "Progressive Bow (Alt)": "ProgressiveBowAlternate",
      "Small Key (Agahnims Tower)": "KeyA1",
      "Small Key (Universal)": "KeyGK",
      "Trench 1 Filled": null,
    });
  });

  it("keeps apart DR's pickups vt has no item for, and Arrows (5), which shares Nothing's code", () => {
    expect(DR_ITEMS.unmatched).toEqual([
      "Arrows (5)",
      "Bee Trap",
      "Big Magic",
      "Chicken",
      "Fairy",
    ]);
    for (const name of DR_ITEMS.unmatched) {
      expect(Object.hasOwn(items, name), name).toBe(false);
    }
  });
});

describe("the importer", () => {
  it("keys a code by its number, or a prize by its bytes but the last", () => {
    expect(codeKey(0x0a)).toBe("10");
    expect(codeKey([0x0a])).toBe("10");
    expect(codeKey([0x02, 0x34, 0x60, 0x00, 0x69, 0x38])).toBe("2,52,96,0,105");
    // vt's leading item code or null, and its own last byte, are left out
    expect(codeKey([0x39, 0x02, 0x34, 0x60, 0x00, 0x69, 0x39])).toBe(
      "2,52,96,0,105",
    );
    expect(codeKey([null, 0x02, 0x34, 0x64, 0x40, 0x7f, 0x20])).toBe(
      "2,52,100,64,127",
    );
    expect(codeKey([])).toBeUndefined();
    expect(codeKey("x")).toBeUndefined();
    expect(codeKey(["a"])).toBeUndefined();
  });

  it("reads each class's code from app/Item.php, events and medallions too", () => {
    const codes = vtCodes(
      `<?php
      new Item('Hammer', [0x09], $world),
      new Item\\Sword('L1Sword', [0x49], $world),
      new Item\\Medallion('Ether', [0x10, 0x01, 't0' => 0x31, 'm0' => 0x13], $world),
      new Item\\Pendant('PendantOfPower', [0x39, 0x02, 0x34, 0x60, 0x00, 0x69, 0x39], $world),
      new Item\\Event('RescueZelda', [null], $world),
      new ItemAlias('UncleSword', 'ProgressiveSword', $world),`,
    );
    expect([...codes]).toEqual([
      ["Hammer", "9"],
      ["L1Sword", "73"],
      ["Ether", "16"],
      ["PendantOfPower", "2,52,96,0,105"],
    ]);
  });

  it("reads the entrance randomizer's item table, an event having no code", () => {
    const codes = erCodes(
      `item_table = {'Hammer': (True, False, None, 0x09, 'x', None, None, None, None, None, 'y'),
      'Red Pendant': (True, False, 'Crystal', [0x02, 0x34, 0x60, 0x00, 0x69, 0x38], None, None, None, None, None, None, None),
      'Beat Agahnim 1': (True, False, 'Event', None, None, None, None, None, None, None, None),
      }`,
    );
    expect([...codes]).toEqual([
      ["Hammer", "9"],
      ["Red Pendant", "2,52,96,0,105"],
      ["Beat Agahnim 1", null],
    ]);
    expect(() => erCodes("item_table = [1]")).toThrow(/not a dict/);
  });

  it("joins on the code, and stops at one it cannot place", () => {
    const vt = new Map([
      ["Hammer", "9"],
      ["Same", "5"],
      ["Alike", "5"],
    ]);
    expect(
      joinOnCode(
        vt,
        new Map([
          ["Hammer (er)", "9"],
          ["Beat", null],
        ]),
      ),
    ).toEqual({ Beat: null, "Hammer (er)": "Hammer" });
    expect(() => joinOnCode(vt, new Map([["Lost", "7"]]))).toThrow(
      /"Lost" \(code 7\) matches no vt item/,
    );
    expect(() => joinOnCode(vt, new Map([["Twin", "5"]]))).toThrow(
      /matches Same, Alike/,
    );
  });

  it("reads DR's item table: a price after the code, a dungeon byte after a prize's", () => {
    const codes = drCodes(
      `item_table = {'Hammer': (True, False, None, 0x09, 250, 'x', None, None, None, None, None, 'y'),
      'Green Pendant': (True, False, 'Crystal', [0x04, 0x38, 0x62, 0x00, 0x69, 0x37, 0x08], 999, None, None, None, None, None, None, None),
      'Beat Agahnim 1': (True, False, 'Event', 999, None, None, None, None, None, None, None, None),
      }`,
    );
    expect([...codes]).toEqual([
      ["Hammer", "9"],
      ["Green Pendant", "4,56,98,0,105"],
      ["Beat Agahnim 1", null],
    ]);
    expect(() => drCodes("item_table = [1]")).toThrow(/not a dict/);
  });

  it("joins DR's names on the code, the rest apart, and stops at two classes", () => {
    const vt = new Map([
      ["Hammer", "9"],
      ["Nothing", "90"],
      ["Same", "5"],
      ["Alike", "5"],
    ]);
    const english = { Hammer: "Hammer", Nothing: "Nothing" };
    expect(
      joinDr(
        vt,
        english,
        new Map<string, string | null>([
          ["Hammer", "9"],
          ["Nothing", "90"],
          ["Arrows (5)", "90"],
          ["Fairy", "210"],
          ["Beat", null],
        ]),
      ),
    ).toEqual({
      items: { Beat: null, Hammer: "Hammer", Nothing: "Nothing" },
      unmatched: ["Arrows (5)", "Fairy"],
    });
    expect(() => joinDr(vt, english, new Map([["Twin", "5"]]))).toThrow(
      /matches Same, Alike/,
    );
  });

  it("is read from the files its output states", () => {
    // The generated files carry the files they were read from
    expect(ITEM_NAMES.files).toEqual([
      "app/Item.php",
      "resources/lang/en/item.php",
    ]);
    expect(
      JSON.parse(
        readFileSync(
          new URL("../src/spoiler/er-items.json", import.meta.url),
          "utf8",
        ),
      ).generated,
    ).toContain("import-item-names.mjs");
  });
});

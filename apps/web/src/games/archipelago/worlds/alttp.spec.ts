import { describe, expect, it } from "vitest";
import { alttpNames } from "@/games/archipelago/fixtures";
import { ALTTP_SKIN } from "@/games/archipelago/worlds/alttp";
import {
  countsOf,
  type ItemCell,
  mappedNames,
  rowsOf,
} from "@/games/archipelago/worlds/skin";
import { skinFor } from "@/games/archipelago/worlds/skins";

/**
 * A Link to the Past's progression items that AP's name data names: the
 * `item_table` entries classed `progression` or `progression_skip_balancing`
 * with an item code, read from AP 0.6.8's worlds/alttp/Items.py (commit
 * 54803be0, packages/archipelago/upstream.json), 83 names.
 */
const PROGRESSION = [
  "Activated Flute",
  "Arrow Upgrade (+10)",
  "Arrow Upgrade (+5)",
  "Arrow Upgrade (70)",
  "Big Key (Agahnims Tower)",
  "Big Key (Desert Palace)",
  "Big Key (Eastern Palace)",
  "Big Key (Ganons Tower)",
  "Big Key (Hyrule Castle)",
  "Big Key (Ice Palace)",
  "Big Key (Misery Mire)",
  "Big Key (Palace of Darkness)",
  "Big Key (Skull Woods)",
  "Big Key (Swamp Palace)",
  "Big Key (Thieves Town)",
  "Big Key (Tower of Hera)",
  "Big Key (Turtle Rock)",
  "Blue Boomerang",
  "Bomb Upgrade (+10)",
  "Bomb Upgrade (+5)",
  "Bomb Upgrade (50)",
  "Bombos",
  "Book of Mudora",
  "Bottle",
  "Bottle (Bee)",
  "Bottle (Blue Potion)",
  "Bottle (Fairy)",
  "Bottle (Good Bee)",
  "Bottle (Green Potion)",
  "Bottle (Red Potion)",
  "Bow",
  "Bug Catching Net",
  "Cane of Byrna",
  "Cane of Somaria",
  "Cape",
  "Ether",
  "Fighter Sword",
  "Fire Rod",
  "Flippers",
  "Flute",
  "Golden Sword",
  "Hammer",
  "Hookshot",
  "Ice Rod",
  "Lamp",
  "Magic Mirror",
  "Magic Powder",
  "Magic Upgrade (1/2)",
  "Magic Upgrade (1/4)",
  "Master Sword",
  "Mirror Shield",
  "Moon Pearl",
  "Mushroom",
  "Pegasus Boots",
  "Power Glove",
  "Power Star",
  "Progressive Bow",
  "Progressive Bow (Alt)",
  "Progressive Glove",
  "Progressive Shield",
  "Progressive Sword",
  "Quake",
  "Red Boomerang",
  "Shovel",
  "Silver Arrows",
  "Silver Bow",
  "Small Key (Agahnims Tower)",
  "Small Key (Desert Palace)",
  "Small Key (Eastern Palace)",
  "Small Key (Ganons Tower)",
  "Small Key (Hyrule Castle)",
  "Small Key (Ice Palace)",
  "Small Key (Misery Mire)",
  "Small Key (Palace of Darkness)",
  "Small Key (Skull Woods)",
  "Small Key (Swamp Palace)",
  "Small Key (Thieves Town)",
  "Small Key (Tower of Hera)",
  "Small Key (Turtle Rock)",
  "Tempered Sword",
  "Titans Mitts",
  "Triforce",
  "Triforce Piece",
];

const names = alttpNames();
const mapped = mappedNames(ALTTP_SKIN);

/** An item cell of the skin, by id. */
const cell = (id: string) =>
  ALTTP_SKIN.cells.find((c): c is ItemCell => c.id === id && c.kind === "item");

/** A cell's level and words, holding these items. */
const levelOf = (id: string, held: Record<string, number>) => {
  const found = cell(id);
  if (found === undefined) throw new Error(`No cell ${id}`);
  const level = found.level(
    countsOf(
      Object.entries(held).map(([name, count]) => ({ count, flags: 1, name })),
    ),
  );
  return [level, found.describe(level), found.sprite(level)];
};

describe("the A Link to the Past skin, against AP 0.6.8's name data", () => {
  it("maps only names the pinned data has", () => {
    expect(names.checksum).toBe("1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4");
    const unknown = [...mapped].filter((name) => !names.itemIds.has(name));
    expect(unknown).toEqual([]);
    for (const name of [...Object.keys(ALTTP_SKIN.excluded)]) {
      expect(names.itemIds.has(name)).toBe(true);
    }
  });

  it("gives every progression item a cell or an explicit exclusion", () => {
    expect(PROGRESSION.every((name) => names.itemIds.has(name))).toBe(true);
    const left = PROGRESSION.filter(
      (name) => !mapped.has(name) && !(name in ALTTP_SKIN.excluded),
    );
    expect(left).toEqual([]);
    // No exclusion hides an item a cell counts
    expect(
      Object.keys(ALTTP_SKIN.excluded).filter((n) => mapped.has(n)),
    ).toEqual([]);
  });

  it("lays seven columns: the items, then the keys of thirteen dungeons", () => {
    const rows = rowsOf(ALTTP_SKIN);
    expect(rows.every((row) => row.length === 7)).toBe(true);
    expect(rows).toHaveLength(7);
    expect(ALTTP_SKIN.cells.filter((c) => c.kind === "keys")).toHaveLength(13);
    expect(skinFor("A Link to the Past")).toBe(ALTTP_SKIN);
    expect(skinFor("Clique")).toBeNull();
    expect(skinFor(undefined)).toBeNull();
  });
});

describe("a cell's level", () => {
  it("counts a progressive item, or the level a fixed one gives", () => {
    expect(levelOf("sword", {})).toEqual([0, "not received", "sword1.png"]);
    expect(levelOf("sword", { "Progressive Sword": 2 })).toEqual([
      2,
      "Master Sword",
      "sword2.png",
    ]);
    expect(
      levelOf("sword", { "Golden Sword": 1, "Progressive Sword": 1 }),
    ).toEqual([4, "Golden Sword", "sword4.png"]);
    expect(levelOf("sword", { "Progressive Sword": 9 })[0]).toBe(4);
    expect(levelOf("mail", {})).toEqual([0, "Green Mail", "tunic1.png"]);
    expect(levelOf("mail", { "Progressive Mail": 2 })[2]).toBe("tunic3.png");
  });

  it("adds a bow's and boomerang's bits", () => {
    expect(levelOf("bow", {})).toEqual([0, "not received", "bow2.png"]);
    expect(levelOf("bow", { "Progressive Bow": 1 })).toEqual([
      2,
      "Bow",
      "bow2.png",
    ]);
    expect(levelOf("bow", { "Progressive Bow (Alt)": 2 })[1]).toBe(
      "Bow and Silver Arrows",
    );
    expect(levelOf("bow", { "Silver Arrows": 1 })).toEqual([
      1,
      "Silver Arrows only",
      "bow1.png",
    ]);
    expect(levelOf("bow", { "Progressive Bow": 5 })[0]).toBe(0);
    expect(levelOf("boomerang", { "Red Boomerang": 1 })[2]).toBe(
      "boomerang2.png",
    );
    expect(levelOf("boomerang", {})[2]).toBe("boomerang1.png");
  });

  it("counts bottles of any content up to four, and toggles the rest", () => {
    expect(levelOf("bottle", { Bottle: 1, "Bottle (Fairy)": 4 })).toEqual([
      4,
      "4 received",
      "bottle4.png",
    ]);
    expect(levelOf("bottle", {})).toEqual([0, "not received", "bottle1.png"]);
    expect(levelOf("flute", { "Activated Flute": 1 })).toEqual([
      1,
      "received",
      "flute.png",
    ]);
  });
});

// A Link to the Past as Archipelago names its items: a grid drawn with the
// tracker's ALttPR sprites, built for AP's item set (its progressive items,
// counts and keys per dungeon), not for alttpr.com's. Only art is shared with
// packs/alttpr: what a cell holds is AP's names, counted as the server sent
// them. Read from AP 0.6.8's worlds/alttp/Items.py (commit 54803be0,
// packages/archipelago/upstream.json): `item_table` and
// `progression_mapping`; held to the pinned name data by alttp.spec.ts.

import type { ItemCell, Skin, SkinCell } from "@/games/archipelago/worlds/skin";

/** The progressive items' levels (Items.py, `progression_mapping`). */
const swordLevels = {
  "Fighter Sword": 1,
  "Golden Sword": 4,
  "Master Sword": 2,
  "Tempered Sword": 3,
};

/** A cell whose level is its progressive item's count, or a fixed level's. */
const progressive = (
  id: string,
  name: string,
  progressives: readonly string[],
  fixed: Readonly<Record<string, number>>,
  levels: readonly string[],
  sprite: (level: number) => string,
): ItemCell => ({
  describe: (level) => (level === 0 ? "not received" : levels[level - 1]),
  id,
  kind: "item",
  level: (count) =>
    Math.min(
      levels.length,
      Math.max(
        progressives.reduce((sum, item) => sum + count(item), 0),
        ...Object.entries(fixed).map(([item, level]) =>
          count(item) > 0 ? level : 0,
        ),
      ),
    ),
  name,
  names: [...progressives, ...Object.keys(fixed)],
  sprite,
});

/** A cell held once any of its items is. */
const toggle = (
  id: string,
  name: string,
  file: string,
  names: readonly string[] = [name],
): ItemCell => ({
  describe: (level) => (level === 0 ? "not received" : "received"),
  id,
  kind: "item",
  level: (count) => (names.some((item) => count(item) > 0) ? 1 : 0),
  name,
  names,
  sprite: () => file,
});

/** A cell whose level is a set of bits, one per item (the bow, the boomerangs). */
const bits = (
  id: string,
  name: string,
  items: Readonly<Record<string, number>>,
  progressives: readonly string[],
  progressiveBits: readonly number[],
  words: Readonly<Record<number, string>>,
  sprite: (level: number) => string,
): ItemCell => ({
  describe: (level) => words[level] ?? "not received",
  id,
  kind: "item",
  level: (count) => {
    const steps = progressives.reduce((sum, item) => sum + count(item), 0);
    let level = steps > 0 ? (progressiveBits[steps - 1] ?? 0) : 0;
    for (const [item, bit] of Object.entries(items)) {
      if (count(item) > 0) level |= bit;
    }
    return level;
  },
  name,
  names: [...progressives, ...Object.keys(items)],
  sprite,
});

/** A cell that counts its items (the bottles). */
const counted = (
  id: string,
  name: string,
  names: readonly string[],
  max: number,
  sprite: (level: number) => string,
): ItemCell => ({
  describe: (level) => (level === 0 ? "not received" : `${level} received`),
  id,
  kind: "item",
  level: (count) =>
    Math.min(
      max,
      names.reduce((sum, item) => sum + count(item), 0),
    ),
  leveled: true,
  name,
  names,
  sprite,
});

const SILVERS = 1;
const BOW = 2;

/** The grid's item cells, seven a row, as ALttPR's board orders them. */
const ITEM_CELLS: readonly ItemCell[] = [
  progressive(
    "sword",
    "Sword",
    ["Progressive Sword"],
    swordLevels,
    ["Fighter Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
    (level) => `sword${Math.max(level, 1)}.png`,
  ),
  progressive(
    "shield",
    "Shield",
    ["Progressive Shield"],
    { "Blue Shield": 1, "Mirror Shield": 3, "Red Shield": 2 },
    ["Blue Shield", "Red Shield", "Mirror Shield"],
    (level) => `shield${Math.max(level, 1)}.png`,
  ),
  {
    ...progressive(
      "mail",
      "Mail",
      ["Progressive Mail"],
      { "Blue Mail": 1, "Red Mail": 2 },
      ["Blue Mail", "Red Mail"],
      (level) => `tunic${level + 1}.png`,
    ),
    always: true,
    // Link starts in his green mail: nothing to grey
    describe: (level) => ["Green Mail", "Blue Mail", "Red Mail"][level],
  },
  progressive(
    "glove",
    "Glove",
    ["Progressive Glove"],
    { "Power Glove": 1, "Titans Mitts": 2 },
    ["Power Glove", "Titan's Mitts"],
    (level) => `glove${Math.max(level, 1)}.png`,
  ),
  bits(
    "bow",
    "Bow",
    { Bow: BOW, "Silver Arrows": SILVERS, "Silver Bow": BOW | SILVERS },
    ["Progressive Bow", "Progressive Bow (Alt)"],
    [BOW, BOW | SILVERS],
    {
      [SILVERS]: "Silver Arrows only",
      [BOW]: "Bow",
      [BOW | SILVERS]: "Bow and Silver Arrows",
    },
    (level) => `bow${level === 0 ? BOW : level}.png`,
  ),
  bits(
    "boomerang",
    "Boomerang",
    { "Blue Boomerang": 1, "Red Boomerang": 2 },
    [],
    [],
    { 1: "Blue Boomerang", 2: "Red Boomerang", 3: "both Boomerangs" },
    (level) => `boomerang${level === 0 ? 1 : level}.png`,
  ),
  toggle("hookshot", "Hookshot", "hookshot.png"),
  toggle("mushroom", "Mushroom", "mushroom.png"),
  toggle("powder", "Magic Powder", "powder.png"),
  toggle("firerod", "Fire Rod", "firerod.png"),
  toggle("icerod", "Ice Rod", "icerod.png"),
  toggle("bombos", "Bombos", "bombos.png"),
  toggle("ether", "Ether", "ether.png"),
  toggle("quake", "Quake", "quake.png"),
  toggle("lamp", "Lamp", "lantern.png"),
  toggle("hammer", "Hammer", "hammer.png"),
  toggle("shovel", "Shovel", "shovel.png"),
  toggle("flute", "Flute", "flute.png", ["Flute", "Activated Flute"]),
  toggle("net", "Bug Catching Net", "net.png"),
  toggle("book", "Book of Mudora", "book.png"),
  counted(
    "bottle",
    "Bottle",
    [
      "Bottle",
      "Bottle (Red Potion)",
      "Bottle (Green Potion)",
      "Bottle (Blue Potion)",
      "Bottle (Fairy)",
      "Bottle (Bee)",
      "Bottle (Good Bee)",
    ],
    4,
    (level) => `bottle${Math.max(level, 1)}.png`,
  ),
  toggle("somaria", "Cane of Somaria", "somaria.png"),
  toggle("byrna", "Cane of Byrna", "byrna.png"),
  toggle("cape", "Cape", "cape.png"),
  toggle("mirror", "Magic Mirror", "mirror.png"),
  toggle("boots", "Pegasus Boots", "boots.png"),
  toggle("flippers", "Flippers", "flippers.png"),
  toggle("moonpearl", "Moon Pearl", "moonpearl.png"),
  toggle("magic", "Magic Upgrade", "magic.png", [
    "Magic Upgrade (1/2)",
    "Magic Upgrade (1/4)",
  ]),
];

/** Each dungeon as AP names its keys, in ALttPR's grid order, the castles last. */
const DUNGEONS: readonly (readonly [string, string, string])[] = [
  ["Eastern Palace", "Eastern Palace", "EP"],
  ["Desert Palace", "Desert Palace", "DP"],
  ["Tower of Hera", "Tower of Hera", "TH"],
  ["Palace of Darkness", "Palace of Darkness", "PD"],
  ["Swamp Palace", "Swamp Palace", "SP"],
  ["Skull Woods", "Skull Woods", "SW"],
  ["Thieves Town", "Thieves' Town", "TT"],
  ["Ice Palace", "Ice Palace", "IP"],
  ["Misery Mire", "Misery Mire", "MM"],
  ["Turtle Rock", "Turtle Rock", "TR"],
  ["Hyrule Castle", "Hyrule Castle", "HC"],
  ["Agahnims Tower", "Castle Tower", "CT"],
  ["Ganons Tower", "Ganon's Tower", "GT"],
];

const KEY_CELLS: readonly SkinCell[] = DUNGEONS.map(([ap, name, short]) => ({
  big: `Big Key (${ap})`,
  dungeon: name,
  id: `keys-${short.toLowerCase()}`,
  kind: "keys",
  short,
  small: `Small Key (${ap})`,
}));

/**
 * Progression items the grid leaves to "More items", each with why: the
 * goal's pieces and the capacity upgrades, which a count says better than a
 * cell, and the retro mode's generic key.
 */
const EXCLUDED: Readonly<Record<string, string>> = {
  "Arrow Upgrade (+5)": "a capacity upgrade",
  "Arrow Upgrade (+10)": "a capacity upgrade",
  "Arrow Upgrade (70)": "a capacity upgrade",
  "Bomb Upgrade (+5)": "a capacity upgrade",
  "Bomb Upgrade (+10)": "a capacity upgrade",
  "Bomb Upgrade (50)": "a capacity upgrade",
  "Power Star": "a goal piece, counted",
  Triforce: "the goal itself",
  "Triforce Piece": "a goal piece, counted",
};

export const ALTTP_SKIN: Skin = {
  cells: [...ITEM_CELLS, ...KEY_CELLS],
  columns: 7,
  excluded: EXCLUDED,
  game: "A Link to the Past",
};

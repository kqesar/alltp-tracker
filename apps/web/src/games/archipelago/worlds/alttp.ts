// A Link to the Past as Archipelago names its items: a grid drawn with the
// tracker's ALttPR sprites, built for AP's item set (its progressive items,
// counts and keys per dungeon), not for alttpr.com's. Only art is shared with
// packs/alttpr: what a cell holds is AP's names, counted as the server sent
// them. Read from AP 0.6.8's worlds/alttp/Items.py (commit 54803be0,
// packages/archipelago/upstream.json): `item_table` and
// `progression_mapping`; held to the pinned name data by alttp.spec.ts.

import {
  BOW,
  BOW_WORDS,
  bits,
  bowSprite,
  counted,
  DUNGEON_SHORTS,
  fromOne,
  progressive,
  SILVERS,
  toggle,
  ZELDA_LAYOUT,
} from "@/games/archipelago/worlds/cells";
import type { ItemCell, Skin, SkinCell } from "@/games/archipelago/worlds/skin";

/** The grid's item cells; ZELDA_LAYOUT places them. */
const ITEM_CELLS: readonly ItemCell[] = [
  progressive(
    "sword",
    "Sword",
    ["Progressive Sword"],
    {
      "Fighter Sword": 1,
      "Golden Sword": 4,
      "Master Sword": 2,
      "Tempered Sword": 3,
    },
    ["Fighter Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
    fromOne("sword"),
  ),
  progressive(
    "shield",
    "Shield",
    ["Progressive Shield"],
    { "Blue Shield": 1, "Mirror Shield": 3, "Red Shield": 2 },
    ["Blue Shield", "Red Shield", "Mirror Shield"],
    fromOne("shield"),
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
    fromOne("glove"),
  ),
  bits(
    "bow",
    "Bow",
    { Bow: BOW, "Silver Arrows": SILVERS, "Silver Bow": BOW | SILVERS },
    ["Progressive Bow", "Progressive Bow (Alt)"],
    [BOW, BOW | SILVERS],
    BOW_WORDS,
    bowSprite,
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
    fromOne("bottle"),
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

/** Each dungeon as AP names its keys, in DUNGEON_SHORTS' order. */
const DUNGEONS: readonly (readonly [string, string])[] = [
  ["Eastern Palace", "Eastern Palace"],
  ["Desert Palace", "Desert Palace"],
  ["Tower of Hera", "Tower of Hera"],
  ["Palace of Darkness", "Palace of Darkness"],
  ["Swamp Palace", "Swamp Palace"],
  ["Skull Woods", "Skull Woods"],
  ["Thieves Town", "Thieves' Town"],
  ["Ice Palace", "Ice Palace"],
  ["Misery Mire", "Misery Mire"],
  ["Turtle Rock", "Turtle Rock"],
  ["Hyrule Castle", "Hyrule Castle"],
  ["Agahnims Tower", "Castle Tower"],
  ["Ganons Tower", "Ganon's Tower"],
];

const KEY_CELLS: readonly SkinCell[] = DUNGEONS.map(([ap, name], index) => {
  const short = DUNGEON_SHORTS[index] ?? "";
  return {
    big: `Big Key (${ap})`,
    dungeon: name,
    id: `keys-${short.toLowerCase()}`,
    kind: "keys",
    short,
    small: `Small Key (${ap})`,
  };
});

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
  layout: ZELDA_LAYOUT,
};

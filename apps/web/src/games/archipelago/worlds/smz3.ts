// SMZ3 as Archipelago names its items: AP's world is TotalSMZ3's lineage,
// its names the C# enum's (`Firerod`, `ProgressiveSword`, `CardNorfairL1`),
// drawn with the tracker's art for both games (ALttPR's assets, the frames of
// Map Rando's Super Metroid sheet). Only art is shared with packs/smz3. Read
// from AP 0.6.8's worlds/smz3 (commit 54803be0,
// packages/archipelago/upstream.json): `ItemType` in TotalSMZ3/Item.py and
// the pools of `create_items` in __init__.py; held to the pinned name data by
// smz3.spec.ts.
//
// The location groups are TotalSMZ3's regions (each region's `Name` in
// TotalSMZ3/Regions/, in World.py's order), the world naming none of its own.

import {
  BOW,
  BOW_WORDS,
  bits,
  bowSprite,
  counted,
  counter,
  DUNGEON_SHORTS,
  fromOne,
  progressive,
  SILVERS,
  SM_LAYOUT,
  toggle,
  ZELDA_LAYOUT,
} from "@/games/archipelago/worlds/cells";
import type { ItemCell, Skin, SkinCell } from "@/games/archipelago/worlds/skin";
import GROUPS from "@/games/archipelago/worlds/smz3-groups.json";
import { SPRITE_FRAME } from "@/games/sm/data";

/** A frame of Map Rando's item sheet. */
const frame = (id: keyof typeof SPRITE_FRAME) => ({ frame: SPRITE_FRAME[id] });

/** A Link to the Past's items; ZELDA_LAYOUT places them. */
const ZELDA_CELLS: readonly ItemCell[] = [
  progressive(
    "sword",
    "Sword",
    ["ProgressiveSword"],
    {},
    ["Fighter Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
    fromOne("sword"),
  ),
  progressive(
    "shield",
    "Shield",
    ["ProgressiveShield"],
    {},
    ["Blue Shield", "Red Shield", "Mirror Shield"],
    fromOne("shield"),
  ),
  {
    ...progressive(
      "mail",
      "Mail",
      ["ProgressiveTunic"],
      {},
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
    ["ProgressiveGlove"],
    {},
    ["Power Glove", "Titan's Mitts"],
    fromOne("glove"),
  ),
  bits(
    "bow",
    "Bow",
    { Bow: BOW, SilverArrows: SILVERS },
    [],
    [],
    BOW_WORDS,
    bowSprite,
  ),
  bits(
    "boomerang",
    "Boomerang",
    { BlueBoomerang: 1, RedBoomerang: 2 },
    [],
    [],
    { 1: "Blue Boomerang", 2: "Red Boomerang", 3: "both Boomerangs" },
    (level) => `boomerang${level === 0 ? 1 : level}.png`,
  ),
  toggle("hookshot", "Hookshot", "hookshot.png", ["Hookshot"]),
  toggle("mushroom", "Mushroom", "mushroom.png", ["Mushroom"]),
  toggle("powder", "Magic Powder", "powder.png", ["Powder"]),
  toggle("firerod", "Fire Rod", "firerod.png", ["Firerod"]),
  toggle("icerod", "Ice Rod", "icerod.png", ["Icerod"]),
  toggle("bombos", "Bombos", "bombos.png", ["Bombos"]),
  toggle("ether", "Ether", "ether.png", ["Ether"]),
  toggle("quake", "Quake", "quake.png", ["Quake"]),
  toggle("lamp", "Lamp", "lantern.png", ["Lamp"]),
  toggle("hammer", "Hammer", "hammer.png", ["Hammer"]),
  toggle("shovel", "Shovel", "shovel.png", ["Shovel"]),
  toggle("flute", "Flute", "flute.png", ["Flute"]),
  toggle("net", "Bug Catching Net", "net.png", ["Bugnet"]),
  toggle("book", "Book of Mudora", "book.png", ["Book"]),
  counted(
    "bottle",
    "Bottle",
    [
      "Bottle",
      "BottleWithRedPotion",
      "BottleWithGreenPotion",
      "BottleWithBluePotion",
      "BottleWithFairy",
      "BottleWithBee",
      "BottleWithGoldBee",
    ],
    4,
    fromOne("bottle"),
  ),
  toggle("somaria", "Cane of Somaria", "somaria.png", ["Somaria"]),
  toggle("byrna", "Cane of Byrna", "byrna.png", ["Byrna"]),
  toggle("cape", "Cape", "cape.png", ["Cape"]),
  toggle("mirror", "Magic Mirror", "mirror.png", ["Mirror"]),
  toggle("boots", "Pegasus Boots", "boots.png", ["Boots"]),
  toggle("flippers", "Flippers", "flippers.png", ["Flippers"]),
  toggle("moonpearl", "Moon Pearl", "moonpearl.png", ["MoonPearl"]),
  toggle("magic", "Half Magic", "magic.png", ["HalfMagic"]),
];

/**
 * Each dungeon's name and which keys its pool holds (Item.py,
 * `CreateDungeonPool`): no small key in Eastern Palace, no big key in the
 * castles. AP's names are the short name after `Key` and `BigKey`.
 */
const DUNGEONS: readonly (readonly [
  string,
  { big: boolean; small: boolean },
])[] = [
  ["Eastern Palace", { big: true, small: false }],
  ["Desert Palace", { big: true, small: true }],
  ["Tower of Hera", { big: true, small: true }],
  ["Palace of Darkness", { big: true, small: true }],
  ["Swamp Palace", { big: true, small: true }],
  ["Skull Woods", { big: true, small: true }],
  ["Thieves' Town", { big: true, small: true }],
  ["Ice Palace", { big: true, small: true }],
  ["Misery Mire", { big: true, small: true }],
  ["Turtle Rock", { big: true, small: true }],
  ["Hyrule Castle", { big: false, small: true }],
  ["Castle Tower", { big: false, small: true }],
  ["Ganon's Tower", { big: true, small: true }],
];

const KEY_CELLS: readonly SkinCell[] = DUNGEONS.map(
  ([dungeon, { big, small }], index) => {
    const short = DUNGEON_SHORTS[index] ?? "";
    return {
      dungeon,
      id: `keys-${short.toLowerCase()}`,
      kind: "keys",
      short,
      ...(big ? { big: `BigKey${short}` } : {}),
      ...(small ? { small: `Key${short}` } : {}),
    };
  },
);

/** Super Metroid's items; SM_LAYOUT places them. */
const SM_CELLS: readonly ItemCell[] = [
  toggle("charge", "Charge Beam", frame("charge"), ["Charge"]),
  toggle("ice", "Ice Beam", frame("ice"), ["Ice"]),
  toggle("wave", "Wave Beam", frame("wave"), ["Wave"]),
  toggle("spazer", "Spazer", frame("spazer"), ["Spazer"]),
  toggle("plasma", "Plasma Beam", frame("plasma"), ["Plasma"]),
  toggle("xray", "X-Ray Scope", frame("xRay"), ["XRay"]),
  toggle("grapple", "Grappling Beam", frame("grapple"), ["Grapple"]),
  toggle("morph", "Morph Ball", frame("morph"), ["Morph"]),
  toggle("bombs", "Bombs", frame("bombs"), ["Bombs"]),
  toggle("springball", "Spring Ball", frame("springBall"), ["SpringBall"]),
  toggle("screw", "Screw Attack", frame("screwAttack"), ["ScrewAttack"]),
  toggle("varia", "Varia Suit", frame("varia"), ["Varia"]),
  toggle("gravity", "Gravity Suit", frame("gravity"), ["Gravity"]),
  toggle("hijump", "Hi-Jump Boots", frame("hiJump"), ["HiJump"]),
  toggle("spacejump", "Space Jump", frame("spaceJump"), ["SpaceJump"]),
  toggle("speed", "Speed Booster", frame("speedBooster"), ["SpeedBooster"]),
  counter("etank", "Energy Tank", frame("energyTank"), ["ETank"]),
  counter("reserve", "Reserve Tank", frame("reserveTank"), ["ReserveTank"]),
  counter("missile", "Missile", frame("missile"), ["Missile"]),
  counter("super", "Super Missile", frame("superMissile"), ["Super"]),
  counter("pb", "Power Bomb", frame("powerBomb"), ["PowerBomb"]),
];

/** A keycard's level: AP's suffix, the mark the cell shows, its words. */
const LEVELS = {
  Boss: { level: "boss", mark: "B" },
  L1: { level: "level 1", mark: "1" },
  L2: { level: "level 2", mark: "2" },
} as const;

/**
 * Super Metroid's keycards by area (Item.py, `CreateKeycards`): Wrecked Ship
 * and Lower Norfair have no level 2 card.
 */
const AREAS: readonly (readonly [
  string,
  string,
  string,
  readonly (keyof typeof LEVELS)[],
])[] = [
  ["Crateria", "Crateria", "CR", ["L1", "L2", "Boss"]],
  ["Brinstar", "Brinstar", "BR", ["L1", "L2", "Boss"]],
  ["Norfair", "Norfair", "NO", ["L1", "L2", "Boss"]],
  ["Maridia", "Maridia", "MA", ["L1", "L2", "Boss"]],
  ["WreckedShip", "Wrecked Ship", "WS", ["L1", "Boss"]],
  ["LowerNorfair", "Lower Norfair", "LN", ["L1", "Boss"]],
];

/** The keysanity row: each area's keycards, then Super Metroid's maps. */
const KEYSANITY_CELLS: readonly SkinCell[] = [
  ...AREAS.map(
    ([ap, area, short, levels]): SkinCell => ({
      area,
      cards: levels.map((level) => ({
        name: `Card${ap}${level}`,
        ...LEVELS[level],
      })),
      id: `cards-${short.toLowerCase()}`,
      kind: "cards",
      short,
    }),
  ),
  counter(
    "smmaps",
    "Super Metroid maps",
    "dungeonmap.png",
    ["SmMapBrinstar", "SmMapWreckedShip", "SmMapMaridia", "SmMapLowerNorfair"],
    1,
  ),
];

/** Progression items left to "More items", each with why. */
const EXCLUDED: Readonly<Record<string, string>> = Object.fromEntries(
  [
    ...DUNGEON_SHORTS.map((short) => `Map${short}`),
    ...DUNGEON_SHORTS.map((short) => `Compass${short}`),
  ]
    // Castle Tower has neither, Hyrule Castle no compass (Item.py)
    .filter((name) => !["MapCT", "CompassCT", "CompassHC"].includes(name))
    .map((name) => [
      name,
      "a dungeon's map or compass: it says, it opens nothing",
    ]),
);

export const SMZ3_SKIN: Skin = {
  cells: [...ZELDA_CELLS, ...KEY_CELLS, ...SM_CELLS, ...KEYSANITY_CELLS],
  columns: 7,
  excluded: EXCLUDED,
  extraRows: [
    [
      "cards-cr",
      "cards-br",
      "cards-no",
      "cards-ma",
      "cards-ws",
      "cards-ln",
      "smmaps",
    ],
  ],
  game: "SMZ3",
  groups: Object.fromEntries(GROUPS as [string, string[]][]),
  layout: [...ZELDA_LAYOUT, ...SM_LAYOUT],
};

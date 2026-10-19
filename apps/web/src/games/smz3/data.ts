// What the SMZ3 board shows: both games' items, the rewards found, each
// cell's sprite, and the run types players race.

import type { Smz3Settings } from "@alltp/pack-smz3";
import { SPRITE_FRAME } from "@/games/sm/data";

/** A cell's sprite: an ALttPR asset, or a frame of Map Rando's SM sheet. */
export type Sprite =
  | { readonly asset: (level: number) => string }
  | { readonly frame: number };

/** A cell of the grid: the pack's item, its name and sprite. */
export interface Cell {
  readonly id: string;
  readonly name: string;
  readonly sprite: Sprite;
  /** Its sprite draws its level or count (sword, bottles): no number on it. */
  readonly leveled?: boolean;
}

/** An ALttPR asset, its level shown from 1 (a cell not held shows level 1, greyed). */
const leveled =
  (base: string) =>
  (level: number): string =>
    `${base}${Math.max(level, 1)}.png`;
const plain = (file: string) => () => `${file}.png`;
const zelda = (
  id: string,
  name: string,
  asset: (level: number) => string,
  leveledSprite = false,
): Cell => ({
  id,
  name,
  sprite: { asset },
  ...(leveledSprite ? { leveled: true } : {}),
});

/** A Link to the Past's items, seven a row, as ALttPR's board orders them. */
export const ZELDA_CELLS: readonly Cell[] = [
  zelda("sword", "Sword", leveled("sword"), true),
  zelda("shield", "Shield", leveled("shield"), true),
  zelda("glove", "Glove", leveled("glove"), true),
  zelda("bow", "Bow", plain("bow2")),
  zelda("hookshot", "Hookshot", plain("hookshot")),
  zelda("mushroom", "Mushroom", plain("mushroom")),
  zelda("powder", "Magic Powder", plain("powder")),
  zelda("firerod", "Fire Rod", plain("firerod")),
  zelda("icerod", "Ice Rod", plain("icerod")),
  zelda("bombos", "Bombos", plain("bombos")),
  zelda("ether", "Ether", plain("ether")),
  zelda("quake", "Quake", plain("quake")),
  zelda("lamp", "Lamp", plain("lantern")),
  zelda("hammer", "Hammer", plain("hammer")),
  zelda("shovel", "Shovel", plain("shovel")),
  zelda("flute", "Flute", plain("flute")),
  zelda("book", "Book of Mudora", plain("book")),
  zelda("bottle", "Bottle", leveled("bottle"), true),
  zelda("somaria", "Cane of Somaria", plain("somaria")),
  zelda("byrna", "Cane of Byrna", plain("byrna")),
  zelda("cape", "Magic Cape", plain("cape")),
  zelda("mirror", "Magic Mirror", plain("mirror")),
  zelda("boots", "Pegasus Boots", plain("boots")),
  zelda("flippers", "Zora's Flippers", plain("flippers")),
  zelda("moonPearl", "Moon Pearl", plain("moonpearl")),
  zelda("halfMagic", "Half Magic", plain("magic")),
];

const sm = (id: string, name: string, frame: number): Cell => ({
  id,
  name,
  sprite: { frame },
});

/** Super Metroid's items, their sprites Map Rando's sheet's (games/sm). */
export const SM_CELLS: readonly Cell[] = [
  sm("charge", "Charge Beam", SPRITE_FRAME.charge),
  sm("ice", "Ice Beam", SPRITE_FRAME.ice),
  sm("wave", "Wave Beam", SPRITE_FRAME.wave),
  sm("plasma", "Plasma Beam", SPRITE_FRAME.plasma),
  sm("varia", "Varia Suit", SPRITE_FRAME.varia),
  sm("gravity", "Gravity Suit", SPRITE_FRAME.gravity),
  sm("grapple", "Grappling Beam", SPRITE_FRAME.grapple),
  sm("morph", "Morphing Ball", SPRITE_FRAME.morph),
  sm("bombs", "Bombs", SPRITE_FRAME.bombs),
  sm("springBall", "Spring Ball", SPRITE_FRAME.springBall),
  sm("screwAttack", "Screw Attack", SPRITE_FRAME.screwAttack),
  sm("hiJump", "Hi-Jump Boots", SPRITE_FRAME.hiJump),
  sm("spaceJump", "Space Jump", SPRITE_FRAME.spaceJump),
  sm("speedBooster", "Speed Booster", SPRITE_FRAME.speedBooster),
  sm("missile", "Missile", SPRITE_FRAME.missile),
  sm("super", "Super Missile", SPRITE_FRAME.superMissile),
  sm("powerBomb", "Power Bomb", SPRITE_FRAME.powerBomb),
  sm("eTank", "Energy Tank", SPRITE_FRAME.energyTank),
  sm("reserveTank", "Reserve Tank", SPRITE_FRAME.reserveTank),
];

/** The rewards a run's bosses hold, as found. */
export const REWARD_CELLS: readonly Cell[] = [
  zelda("pendantGreen", "Green Pendant", plain("pendant0")),
  zelda("pendantNonGreen", "Blue or Red Pendant", plain("pendant1")),
  zelda("crystalBlue", "Blue Crystal", plain("crystal0")),
  zelda("crystalRed", "Red Crystal", plain("dungeon4")),
];

/** Super Metroid's boss tokens, which open Tourian, as found. */
export const BOSS_TOKENS = [
  { id: "tokenKraid", name: "Kraid" },
  { id: "tokenPhantoon", name: "Phantoon" },
  { id: "tokenDraygon", name: "Draygon" },
  { id: "tokenRidley", name: "Ridley" },
] as const;

/**
 * A dungeon's key cell under keysanity: its name, the short one the cell
 * shows, and the keys its pool holds (Item.cs, CreateDungeonPool).
 */
export interface KeyCell {
  readonly dungeon: string;
  readonly short: string;
  readonly smallKey?: string;
  readonly bigKey?: string;
}

const keys = (
  dungeon: string,
  short: string,
  { big = true, small = true } = {},
): KeyCell => ({
  dungeon,
  short,
  ...(small ? { smallKey: `key${short}` } : {}),
  ...(big ? { bigKey: `bigKey${short}` } : {}),
});

/** Each dungeon's keys, in ALttPR's grid order, the castle's three last. */
export const KEY_CELLS: readonly KeyCell[] = [
  keys("Eastern Palace", "EP", { small: false }),
  keys("Desert Palace", "DP"),
  keys("Tower of Hera", "TH"),
  keys("Palace of Darkness", "PD"),
  keys("Swamp Palace", "SP"),
  keys("Skull Woods", "SW"),
  keys("Thieves' Town", "TT"),
  keys("Ice Palace", "IP"),
  keys("Misery Mire", "MM"),
  keys("Turtle Rock", "TR"),
  keys("Hyrule Castle", "HC", { big: false }),
  keys("Castle Tower", "CT", { big: false }),
  keys("Ganon's Tower", "GT"),
];

/** A keycard's level, as its item id ends. */
export const KEYCARD_LEVELS = [
  { id: "L1", name: "Level 1" },
  { id: "L2", name: "Level 2" },
  { id: "Boss", name: "Boss" },
] as const;

/**
 * Super Metroid's keycards under keysanity, by area (Item.cs,
 * CreateKeycards): Wrecked Ship and Lower Norfair have no level 2 card.
 */
export const KEYCARD_AREAS: readonly {
  readonly id: string;
  readonly name: string;
  readonly levels: readonly (typeof KEYCARD_LEVELS)[number]["id"][];
}[] = [
  { id: "Crateria", levels: ["L1", "L2", "Boss"], name: "Crateria" },
  { id: "Brinstar", levels: ["L1", "L2", "Boss"], name: "Brinstar" },
  { id: "Norfair", levels: ["L1", "L2", "Boss"], name: "Norfair" },
  { id: "Maridia", levels: ["L1", "L2", "Boss"], name: "Maridia" },
  { id: "WreckedShip", levels: ["L1", "Boss"], name: "Wrecked Ship" },
  { id: "LowerNorfair", levels: ["L1", "Boss"], name: "Lower Norfair" },
];

/** A keycard's item id: its area's, then its level's. */
export const keycardId = (area: string, level: string) => `card${area}${level}`;

/** The grid's columns. */
export const SMZ3_COLUMNS = 7;

/** A place of the grid: an item's cell, a dungeon's keys, or a gap. */
export type Slot = Cell | KeyCell | null;

/** The cells in rows of the grid's width, the last one filled with gaps. */
const rowsOf = (cells: readonly (Cell | KeyCell)[]) => {
  const rows: Slot[][] = [];
  for (let i = 0; i < cells.length; i += SMZ3_COLUMNS) {
    const row: Slot[] = cells.slice(i, i + SMZ3_COLUMNS);
    while (row.length < SMZ3_COLUMNS) row.push(null);
    rows.push(row);
  }
  return rows;
};

const GRID = [
  ...rowsOf(ZELDA_CELLS),
  ...rowsOf(SM_CELLS),
  ...rowsOf(REWARD_CELLS),
];
const KEYSANITY_GRID = [
  ...rowsOf(ZELDA_CELLS),
  ...rowsOf(KEY_CELLS),
  ...rowsOf(SM_CELLS),
  ...rowsOf(REWARD_CELLS),
];

/**
 * The grid's rows, each section starting a row: A Link to the Past's items,
 * its dungeons' keys under keysanity, Super Metroid's items, the rewards.
 */
export const gridOf = (keysanity: boolean): readonly (readonly Slot[])[] =>
  keysanity ? KEYSANITY_GRID : GRID;

/**
 * The run types players race (racetime.gg's smz3 category, 2025-2026):
 * samus.link's defaults, the weeklies' 7/5/3 with fast Ganon, Hard, and
 * keysanity.
 */
export const PRESETS: readonly {
  readonly id: string;
  readonly name: string;
  readonly settings: Smz3Settings;
}[] = [
  {
    id: "normal",
    name: "Normal, 7/7/4",
    settings: {
      ganonCrystals: 7,
      keysanity: false,
      smLogic: "normal",
      tourianBosses: 4,
      towerCrystals: 7,
    },
  },
  {
    id: "normal-753",
    name: "Normal, 7/5/3, fast Ganon",
    settings: {
      ganonCrystals: 5,
      keysanity: false,
      smLogic: "normal",
      tourianBosses: 3,
      towerCrystals: 7,
    },
  },
  {
    id: "hard",
    name: "Hard, 7/7/4",
    settings: {
      ganonCrystals: 7,
      keysanity: false,
      smLogic: "hard",
      tourianBosses: 4,
      towerCrystals: 7,
    },
  },
  {
    id: "keysanity",
    name: "Normal keysanity, 7/7/4",
    settings: {
      ganonCrystals: 7,
      keysanity: true,
      smLogic: "normal",
      tourianBosses: 4,
      towerCrystals: 7,
    },
  },
];

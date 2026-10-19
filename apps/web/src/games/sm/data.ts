// What the Super Metroid board shows: its grid, each item's sprite in Map
// Rando's sheet, and the objectives each of its presets asks for.

import type { SmItemId } from "@alltp/pack-sm";

/** The board's columns: six cells, as the grid's rows below hold. */
export const SM_COLUMNS = 6;

/** A grid row: item ids, "" for an empty cell. */
export type SmRow = readonly (SmItemId | "")[];

/**
 * The grid, beams first, then the morph ball and suits, then movement, then
 * the counted items. Map Rando's settings add cells: the Wall Jump Boots
 * when wall jumps need them, and the Spark and Blue Boosters in place of the
 * Speed Booster when it comes split (patches/rom_map/Bank DF.txt, $DF:FF05).
 */
export const smGrid = ({
  wallJump,
  splitSpeed,
}: {
  readonly wallJump: boolean;
  readonly splitSpeed: boolean;
}): readonly SmRow[] => [
  ["charge", "ice", "wave", "spazer", "plasma", "xRay"],
  ["morph", "bombs", "springBall", "screwAttack", "varia", "gravity"],
  [
    "hiJump",
    "spaceJump",
    ...(splitSpeed
      ? (["sparkBooster", "blueBooster"] as const)
      : (["speedBooster"] as const)),
    "grapple",
    ...(wallJump ? (["wallJump"] as const) : []),
    ...(splitSpeed ? [] : ([""] as const)),
    ...(wallJump ? [] : ([""] as const)),
  ],
  ["energyTank", "reserveTank", "missile", "superMissile", "powerBomb", ""],
];

/**
 * Each item's frame in Map Rando's item sheet (assets/items.png, its
 * visualizer's, 26 frames of 16 px): the order of `item_plm` in
 * visualizer/consts.js:15-42 at the commit packs/sm/upstream.json pins, which
 * follows `enum Item` but for the two boosters.
 */
export const SPRITE_FRAME: Readonly<Record<SmItemId, number>> = {
  blueBooster: 22,
  bombs: 4,
  charge: 5,
  energyTank: 0,
  grapple: 16,
  gravity: 13,
  hiJump: 7,
  ice: 6,
  missile: 1,
  morph: 19,
  plasma: 15,
  powerBomb: 3,
  reserveTank: 20,
  screwAttack: 18,
  spaceJump: 17,
  sparkBooster: 23,
  spazer: 10,
  speedBooster: 8,
  springBall: 11,
  superMissile: 2,
  varia: 12,
  wallJump: 21,
  wave: 9,
  xRay: 14,
};

/** Frames in the sheet. */
export const SPRITE_FRAMES = 26;

/**
 * The objectives each of Map Rando's presets asks for
 * (rust/data/presets/objectives/*.json): four set ones, none, or four drawn
 * from all of them (Random), which the player names as the seed shows them.
 */
export const OBJECTIVE_PRESETS = {
  bosses: ["kraid", "phantoon", "draygon", "ridley"],
  chozos: ["goldenTorizo", "bombTorizo", "bowlingStatue", "acidChozoStatue"],
  metroids: ["metroidRoom1", "metroidRoom2", "metroidRoom3", "metroidRoom4"],
  minibosses: ["sporeSpawn", "crocomire", "botwoon", "goldenTorizo"],
  none: [],
  pirates: ["pitRoom", "babyKraidRoom", "plasmaRoom", "metalPiratesRoom"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type ObjectivePreset = keyof typeof OBJECTIVE_PRESETS;

/** The presets in the order maprando.com lists them, with their names. */
export const OBJECTIVE_PRESET_NAMES: readonly (readonly [
  ObjectivePreset,
  string,
])[] = [
  ["none", "None"],
  ["bosses", "Bosses"],
  ["minibosses", "Minibosses"],
  ["chozos", "Chozos"],
  ["pirates", "Pirates"],
  ["metroids", "Metroids"],
];

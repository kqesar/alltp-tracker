// The kinds of cell the skins build theirs from, and the grid shapes the
// tracker's boards give A Link to the Past's and Super Metroid's items, which
// the skins of the worlds holding those items share. Names are each skin's:
// AP's ALttP, Super Metroid and SMZ3 worlds name the same item differently.

import type {
  ItemCell,
  Layout,
  SkinSprite,
} from "@/games/archipelago/worlds/skin";

/** Each name with the same cap. */
const capsOf = (names: readonly string[], cap: number) =>
  Object.fromEntries(names.map((name) => [name, cap]));

/** A cell whose level is its progressive item's count, or a fixed level's. */
export const progressive = (
  id: string,
  name: string,
  progressives: readonly string[],
  fixed: Readonly<Record<string, number>>,
  levels: readonly string[],
  sprite: (level: number) => SkinSprite,
): ItemCell => ({
  caps: {
    ...capsOf(progressives, levels.length),
    ...capsOf(Object.keys(fixed), 1),
  },
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
export const toggle = (
  id: string,
  name: string,
  sprite: SkinSprite,
  names: readonly string[] = [name],
): ItemCell => ({
  caps: capsOf(names, 1),
  describe: (level) => (level === 0 ? "not received" : "received"),
  id,
  kind: "item",
  level: (count) => (names.some((item) => count(item) > 0) ? 1 : 0),
  name,
  names,
  sprite: () => sprite,
});

/** A cell whose level is a set of bits, one per item (the bow, the boomerangs). */
export const bits = (
  id: string,
  name: string,
  items: Readonly<Record<string, number>>,
  progressives: readonly string[],
  progressiveBits: readonly number[],
  words: Readonly<Record<number, string>>,
  sprite: (level: number) => SkinSprite,
): ItemCell => ({
  caps: {
    ...capsOf(progressives, progressiveBits.length),
    ...capsOf(Object.keys(items), 1),
  },
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

/** A cell that counts its items up to a most its sprite draws (the bottles). */
export const counted = (
  id: string,
  name: string,
  names: readonly string[],
  max: number,
  sprite: (level: number) => SkinSprite,
): ItemCell => ({
  caps: capsOf(names, max),
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

/**
 * A counter: how many of its items the slot holds, drawn on its sprite from
 * one (tanks and packs, whose pool AP's options set).
 * @param cap - The most of each name a pool holds, if the world fixes it
 */
export const counter = (
  id: string,
  name: string,
  sprite: SkinSprite,
  names: readonly string[] = [name],
  cap?: number,
): ItemCell => ({
  caps: cap === undefined ? {} : capsOf(names, cap),
  counter: true,
  describe: (level) => (level === 0 ? "not received" : `${level} received`),
  id,
  kind: "item",
  level: (count) => names.reduce((sum, item) => sum + count(item), 0),
  name,
  names,
  sprite: () => sprite,
});

/** The bow's and silver arrows' bits, as ALttPR's bow sprites draw them. */
export const SILVERS = 1;
export const BOW = 2;

/** The words of a bow cell's level. */
export const BOW_WORDS = {
  [SILVERS]: "Silver Arrows only",
  [BOW]: "Bow",
  [BOW | SILVERS]: "Bow and Silver Arrows",
};

/** The bow's sprite: a bow, greyed, while nothing is held. */
export const bowSprite = (level: number) =>
  `bow${level === 0 ? BOW : level}.png`;

/** A level's sprite from 1, a cell not held showing level 1 greyed. */
export const fromOne = (base: string) => (level: number) =>
  `${base}${Math.max(level, 1)}.png`;

/** The dungeons in ALttPR's grid order, the castles last: their short names. */
export const DUNGEON_SHORTS = [
  "EP",
  "DP",
  "TH",
  "PD",
  "SP",
  "SW",
  "TT",
  "IP",
  "MM",
  "TR",
  "HC",
  "CT",
  "GT",
] as const;

/**
 * A Link to the Past's grid as ALttPR's board lays its items
 * (data/items.ts, `defaultItemGrid`): two full rows of items, then three of
 * five items with two dungeons' keys where ALttPR's board has its key and
 * boss cells, then the last seven dungeons' keys. Six full rows of seven: 29
 * items, 13 dungeons. A skin's ids must be these.
 */
export const ZELDA_LAYOUT: Layout = [
  ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"],
  ["bow", "lamp", "shield", "sword", "mail", "magic", "boots"],
  ["shovel", "book", "quake", "bombos", "ether", "keys-ep", "keys-dp"],
  ["powder", "glove", "bottle", "somaria", "byrna", "keys-th", "keys-pd"],
  ["mushroom", "cape", "mirror", "moonpearl", "flippers", "keys-sp", "keys-sw"],
  ["keys-tt", "keys-ip", "keys-mm", "keys-tr", "keys-hc", "keys-ct", "keys-gt"],
];

/**
 * Super Metroid's 21 items as the tracker's SM board orders them (games/sm,
 * `smGrid`: the beams, the morph ball and suits, movement, then the counted
 * items), in three full rows of seven. A skin's ids must be these.
 */
export const SM_LAYOUT: Layout = [
  ["charge", "ice", "wave", "spazer", "plasma", "xray", "grapple"],
  ["morph", "bombs", "springball", "screw", "varia", "gravity", "hijump"],
  ["spacejump", "speed", "etank", "reserve", "missile", "super", "pb"],
];

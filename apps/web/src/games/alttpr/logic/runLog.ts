// What the Run tab shows of a run's timeline: each find named and drawn as
// the board draws it, newest first, and the splits, the bosses in the order
// they fell, as a speedrun timer splits a run.
import { itemLabels, TOGGLE_ITEMS } from "@/games/alttpr/data/items";
import { dungeonName } from "@/games/alttpr/logic/settings";
import { locationName } from "@/games/alttpr/logic/solution";
import type { Timeline } from "@/games/alttpr/logic/timeline";
import type { Stamp } from "@/games/stamp";

/** One find of the timeline, as the Run tab lists it. */
export interface Find {
  readonly key: string;
  readonly stamp: Stamp;
}

/** One boss beaten, as a split: its time, and the time since the last. */
export interface Split {
  readonly key: string;
  readonly name: string;
  readonly ms: number | null;
  readonly segment: number | null;
}

/** Each level's name, from 1, where the item's own name does not do. */
const LEVELS: Readonly<Record<string, readonly string[]>> = {
  bottle: ["Bottle", "Second Bottle", "Third Bottle", "Fourth Bottle"],
  glove: ["Power Glove", "Titan's Mitt"],
  magic: ["Half Magic", "Quarter Magic"],
  shield: ["Fighter's Shield", "Fire Shield", "Mirror Shield"],
  sword: ["Fighter's Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
  // The tunic's 1 is the green mail every run starts with
  tunic: ["Green Mail", "Blue Mail", "Red Mail"],
};

/** Each bit's name, for the items whose bits are items. */
const BITS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  boomerang: { 1: "Blue Boomerang", 2: "Red Boomerang" },
  bow: { 1: "Silver Arrows", 2: "Bow" },
};

/** A dungeon's own items, by key dungeon index. */
const DUNGEON_ITEM = /^(bigkey|compass|map)(\d+)$/;

const DUNGEON_ITEM_NAMES: Readonly<Record<string, string>> = {
  bigkey: "Big Key",
  compass: "Compass",
  map: "Map",
};

/** The bosses' keys: each dungeon boss beaten, and the two Agahnims. */
const BOSS = /^item:(?:boss(\d+):2|(agahnim2?):1)$/;

/** An item key's id and level: `item:sword:2` is sword, 2. */
const itemOf = (key: string): [id: string, level: number | undefined] => {
  const [, id = "", level] = key.split(":");
  return [id, level === undefined ? undefined : Number(level)];
};

/** A find's name: the item at its level, the boss beaten, the location. */
export const findName = (key: string): string => {
  if (key.startsWith("check:")) return locationName(key.slice(6));
  const [id, level = 1] = itemOf(key);
  const bits = BITS[id];
  if (bits) return bits[level] ?? itemLabels(id);
  const levels = LEVELS[id];
  if (levels) return levels[level - 1] ?? itemLabels(id);
  const dungeonItem = DUNGEON_ITEM.exec(id);
  if (dungeonItem) {
    const [, kind = "", index = ""] = dungeonItem;
    return `${dungeonName(Number(index))} ${DUNGEON_ITEM_NAMES[kind]}`;
  }
  return BOSS.test(key) ? `${itemLabels(id)} beaten` : itemLabels(id);
};

/**
 * The image the board draws a find with, an asset's name; null for a
 * location, which has none.
 */
export const findIcon = (key: string): string | null => {
  if (key.startsWith("check:")) return null;
  const [id, level] = itemOf(key);
  const dungeonItem = DUNGEON_ITEM.exec(id);
  if (dungeonItem) {
    return dungeonItem[1] === "map"
      ? "dungeonmap.png"
      : `${dungeonItem[1]}.png`;
  }
  // Agahnim 2 is drawn as Agahnim, as on the board
  if (id.startsWith("agahnim")) return "agahnim1.png";
  // The half magic and the quarter share the cell's picture
  if (TOGGLE_ITEMS.has(id)) return `${id}.png`;
  return level === undefined ? `${id}.png` : `${id}${level}.png`;
};

/**
 * The timeline's finds, newest first. In Race Mode, the items alone: the race
 * rules (v2.0) allow "displaying a timeline of acquired items" but forbid
 * associating an acquired item with a specific location, which a checked
 * location's time beside an item's would do. The stamps stay in the run, and
 * show again once Race Mode is off.
 */
export const findsOf = (timeline: Timeline, race = false): Find[] =>
  Object.entries(timeline)
    .filter(([key]) => !race || !key.startsWith("check:"))
    .map(([key, stamp]) => ({ key, stamp }))
    .sort((a, b) => b.stamp.at - a.stamp.at || a.key.localeCompare(b.key));

/** A boss's split name: its dungeon's. */
export const splitName = (key: string): string => {
  const [, index, agahnim] = BOSS.exec(key) ?? [];
  if (agahnim === "agahnim") return "Castle Tower";
  if (agahnim === "agahnim2") return "Ganon's Tower";
  return dungeonName(Number(index));
};

/**
 * The bosses beaten, in the order they fell, each with its time and the
 * time since the one before (from the start for the first); a segment is
 * unknown where either time is.
 */
export const splitsOf = (timeline: Timeline): Split[] => {
  let previous: number | null = 0;
  return Object.entries(timeline)
    .filter(([key]) => BOSS.test(key))
    .sort(([, a], [, b]) => a.at - b.at)
    .map(([key, { ms }]) => {
      const segment = ms !== null && previous !== null ? ms - previous : null;
      previous = ms;
      return { key, ms, name: splitName(key), segment };
    });
};

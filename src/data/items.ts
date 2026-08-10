// Default item grid layout
export const defaultItemGrid: string[][] = [
  ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"],
  ["bow", "lantern", "shield", "sword", "tunic", "agahnim", "boots"],
  ["shovel", "book", "quake", "bombos", "ether", "bigkey0", "boss0"],
  ["powder", "glove", "bottle", "somaria", "byrna", "bigkey1", "boss1"],
  ["mushroom", "cape", "mirror", "moonpearl", "flippers", "bigkey2", "boss2"],
  ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
  ["bigkey3", "bigkey4", "bigkey5", "bigkey6", "bigkey7", "bigkey8", "bigkey9"],
];

/** Chests each dungeon contains, indexed by dungeon index 0-9. */
const DUNGEON_CHEST_COUNTS = [3, 2, 2, 5, 6, 2, 4, 3, 2, 5];

/** Ten dungeon-indexed keys, e.g. boss0..boss9. */
const perDungeon = (
  prefix: string,
  range: (index: number) => Range,
): Record<string, Range> =>
  Object.fromEntries(
    DUNGEON_CHEST_COUNTS.map((_, index) => [`${prefix}${index}`, range(index)]),
  );

/** [min, max] or [min, max, initial]; initial defaults to min. */
type Range = readonly [number, number] | readonly [number, number, number];

/**
 * Every progressive item, as a single range table. `items`, `itemsMin` and
 * `itemsMax` are all derived from it, so a bound can only ever be changed in
 * one place.
 */
const NUMERIC_ITEMS: Record<string, Range> = {
  agahnim: [0, 1],
  boomerang: [0, 3],
  bottle: [0, 4],
  bow: [0, 3],
  dungeon: [0, 4],
  glove: [0, 2],
  shield: [0, 3],
  sword: [0, 4],
  tunic: [1, 3],

  // Big keys for keysanity mode (0 = not obtained, 1 = obtained)
  ...perDungeon("bigkey", () => [0, 1]),
  // Boss state, starts at 1 (alive)
  ...perDungeon("boss", () => [1, 2]),
  // Remaining chests per dungeon, counted down from the dungeon's total
  ...perDungeon("chest", (index) => [
    0,
    DUNGEON_CHEST_COUNTS[index],
    DUNGEON_CHEST_COUNTS[index],
  ]),
  // Boss reward icon (dungeon0.png to dungeon4.png)
  ...perDungeon("reward", () => [0, 4]),
};

/** Items that are simply held or not held. */
const BOOLEAN_ITEMS = [
  "blank",
  "bombos",
  "book",
  "boots",
  "byrna",
  "cape",
  "ether",
  "firerod",
  "flippers",
  "flute",
  "hammer",
  "hookshot",
  "icerod",
  "lantern",
  "mirror",
  "moonpearl",
  "mushroom",
  "net",
  "powder",
  "quake",
  "shovel",
  "somaria",
];

const numericEntries = Object.entries(NUMERIC_ITEMS);

/** Starting state of every tracked item. */
export const items: Record<string, number | boolean> = {
  ...Object.fromEntries(BOOLEAN_ITEMS.map((name) => [name, false])),
  ...Object.fromEntries(
    numericEntries.map(([name, [min, , initial]]) => [name, initial ?? min]),
  ),
};

/** Lowest value a progressive item cycles to. Boolean items are absent. */
export const itemsMin: Record<string, number> = Object.fromEntries(
  numericEntries.map(([name, [min]]) => [name, min]),
);

/** Highest value a progressive item cycles to. Boolean items are absent. */
export const itemsMax: Record<string, number> = Object.fromEntries(
  numericEntries.map(([name, [, max]]) => [name, max]),
);

/** Dungeon bosses, in dungeon-index order. */
const BOSS_NAMES = [
  "Armos Knights",
  "Lanmolas",
  "Moldorm",
  "Helmasaur King",
  "Arrghus",
  "Mothula",
  "Blind the Thief",
  "Kholdstare",
  "Vitreous",
  "Trinexx",
];

/** Item ids whose readable name is not just the capitalised id. */
const ITEM_NAMES: Record<string, string> = {
  bombos: "Bombos Medallion",
  book: "Book of Mudora",
  boots: "Pegasus Boots",
  byrna: "Cane of Byrna",
  cape: "Magic Cape",
  ether: "Ether Medallion",
  firerod: "Fire Rod",
  flippers: "Zora's Flippers",
  glove: "Power Glove",
  icerod: "Ice Rod",
  mirror: "Magic Mirror",
  moonpearl: "Moon Pearl",
  net: "Bug Net",
  powder: "Magic Powder",
  quake: "Quake Medallion",
  somaria: "Cane of Somaria",
};

/**
 * Human-readable name for an item id, used in accessibility labels.
 * @param item - The item identifier, e.g. "moonpearl" or "boss3"
 */
export const itemLabels = (item: string): string => {
  if (!item || item === "blank") return "Empty slot";

  if (item.startsWith("boss")) {
    const index = Number.parseInt(item.slice("boss".length), 10);
    return BOSS_NAMES[index] ?? `Boss ${index}`;
  }

  return ITEM_NAMES[item] ?? item.charAt(0).toUpperCase() + item.slice(1);
};

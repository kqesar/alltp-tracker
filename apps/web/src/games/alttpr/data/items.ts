/**
 * The items a run tracks, by the tracker's ids: `boolean` for an item held
 * or not, `number` for a progressive one, a counter or a boss (1 alive, 2
 * beaten). The members named are those compared as numbers, which the index
 * signature alone would type as `number | boolean`.
 */
export interface ItemState {
  [key: string]: number | boolean;

  agahnim: number;
  agahnim2: number;
  bow: number;
  chest0: number;
  chest1: number;
  chest2: number;
  chest3: number;
  chest4: number;
  chest5: number;
  chest6: number;
  chest7: number;
  chest8: number;
  chest9: number;
  glove: number;
  sword: number;
}

/**
 * The item grid, row by row. Each id is an item's cell, but for the
 * dungeons' cells: `bossN`, the boss cell of key dungeon N (logic/settings.ts
 * KEY_DUNGEONS: the grid's ten, and Ganon's Tower's, 12); `keysN`, its key
 * cell, holding its big key, small keys, map and compass; and `keylabelN`,
 * the short name of a castle dungeon, which has no boss cell above its key
 * cell to tell it. The key cells and labels show only with the key cells, a
 * row of nothing else with them. On that row Agahnim stands where Castle
 * Tower's label would, as the head of its keys.
 */
export const defaultItemGrid: string[][] = [
  ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"],
  ["bow", "lantern", "shield", "sword", "tunic", "magic", "boots"],
  ["shovel", "book", "quake", "bombos", "ether", "keys0", "boss0"],
  ["powder", "glove", "bottle", "somaria", "byrna", "keys1", "boss1"],
  ["mushroom", "cape", "mirror", "moonpearl", "flippers", "keys2", "boss2"],
  ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
  ["keys3", "keys4", "keys5", "keys6", "keys7", "keys8", "keys9"],
  [
    "keylabel10",
    "keys10",
    "agahnim",
    "keys11",
    "keylabel12",
    "keys12",
    "boss12",
  ],
];

/**
 * The item grid of a run: a retro run's last row holds the shops that sell
 * arrows and keys where Hyrule Castle's and Castle Tower's key cells stand,
 * which have nothing to show there (no big key, no small key of their own);
 * Agahnim keeps the place between them.
 * @param run - The run's world
 */
export const itemGridFor = (run: { readonly mode: string }): string[][] =>
  run.mode === "retro" ? RETRO_ITEM_GRID : defaultItemGrid;

const RETRO_ITEM_GRID: string[][] = [
  ...defaultItemGrid.slice(0, -1),
  ["shoparrow", "shopkey", "agahnim", "", "keylabel12", "keys12", "boss12"],
];

/**
 * The items that count levels but whose cell is a plain toggle: the half magic
 * (1) is held or not. A quarter magic (2), which only a customized seed gives
 * and autotracking reads, is kept as it is for the logic and drawn as the half.
 */
export const TOGGLE_ITEMS: ReadonlySet<string> = new Set(["magic"]);

/**
 * The counters that stop at their ends instead of wrapping round: the
 * hearts, whose "not set" one step back from 20 would say all hearts held
 * on a stray right-click, and the reverse.
 */
export const CLAMPED_ITEMS: ReadonlySet<string> = new Set(["hearts"]);

/** Whether a grid id is a key cell's or a castle dungeon's label. */
export const isKeyCell = (id: string): boolean =>
  id.startsWith("keys") || id.startsWith("keylabel");

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
  // Agahnim beaten again, atop Ganon's Tower: its map marker, not the grid
  agahnim2: [0, 1],
  boomerang: [0, 3],
  bottle: [0, 4],
  bow: [0, 3],
  glove: [0, 2],
  // Link's hearts on screen, less 2: 0 not set (unknown to the logic), 1 the
  // 3 hearts every run starts with, 18 the 20 a full pool reaches
  // (heartsShown)
  hearts: [0, 18],
  // 1 the half magic, 2 the quarter, which only a customized seed gives
  magic: [0, 2],
  shield: [0, 3],
  sword: [0, 4],
  // The Ten Bombs (the escape's), which no cell draws: 0 not known, 1 none
  // found, 2 found; autotracking reads it
  tenbombs: [0, 2],
  tunic: [1, 3],

  // Big keys (0 = not obtained, 1 = obtained)
  ...perDungeon("bigkey", () => [0, 1]),
  // Maps and compasses, whose boss wants them once they leave their dungeons
  // (MC Shuffle and up; 0 or 1)
  ...perDungeon("map", () => [0, 1]),
  ...perDungeon("compass", () => [0, 1]),
  // The castle dungeons' own items, on key cells 10-12 (logic/settings.ts
  // KEY_DUNGEONS), as their pools hold them: Hyrule Castle's map, Ganon's
  // Tower's big key, map and compass. Castle Tower holds none.
  bigkey12: [0, 1],
  compass12: [0, 1],
  map10: [0, 1],
  map12: [0, 1],
  // Boss state, starts at 1 (alive)
  ...perDungeon("boss", () => [1, 2]),
  // Remaining chests per dungeon, counted down from the dungeon's total
  ...perDungeon("chest", (index) => [
    0,
    DUNGEON_CHEST_COUNTS[index],
    DUNGEON_CHEST_COUNTS[index],
  ]),
  // Ganon's Tower's items left, on its own cell (key index 12): its 20 items
  // in v31, its 27 locations in Full Shuffle (logic/settings.ts counterMax)
  chest12: [0, 27, 20],
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
  // The retro world's shops: one found that sells arrows, or keys
  "shoparrow",
  "shopkey",
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

/** The hearts the `hearts` value 1 stands for: the 3 Link starts with. */
export const STARTING_HEARTS = 3;

/**
 * The hearts on screen a `hearts` value says, or null while not set: what
 * the hearts cell shows, and less the 3 Link starts with, the hearts found
 * the rules read (logic/packItems.ts).
 * @param value - The `hearts` value: 0 not set, else the hearts less 2
 */
export const heartsShown = (value: number): number | null =>
  value > 0 ? value + STARTING_HEARTS - 1 : null;

/**
 * The `hearts` value of a number of hearts on screen, within its range: 3
 * hearts or fewer are 1, the run's start.
 * @param shown - The hearts on screen
 */
export const heartsValue = (shown: number): number =>
  Math.max(1, Math.min(itemsMax.hearts, shown - STARTING_HEARTS + 1));

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
  agahnim2: "Agahnim 2",
  bombos: "Bombos Medallion",
  book: "Book of Mudora",
  boots: "Pegasus Boots",
  byrna: "Cane of Byrna",
  cape: "Magic Cape",
  ether: "Ether Medallion",
  firerod: "Fire Rod",
  flippers: "Zora's Flippers",
  glove: "Power Glove",
  hearts: "Hearts",
  icerod: "Ice Rod",
  magic: "Half Magic",
  mirror: "Magic Mirror",
  moonpearl: "Moon Pearl",
  net: "Bug Net",
  powder: "Magic Powder",
  quake: "Quake Medallion",
  shoparrow: "Arrow shop",
  shopkey: "Key shop",
  somaria: "Cane of Somaria",
  tenbombs: "Ten Bombs",
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

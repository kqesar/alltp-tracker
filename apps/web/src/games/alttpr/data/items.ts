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
 * The Triforce pieces found, on a Triforce Hunt's own cell (`triforce`), and
 * the pieces the goal asks for (`goalpieces`), which no cell draws: the
 * cell says "found/asked".
 */
export const PIECES_ITEM = "triforce";

/**
 * The four bottles' cells, in the game's order: each draws what its bottle
 * holds (`BottleContents`), and whether it is there at all is the `bottle`
 * count's, as the game fills its bottles in order.
 */
export const BOTTLE_SLOTS = [
  "bottlecontents1",
  "bottlecontents2",
  "bottlecontents3",
  "bottlecontents4",
] as const;

/**
 * What a bottle holds, by its `bottlecontentsN` value: 0 empty (or not
 * recorded: an old save's bottles), then the potions, the fairy, the bees
 * and last the mushroom, every content the game's item menu draws a bottle
 * for (zelda3 src/hud.c kHudItemBottles; sram.asm BottleContents, whose
 * $00 is no bottle, $01 the mushroom, $02 empty, $03 to $08 the rest in
 * this order). Each is drawn with the game's own sprite, `bottle-<name>.png`,
 * taken from its item menu.
 */
export const BOTTLE_CONTENTS = [
  "empty",
  "red",
  "green",
  "blue",
  "fairy",
  "bee",
  "goodbee",
  "mushroom",
] as const;

export type BottleContents = (typeof BOTTLE_CONTENTS)[number];

/** Each content's words, for a bottle cell's name. */
export const BOTTLE_CONTENT_NAMES: Readonly<Record<BottleContents, string>> = {
  bee: "a bee",
  blue: "blue potion",
  empty: "empty",
  fairy: "a fairy",
  goodbee: "a good bee",
  green: "green potion",
  mushroom: "a mushroom",
  red: "red potion",
};

/**
 * The bomb and arrow capacities, as the game holds them: flatly how many
 * can be held (sram.asm BombCapacity, ArrowCapacity), 10 bombs and 30 arrows
 * at the start, each upgrade adding 5 (or 10 at once) up to 50 and 70
 * (newitems.asm .bombs_5 to .arrows_70). A click steps 5 between the two.
 */
export const CAPACITIES: Readonly<
  Record<string, { readonly start: number; readonly top: number }>
> = {
  arrowcapacity: { start: 30, top: 70 },
  bombcapacity: { start: 10, top: 50 },
};

/**
 * The two cells that show what the goal asks for in crystals, Ganon's
 * Tower's and Ganon's: the run's settings (`crystalsTower`,
 * `crystalsGanon`), which a seed sets and the player steps from the cell.
 */
export const GOAL_CELLS = {
  goalganon: "crystalsGanon",
  goaltower: "crystalsTower",
} as const;

export type GoalCell = keyof typeof GOAL_CELLS;

/**
 * The item rows, five of seven: the Y items, the equipment (the bow with
 * the arrows' capacity, the tunic with Link's hearts), then the bombs with
 * their capacity, the four bottles and what the goal asks for in crystals.
 */
const ITEM_ROWS: readonly string[][] = [
  ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"],
  ["bow", "lantern", "shield", "sword", "tunic", "magic", "boots"],
  ["shovel", "book", "quake", "bombos", "ether", "mushroom", "powder"],
  ["glove", "flippers", "moonpearl", "cape", "mirror", "somaria", "byrna"],
  ["bombcapacity", ...BOTTLE_SLOTS, "goaltower", "goalganon"],
];

/**
 * The item grid, row by row. Each id is an item's cell, but for the
 * dungeons' cells: `bossN`, the boss cell of key dungeon N (logic/settings.ts
 * KEY_DUNGEONS: the grid's ten, and Ganon's Tower's, 12), named in its top
 * left corner; `keysN`, its key cell, holding its big key, small keys, map
 * and compass, under its boss; and `keylabelN`, the short name of Hyrule
 * Castle, which has no boss cell above its key cell to tell it. Under the
 * items, the Light World's dungeons with Castle Tower (Agahnim, `agahnim`)
 * and Ganon's Tower, then the pendants and crystals held (`pendants`,
 * `crystals`, which only show); under them the seven crystals' dungeons.
 * The key cells and labels show only with the key cells, a row of nothing
 * else with them.
 */
export const defaultItemGrid: string[][] = [
  ...ITEM_ROWS,
  ["boss0", "boss1", "boss2", "agahnim", "boss12", "pendants", "crystals"],
  ["keys0", "keys1", "keys2", "keys11", "keys12", "keylabel10", "keys10"],
  ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
  ["keys3", "keys4", "keys5", "keys6", "keys7", "keys8", "keys9"],
];

/**
 * Whether a run is a Triforce Hunt as far as the player knows: its goal, not
 * one a Mystery run still hides.
 */
export const isHunt = (run: {
  readonly goal: string;
  readonly hidden?: readonly string[];
}): boolean => run.goal === "triforce-hunt" && !run.hidden?.includes("goal");

/**
 * Whether a run counts Triforce pieces as far as the player knows: a
 * Triforce Hunt, or a Ganonhunt, whose Ganon wants them (the grid's pieces
 * cell, `triforce`).
 */
export const hasPieces = (run: {
  readonly goal: string;
  readonly hidden?: readonly string[];
}): boolean =>
  (run.goal === "triforce-hunt" || run.goal === "ganonhunt") &&
  !run.hidden?.includes("goal");

type GridRun = {
  readonly mode: string;
  readonly goal?: string;
  readonly hidden?: readonly string[];
};

/**
 * The cells a run adds under the board, centred: a retro run's shops that
 * sell arrows and keys, a Triforce Hunt's pieces between them.
 */
const extrasOf = (run: GridRun): string[] => {
  const retro = run.mode === "retro";
  const hunt = run.goal !== undefined && hasPieces({ ...run, goal: run.goal });
  return [
    ...(retro ? ["shoparrow"] : []),
    ...(hunt ? [PIECES_ITEM] : []),
    ...(retro ? ["shopkey"] : []),
  ];
};

/** A row `width` wide with `cells` in its middle, a gap either side. */
const centred = (cells: string[], width: number): string[] => {
  const before = Math.floor((width - cells.length) / 2);
  return Array.from({ length: width }, (_, index) =>
    index >= before && index < before + cells.length
      ? (cells[index - before] ?? "")
      : "",
  );
};

/**
 * The item grid of a run: a retro run adds a row under the grid with the
 * shops that sell arrows and keys, a Triforce Hunt one with the pieces found
 * (both share one row), centred.
 * @param run - The run's world and goal
 */
export const itemGridFor = (run: GridRun): string[][] => {
  const extras = extrasOf(run);
  const key = extras.join(" ");
  // One array per kind of run, so a store selector returning it is stable
  let grid = GRIDS.get(key);
  if (grid === undefined) {
    grid =
      extras.length > 0
        ? [...defaultItemGrid, centred(extras, ITEM_ROWS[0]?.length ?? 7)]
        : defaultItemGrid;
    GRIDS.set(key, grid);
  }
  return grid;
};

const GRIDS = new Map<string, string[][]>();

/** The stream view's columns, twelve; thirteen with Hyrule Castle's keys. */
const STREAM_COLUMNS = 12;

/**
 * The stream view's band, row by row, twelve wide: the equipment and the
 * bow, the Y items, the rest of the items with the crystals held and asked
 * for, then the dungeons from Castle Tower to Ganon's Tower, their key cells
 * under them while those show, Hyrule Castle's at the end (its name over
 * them). The pendants, which each dungeon's prize already shows, are left
 * out. Narrow (a phone following the run), each row is cut in two halves of
 * six, the key cells kept under their dungeons (the dungeons' second half
 * seven wide while they show: Hyrule Castle's at its end).
 * @param run - The run's world and goal
 * @param keys - Whether the key cells show
 * @param narrow - Six columns rather than twelve
 */
export const streamGridFor = (
  run: GridRun,
  keys: boolean,
  narrow = false,
): string[][] => {
  const castle = keys ? ["keylabel10"] : [];
  const rows: string[][] = [
    [
      "sword",
      "shield",
      "tunic",
      "glove",
      "boots",
      "flippers",
      "moonpearl",
      "magic",
      "bow",
      "boomerang",
      "hookshot",
      "bombcapacity",
    ],
    [
      "mushroom",
      "powder",
      "firerod",
      "icerod",
      "bombos",
      "ether",
      "quake",
      "lantern",
      "hammer",
      "shovel",
      "flute",
      "net",
    ],
    [
      "book",
      "somaria",
      "byrna",
      "cape",
      "mirror",
      ...BOTTLE_SLOTS,
      "crystals",
      "goaltower",
      "goalganon",
    ],
  ];
  const dungeons = [
    "agahnim",
    ...Array.from({ length: 10 }, (_, index) => `boss${index}`),
    "boss12",
    ...castle,
  ];
  const keyCells = [
    "keys11",
    ...Array.from({ length: 10 }, (_, index) => `keys${index}`),
    "keys12",
    ...(keys ? ["keys10"] : []),
  ];
  const extras = extrasOf(run);
  if (!narrow) {
    const width = STREAM_COLUMNS + castle.length;
    return [
      ...rows.map((row) => [...row, ...castle.map(() => "")]),
      dungeons,
      keyCells,
      ...(extras.length > 0 ? [centred(extras, width)] : []),
    ];
  }
  const half = STREAM_COLUMNS / 2;
  const halves = (row: string[]) => [row.slice(0, half), row.slice(half)];
  const [dungeonsA = [], dungeonsB = []] = halves(dungeons);
  const [keysA = [], keysB = []] = halves(keyCells);
  return [
    ...rows.flatMap(halves),
    dungeonsA,
    keysA,
    dungeonsB,
    keysB,
    ...(extras.length > 0 ? [centred(extras, half)] : []),
  ];
};

/**
 * The items that count levels but whose cell is a plain toggle: the half magic
 * (1) is held or not. A quarter magic (2), which only a customized seed gives
 * and autotracking reads, is kept as it is for the logic and drawn as the half.
 */
export const TOGGLE_ITEMS: ReadonlySet<string> = new Set(["magic"]);

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
  // More values no cell draws, which autotracking alone sets
  // (logic/packItems.ts): Standard's escape (0 not known, counted done; 1
  // Zelda not yet in the Sanctuary; 2 done), the flute activated (1), and
  // the prizes Link holds by class, whichever dungeon gave them: the green
  // pendant, the two others, the crystals counted (never told 5/6)
  escape: [0, 2],
  fluteactive: [0, 3],
  glove: [0, 2],
  // The Triforce pieces a hunt asks for, 20 unless the seed says (autotracking
  // reads the ROM's GoalItemRequirement), and the pieces found (GoalCounter);
  // 50 is ganonhunt's pool, the most any goal holds (config/alttp.php:44-50)
  goalpieces: [1, 50, 20],
  // The heart pieces toward the next heart, 0 to 3, as the game's menu
  // shows them (HeartPieceQuarter): read beside `hearts`, which they never
  // reach a whole heart of (heartsAfter)
  heartquarters: [0, 3],
  // Link's hearts on screen, less 2: 0 not set (unknown to the logic), 1 the
  // 3 hearts every run starts with, 18 the 20 a full pool reaches
  // (heartsShown)
  hearts: [0, 18],
  heldcrystals: [0, 7],
  heldgreen: [0, 1],
  heldpendants: [0, 2],
  // 1 the half magic, 2 the quarter, which only a customized seed gives
  magic: [0, 2],
  shield: [0, 3],
  sword: [0, 4],
  // The Ten Bombs (the escape's), which no cell draws: 0 not known, 1 none
  // found, 2 found; autotracking reads it
  tenbombs: [0, 2],
  triforce: [0, 50],
  tunic: [1, 3],

  // What each bottle holds (BOTTLE_CONTENTS: 0 empty), drawn while the
  // `bottle` count says it is there: a save made before them reads its
  // bottles empty, as their cell drew them
  ...Object.fromEntries(
    BOTTLE_SLOTS.map((slot) => [slot, [0, BOTTLE_CONTENTS.length - 1]]),
  ),
  // The bomb and arrow capacities, flatly (CAPACITIES): what a run starts
  // with, up to what a byte of the game may hold that the cell can draw
  arrowcapacity: [0, 99, 30],
  bombcapacity: [0, 99, 10],

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
  // The boss the player knows a dungeon holds under boss shuffle: 0 not
  // known, then the pack's SHUFFLED_BOSSES from 1 (logic/knownBosses.ts)
  ...perDungeon("knownboss", () => [0, 10]),
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

/**
 * Link's health as the hearts counter holds it: the `hearts` value (0 not
 * set) and `heartquarters`, the pieces toward the next heart.
 */
export interface Hearts {
  readonly hearts: number;
  readonly quarters: number;
}

/** A run's hearts and quarters, the quarters 0 while the hearts are not set. */
export const heartsOf = (
  items: Readonly<Partial<Record<string, number | boolean>>>,
): Hearts => {
  const hearts = Number(items.hearts ?? 0);
  const quarters = Number(items.heartquarters ?? 0);
  return {
    hearts,
    quarters:
      hearts > 0 && hearts < itemsMax.hearts
        ? Math.max(0, Math.min(itemsMax.heartquarters, quarters))
        : 0,
  };
};

/** How the hearts counter moves: a step, or a whole heart or a piece found. */
export type HeartsChange = "back" | "forward" | "heart" | "piece";

/**
 * The hearts counter once changed, as the game counts: a piece is a
 * quarter, and the fourth makes the next heart (HeartPieceQuarter wraps to 0
 * as MaximumHealth gains one). A step (`forward`, `back`: a click, a
 * right-click, a shortcut) moves a quarter; from not set, forward is the 3
 * hearts Link starts with, and back from those is not set again. It stops
 * at not set and at 20 hearts, never wrapping round. What a player finds
 * (`heart`, `piece`, said by voice) never takes one away: from not set it
 * is the 3 hearts and the find, a heart keeps the quarters held.
 * @param from - The counter now
 * @param change - What moves it
 */
export const heartsAfter = (from: Hearts, change: HeartsChange): Hearts => {
  const top = itemsMax.hearts;
  const quarters = (total: number): Hearts =>
    Math.floor(total / 4) >= top
      ? { hearts: top, quarters: 0 }
      : { hearts: Math.floor(total / 4), quarters: total % 4 };
  const total = from.hearts * 4 + from.quarters;
  switch (change) {
    case "forward":
      if (from.hearts === 0) return { hearts: 1, quarters: 0 };
      return from.hearts >= top ? from : quarters(total + 1);
    case "back":
      if (from.hearts === 0) return from;
      return total - 1 < 4 ? { hearts: 0, quarters: 0 } : quarters(total - 1);
    case "heart":
      return from.hearts === 0
        ? { hearts: heartsValue(STARTING_HEARTS + 1), quarters: 0 }
        : quarters(total + 4);
    case "piece":
      return quarters((from.hearts === 0 ? 4 : total) + 1);
  }
};

/**
 * What the hearts counter says, for its name: "13", "13 and 2 quarters",
 * or null while not set.
 * @param hearts - The counter
 */
export const heartsText = ({ hearts, quarters }: Hearts): string | null => {
  const shown = heartsShown(hearts);
  if (shown === null) return null;
  if (quarters === 0) return `${shown}`;
  return `${shown} and ${quarters} ${quarters === 1 ? "quarter" : "quarters"}`;
};

/** The bottle slot (1-4) a `bottlecontentsN` id names, or null. */
export const bottleSlotOf = (id: string): number | null => {
  const slot = BOTTLE_SLOTS.indexOf(id as (typeof BOTTLE_SLOTS)[number]);
  return slot < 0 ? null : slot + 1;
};

/**
 * The items a bottle count sets: the count, and the contents of the bottles
 * it no longer holds back to empty, so a bottle found again is not drawn
 * with what an earlier one held.
 * @param items - The run's items
 * @param count - The bottles held, 0 to 4
 */
export const withBottleCount = (
  items: Readonly<Partial<Record<string, number | boolean>>>,
  count: number,
): Record<string, number> => {
  const change: Record<string, number> = { bottle: count };
  BOTTLE_SLOTS.forEach((slot, index) => {
    if (index + 1 > count && Number(items[slot] ?? 0) !== 0) change[slot] = 0;
  });
  return change;
};

/**
 * A bottle cell's step, as the items it changes, or null when it changes
 * nothing. The game fills its bottles in order, so a bottle is there while
 * its slot is within the `bottle` count. Forward on a bottle not there finds
 * the bottles up to it, every one empty, whatever a slot past the count still
 * held (a count lowered by the game's reading keeps no contents beyond it);
 * on one there, the next content, round from the last to empty. Back on one
 * there, the content before; from empty, that bottle and those after it go.
 * Back on one not there changes nothing.
 * @param items - The run's items
 * @param slot - The bottle, 1 to 4
 * @param direction - 1 forward (a click), -1 back (a right-click, "-")
 */
export const bottleAfter = (
  items: Readonly<Partial<Record<string, number | boolean>>>,
  slot: number,
  direction: 1 | -1,
): Record<string, number> | null => {
  const id = BOTTLE_SLOTS[slot - 1];
  if (id === undefined) return null;
  const count = Number(items.bottle ?? 0);
  const content = Number(items[id] ?? 0);
  if (slot > count) {
    if (direction < 0) return null;
    const found: Record<string, number> = { bottle: slot };
    BOTTLE_SLOTS.forEach((other, index) => {
      if (index >= count && index < slot) found[other] = 0;
    });
    return { ...withBottleCount(items, slot), ...found };
  }
  if (direction > 0) return { [id]: (content + 1) % BOTTLE_CONTENTS.length };
  if (content > 0) return { [id]: content - 1 };
  return withBottleCount(items, slot - 1);
};

/**
 * A capacity's value once stepped: 5 more, round from the most a seed gives
 * to the start, or 5 fewer, round from the start to the most. A value off
 * those steps (a customized seed's, read from the game) steps from the
 * nearest one.
 * @param id - `bombcapacity` or `arrowcapacity`
 * @param value - The capacity now
 * @param direction - 1 forward, -1 back
 */
export const capacityAfter = (
  id: string,
  value: number,
  direction: 1 | -1,
): number => {
  const range = CAPACITIES[id];
  if (range === undefined) return value;
  const { start, top } = range;
  const step = Math.round((Math.min(top, Math.max(start, value)) - start) / 5);
  const steps = (top - start) / 5 + 1;
  return start + ((step + direction + steps) % steps) * 5;
};

/** The prizes Link holds: the green pendant, the other two, the crystals. */
export interface PrizesHeld {
  readonly green: number;
  readonly pendants: number;
  readonly crystals: number;
}

/**
 * The prizes Link holds, as the board knows them: each beaten boss's prize
 * the player marked (`rewardN`: 1 the green pendant, 2 another pendant, 3 a
 * crystal, 4 a 5/6 crystal), or what autotracking read by class
 * (`heldgreen`, `heldpendants`, `heldcrystals`) when it says more.
 * @param items - The run's items
 */
export const prizesHeld = (
  items: Readonly<Partial<Record<string, number | boolean>>>,
): PrizesHeld => {
  let green = 0;
  let pendants = 0;
  let crystals = 0;
  DUNGEON_CHEST_COUNTS.forEach((_, index) => {
    if (items[`boss${index}`] !== 2) return;
    const reward = Number(items[`reward${index}`] ?? 0);
    if (reward === 1) green += 1;
    else if (reward === 2) pendants += 1;
    else if (reward >= 3) crystals += 1;
  });
  return {
    crystals: Math.max(crystals, Number(items.heldcrystals ?? 0)),
    green: Math.max(green, Number(items.heldgreen ?? 0)),
    pendants: Math.max(pendants, Number(items.heldpendants ?? 0)),
  };
};

/** The most crystals a goal can ask for. */
export const CRYSTALS = 7;

/**
 * The crystals a goal asks for once a goal cell is stepped, wrapping round
 * from 7 to 0: as a sign in the game is read, from none up. Not known yet
 * (a Mystery run's), forward is none and back is all seven.
 * @param asked - The crystals asked for now, or null while not known
 * @param direction - 1 forward, -1 back
 */
export const crystalGoalAfter = (
  asked: number | null,
  direction: 1 | -1,
): number => {
  if (asked === null) return direction > 0 ? 0 : CRYSTALS;
  return (asked + direction + CRYSTALS + 1) % (CRYSTALS + 1);
};

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
  arrowcapacity: "Arrow capacity",
  bombcapacity: "Bombs",
  bombos: "Bombos Medallion",
  book: "Book of Mudora",
  boots: "Pegasus Boots",
  bottlecontents1: "Bottle 1",
  bottlecontents2: "Bottle 2",
  bottlecontents3: "Bottle 3",
  bottlecontents4: "Bottle 4",
  byrna: "Cane of Byrna",
  cape: "Magic Cape",
  escape: "Zelda's escape",
  ether: "Ether Medallion",
  firerod: "Fire Rod",
  flippers: "Zora's Flippers",
  fluteactive: "Flute (activated)",
  glove: "Power Glove",
  goalpieces: "Triforce pieces asked for",
  heartquarters: "Heart pieces",
  hearts: "Hearts",
  heldcrystals: "Crystals held",
  heldgreen: "Pendant of Courage held",
  heldpendants: "Other pendants held",
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
  triforce: "Triforce pieces",
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

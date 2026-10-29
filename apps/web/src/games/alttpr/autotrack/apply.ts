// What a reading of the game means for the board, and how it is laid on it.
//
// A reading becomes a view: for each value of the run the game settles,
// what the game says of it. Items, bosses, prizes and checked locations are
// values, the small keys found among them (the base patch counts each key
// received as an item, which no door spends); a dungeon's counter is a
// range, since the game says which of its locations are checked but not
// always whether each held an item.
//
// The view is laid on the board in one of two ways. A merge moves the board
// only towards progress: it raises an item, checks a location, lowers a
// counter, and never undoes a mark the player set beyond the game (players
// mark what they saw before the game shows it). A sync sets every value the
// game settles to what it says, the player's marks beyond it included.
// What the game leaves unknown (Race Mode, a range not read yet) is never
// touched by either.

import {
  BOSS_PLACES,
  type BossDungeon,
  CHECK_FLAGS,
  type DungeonId,
  dungeon,
  dungeonLocations,
  dungeonPool,
  type HeldPrize,
  LEGACY_DUNGEONS,
  MAP_LOCATIONS,
  PRIZES,
  type Prize,
  type PrizeDungeon,
} from "@alltp/pack-alttpr";
import type { AutotrackReading } from "@/games/alttpr/autotrack/reading";
import {
  BEATEN_CELLS,
  type CellValue,
  cellsFromPack,
  joinHearts,
  joinValues,
  mostShown,
  PRIZE_CELLS,
  prizeOf,
} from "@/games/alttpr/autotrack/table";
import { DUNGEON_INDICES, MEDALLION_VALUES } from "@/games/alttpr/constants";
import {
  BOTTLE_SLOTS,
  type Hearts,
  heartsOf,
  heartsValue,
} from "@/games/alttpr/data/items";
import { bossesMayMove, wildItems } from "@/games/alttpr/data/presets";
import { knownBossCell, valueOfBoss } from "@/games/alttpr/logic/knownBosses";
import { ACTIVATION, ESCAPE } from "@/games/alttpr/logic/packItems";
import {
  COUNTER_INDICES,
  counterMax,
  dungeonAt,
  KEY_DUNGEONS,
  packSettings,
  smallKeysMax,
  worldOf,
} from "@/games/alttpr/logic/settings";
import type { Progress } from "@/games/alttpr/stores/persistence";

/** The slices of the run the game's view is laid on. */
export type Board = Pick<
  Progress,
  "checked" | "items" | "medallions" | "settings" | "smallKeys"
>;

/** What the game says of the run: the values it settles, by the run's ids. */
export type GameView = {
  /** The run's settings, as the pack has them, the view was taken for. */
  readonly settings: ReturnType<typeof packSettings>;
  /** The value each cell shows for what the game holds, by item id. */
  readonly items: Readonly<Record<string, CellValue>>;
  /**
   * The items a dungeon's counter (`chest3`) can have left, from the least
   * to the most: the same in Full Shuffle, where each location counts.
   */
  readonly counters: Readonly<Record<string, readonly [number, number]>>;
  /** Whether each location the game settles is checked, by pack id. */
  readonly checked: Readonly<Record<string, boolean>>;
  /**
   * The small keys found, by key dungeon index: only while small keys leave
   * their dungeons (MCS and Full Shuffle).
   */
  readonly smallKeys: Readonly<Record<number, number>>;
  /**
   * The medallions the game has shown, as `medallions[n]` holds them
   * (`MEDALLION_VALUES`), by grid dungeon index: Misery Mire's and Turtle
   * Rock's.
   */
  readonly medallions: Readonly<Record<number, number>>;
};

/** The event that sells the big bomb, which no flag keeps (check-flags.ts). */
const BOMB_MERCHANT = "bomb-merchant";

/** The locations whose flag the game keeps, on the map. */
const FLAGGED = CHECK_FLAGS.map(({ id }) => id).filter((id) =>
  MAP_LOCATIONS.has(id),
);

/** The grid's dungeons, by index, with their item code. */
const GRID = LEGACY_DUNGEONS.map((id, index) => ({
  // The grid's ten all have a boss, which their code says
  code: dungeon(id).code as BossDungeon,
  id,
  index,
}));

/**
 * The dungeons with a counter (COUNTER_INDICES): the grid's ten and Ganon's
 * Tower, by key index, with their item code.
 */
const COUNTED = COUNTER_INDICES.map((index) => {
  const id = dungeonAt(index);
  return { code: dungeon(id).code, id, index };
});

/** The prize classes, as the pack's PRIZES lists them. */
const PRIZE_CLASSES = Object.keys(PRIZES) as Prize[];

/**
 * The game's item counts as the board shows them, where the rules read two
 * alike: the second progressive bow is the silver bow, which a board that
 * shows no bow beyond the first shows as the bow with its silver arrows
 * (the pack's canShootArrows2, `bow >= 2 | silverArrowUpgrade & bow`).
 */
const asShown = (counts: Readonly<Record<string, number>>) => {
  const most = mostShown("bow");
  if ((counts.bow ?? 0) <= most || !("silverArrowUpgrade" in counts)) {
    return counts;
  }
  return {
    ...counts,
    bow: most,
    silverArrowUpgrade: Math.max(counts.silverArrowUpgrade, 1),
  };
};

/**
 * The prizes the game shows (the pack's decodePrizes: a finished dungeon's,
 * and those the world map draws), as the values of the prize cells the
 * board names no prize for: a prize the player named stays theirs.
 */
const shownCells = (
  reading: AutotrackReading,
  board: Board,
): Record<string, CellValue> => {
  const { prizes } = reading;
  const told: Record<string, CellValue> = {};
  if (typeof prizes === "string") return told;
  for (const cell of PRIZE_CELLS) {
    const code = dungeon(cell.dungeon).code as PrizeDungeon;
    const prize = prizes[code]?.prize;
    if (prize === undefined) continue;
    if (prizeOf(cell, board.items[cell.id]) !== undefined) continue;
    const value = cell.values[prize];
    if (value !== undefined) told[cell.id] = value;
  }
  return told;
};

/** The finished dungeons' prizes that only one class fits. */
const byElimination = (
  reading: AutotrackReading,
  board: Board,
  shown: Readonly<Record<string, CellValue>>,
): Record<string, CellValue> => {
  const { counts } = reading.items;
  const left = {} as Record<Prize, number>;
  for (const prize of PRIZE_CLASSES) {
    let held = 0;
    for (const item of PRIZES[prize]) {
      const count = counts[item];
      if (count === undefined) return {};
      held += count;
    }
    left[prize] = held;
  }
  const code = new Map<DungeonId, BossDungeon>(
    GRID.map(({ code, id }) => [id, code]),
  );
  const unnamed: (typeof PRIZE_CELLS)[number][] = [];
  for (const cell of PRIZE_CELLS) {
    const at = code.get(cell.dungeon);
    const done = at === undefined ? undefined : reading.progress.completed[at];
    if (typeof done !== "boolean") return {};
    if (!done) continue;
    const named = prizeOf(cell, shown[cell.id] ?? board.items[cell.id]);
    if (named === undefined) unnamed.push(cell);
    else left[named] -= 1;
  }
  const classes = PRIZE_CLASSES.filter((prize) => left[prize] !== 0);
  const [only] = classes;
  if (
    unnamed.length === 0 ||
    classes.length !== 1 ||
    left[only] !== unnamed.length
  ) {
    return {};
  }
  const told: Record<string, CellValue> = {};
  for (const cell of unnamed) {
    const value = cell.values[only];
    if (value !== undefined) told[cell.id] = value;
  }
  return told;
};

/**
 * The prizes the game tells, as prize cells' values. The ROM's prize
 * tables name each one the game shows (shownCells). Where they were not
 * read (a device that serves no ROM), memory still holds the pendants and
 * crystals in hand and the dungeons whose prize was taken, not which gave
 * which: a dungeon's prize is known when only one fits. The prizes the
 * board already names for finished dungeons are taken as given, and so are
 * those the tables told; the dungeons finished with no prize named share
 * what is left, which they can only do one way when it is all of one class
 * (the first dungeon finished, or two red crystals). Race Mode names no
 * dungeon's prize: it reads no prize table and no crystal's number, and
 * v2.0 forbids tying an item to a location (the prizes held reach the
 * rules without a dungeon: `heldCells`).
 */
const prizeCells = (
  reading: AutotrackReading,
  board: Board,
): Record<string, CellValue> => {
  if (reading.race) return {};
  const shown = shownCells(reading, board);
  return { ...byElimination(reading, board, shown), ...shown };
};

/** The cells no one draws that hold the prizes held, by class. */
const HELD_CELLS = {
  crystal: "heldcrystals",
  greenPendant: "heldgreen",
  pendant: "heldpendants",
} as const satisfies Readonly<Record<HeldPrize, string>>;

/**
 * The pendants and crystals Link holds by class (the pack's
 * decodePrizesHeld), Race Mode or not, as the cells that carry them to the
 * rules: the crystals as a count, which makes a crystal red to the rules
 * only when there are more crystals than regular ones.
 */
const heldCells = (reading: AutotrackReading): Record<string, CellValue> => {
  const { held } = reading;
  if (typeof held === "string") return {};
  return Object.fromEntries(
    (Object.keys(HELD_CELLS) as HeldPrize[]).map((prize) => [
      HELD_CELLS[prize],
      held[prize],
    ]),
  );
};

/**
 * Standard's escape, outside Race Mode: 2 once Zelda is in the Sanctuary, 1
 * before. In Race Mode 0, not known (v2.0 forbids telling Zelda's rescue in
 * a race): the escape counts done, as by hand, whatever a reading before
 * the race said.
 */
const escapeCells = (reading: AutotrackReading): Record<string, CellValue> => {
  if (reading.race) return { escape: ESCAPE.NOT_KNOWN };
  const { rescueZelda } = reading.progress;
  if (typeof rescueZelda !== "boolean") return {};
  return { escape: rescueZelda ? ESCAPE.DONE : ESCAPE.GOING };
};

/** The bosses the game tells, as their cells' values. */
const beatenCells = (reading: AutotrackReading): Record<string, CellValue> => {
  const cells: Record<string, CellValue> = {};
  for (const cell of BEATEN_CELLS) {
    const beaten = (
      reading.progress.bosses as Readonly<Record<string, unknown>>
    )[dungeon(cell.dungeon).code];
    if (typeof beaten === "boolean") {
      cells[cell.id] = beaten ? cell.at : cell.alive;
    }
  }
  return cells;
};

/** The pads' slots in the board's `medallions`, and the value each medallion has. */
const PAD_SLOTS = [
  ["mire", DUNGEON_INDICES.MISERY_MIRE],
  ["turtleRock", DUNGEON_INDICES.TURTLE_ROCK],
] as const;

const MEDALLION_VALUE = {
  bombos: MEDALLION_VALUES.BOMBOS,
  ether: MEDALLION_VALUES.ETHER,
  quake: MEDALLION_VALUES.QUAKE,
} as const;

/**
 * The medallions the game shows now (the pack's decodeMedallions: a pad
 * whose screen is in view, or whose entrance is open), as the values of
 * `medallions`, by slot. A later reading, away from the pad, shows none:
 * the follower keeps what was shown.
 */
export const medallionsShown = (
  reading: AutotrackReading,
): Record<number, number> => {
  const told: Record<number, number> = {};
  const { medallions } = reading;
  if (typeof medallions === "string") return told;
  for (const [pad, slot] of PAD_SLOTS) {
    const shown = medallions[pad];
    if (shown !== undefined) told[slot] = MEDALLION_VALUE[shown.medallion];
  }
  return told;
};

/**
 * The bosses the game shows now (the pack's decodeBosses: Link in a
 * dungeon's boss room with its boss), as the values of the known boss
 * cells, by item id. A later reading, out of the room, shows none: the
 * follower keeps what was shown, as it keeps the medallions.
 */
export const bossesShown = (
  reading: AutotrackReading,
): Record<string, number> => {
  const told: Record<string, number> = {};
  const { bosses } = reading;
  if (typeof bosses === "string") return told;
  for (const [place, boss] of Object.entries(bosses)) {
    const { dungeon: id } = BOSS_PLACES[place as keyof typeof BOSS_PLACES];
    const index = (LEGACY_DUNGEONS as readonly string[]).indexOf(id);
    if (index >= 0 && boss !== undefined) {
      told[knownBossCell(index)] = valueOfBoss(boss);
    }
  }
  return told;
};

/** The hearts counter's two values from the game's health. */
const healthCells = (health: {
  readonly hearts: number;
  readonly quarters: number;
}): Record<string, CellValue> => {
  const held = heartsOf({
    heartquarters: health.quarters,
    hearts: heartsValue(health.hearts),
  });
  return { heartquarters: held.quarters, hearts: held.hearts };
};

/**
 * What each bottle Link has holds, in its slot's cell. The cells of bottles
 * he has not found are left alone: the game says nothing of them.
 */
const bottleCells = (
  bottles: AutotrackReading["bottles"],
): Record<string, CellValue> =>
  typeof bottles === "string"
    ? {}
    : Object.fromEntries(
        bottles
          .slice(0, BOTTLE_SLOTS.length)
          .map((content, index) => [BOTTLE_SLOTS[index], content]),
      );

/**
 * The bomb and arrow capacities, as the game holds them. Race Mode never
 * reads them (the pack's `capacities`: v2.0 does not name them), so they
 * are the player's there.
 */
const capacityCells = (
  capacities: AutotrackReading["capacities"],
): Record<string, CellValue> =>
  typeof capacities === "string"
    ? {}
    : { arrowcapacity: capacities.arrows, bombcapacity: capacities.bombs };

/** The board's cells the game settles, and the value each shows. */
export const gameCells = (
  reading: AutotrackReading,
  board: Board,
): Record<string, CellValue> => ({
  ...cellsFromPack(asShown(reading.items.counts as Record<string, number>)),
  ...beatenCells(reading),
  ...prizeCells(reading, board),
  ...heldCells(reading),
  ...escapeCells(reading),
  // The hearts on screen and the pieces toward the next, which Race Mode
  // reads too (v2.0's heart count and heart piece count)
  ...(typeof reading.health === "object" ? healthCells(reading.health) : {}),
  // What the bottles hold, Race Mode too (v2.0: "bottle contents"), and the
  // capacities, outside it
  ...bottleCells(reading.bottles),
  ...capacityCells(reading.capacities),
  // The Triforce pieces found, Race Mode too (v2.0 lists them as items), and
  // the pieces the ROM asks for, which the seed's settings state outside it
  ...(typeof reading.pieces === "number" ? { triforce: reading.pieces } : {}),
  ...(reading.seed.goalPieces?.known
    ? { goalpieces: reading.seed.goalPieces.value }
    : {}),
  // Race Mode reads the flute, never whether it was activated: the rules
  // read that as not known, maybe at most (the pack's unknown counts)
  ...(reading.race ? { fluteactive: ACTIVATION.UNKNOWN } : {}),
});

/**
 * The small keys found, by key dungeon index, where memory tells. Never
 * with generic keys (retro): those belong to no dungeon, and the one byte
 * that rises there, Tower of Hera's, would only say where a generic key was
 * taken (its basement cage, which the base patch counts whatever the key).
 */
const keysFound = (reading: AutotrackReading): Record<number, number> => {
  const found: Record<number, number> = {};
  KEY_DUNGEONS.forEach((id, index) => {
    const count = (reading.items.counts as Readonly<Record<string, number>>)[
      `key${dungeon(id).code}`
    ];
    if (count !== undefined)
      found[index] = Math.min(count, smallKeysMax(index));
  });
  return found;
};

const locationsOf = new Map<string, readonly string[]>();

/** A grid dungeon's item locations under the run's settings. */
const dungeonLocationsOf = (
  id: DungeonId,
  settings: GameView["settings"],
): readonly string[] => {
  const key = `${worldOf(settings)}/${id}`;
  let found = locationsOf.get(key);
  if (found === undefined) {
    found = dungeonLocations(dungeon(id), settings);
    locationsOf.set(key, found);
  }
  return found;
};

/**
 * The items each dungeon counter can have left, from its checked locations
 * and the dungeon's own items the player holds. In Full Shuffle each
 * location counts: the counter is exact. Otherwise the dungeon items that
 * stay inside (its map, compass, big key and small keys, as the run's
 * dungeon items leave them) are no items to the player: memory tells all
 * four, the small keys by the base patch's count of keys received as items
 * (a key an enemy or a pot drops is no location, and is not counted).
 * Generic keys belong to no dungeon, so their count is no dungeon's: the
 * counter then lies between the chests' keys all found and none. Only a
 * hand-made config reaches that case (`rom.genericKeys` with keys kept in
 * their dungeons): the retro world forces wild keys, which count no key
 * here.
 */
const counterRanges = (
  board: Board,
  counts: Readonly<Partial<Record<string, number>>>,
  checked: ReadonlySet<string>,
  settled: ReadonlySet<string>,
): Record<string, readonly [number, number]> => {
  const settings = packSettings(board.settings);
  const ranges: Record<string, readonly [number, number]> = {};
  for (const { code, id, index } of COUNTED) {
    const locations = dungeonLocationsOf(id, settings);
    if (!locations.every((location) => settled.has(location))) continue;
    const opened = locations.filter((location) => checked.has(location)).length;
    const pool = dungeonPool(dungeon(id));
    let ownLeast = 0;
    let ownMost = 0;
    for (const [wild, inPool, item] of [
      [settings.wildBigKeys, pool.bigKey, `bigKey${code}`],
      [settings.wildMaps, pool.map, `map${code}`],
      [settings.wildCompasses, pool.compass, `compass${code}`],
      [
        settings.wildKeys,
        pool.smallKeys,
        settings.genericKeys ? null : `key${code}`,
      ],
    ] as const) {
      if (wild) continue;
      const held = item === null ? undefined : counts[item];
      ownLeast += held ?? 0;
      ownMost += held ?? inPool;
    }
    const max = counterMax(index, board.settings);
    const left = (own: number) =>
      Math.max(0, Math.min(max, max - (opened - Math.min(opened, own))));
    ranges[`chest${index}`] = [left(ownLeast), left(ownMost)];
  }
  return ranges;
};

/**
 * What the game says of the board, from a reading of it.
 * @param reading - The game, decoded
 * @param board - The run it is laid on: its settings, and the prizes it
 * already names
 * @param medallionsKept - The medallions shown at earlier readings, by slot:
 * once shown, a medallion stays known whatever the screen in view
 * @param bombBought - Whether a reading of this session saw Link carry the
 * big bomb, which only its purchase gives him: Inverted's Bomb Merchant is
 * checked then, and stays so (memory keeps no flag of it)
 * @param bossesKept - The bosses shown at earlier readings, by known boss
 * cell: once met, a boss stays known out of its room. Laid only in a run
 * whose bosses may move: elsewhere every boss is the dungeon's own
 */
export const gameView = (
  reading: AutotrackReading,
  board: Board,
  medallionsKept: Readonly<Record<number, number>> = {},
  bombBought = false,
  bossesKept: Readonly<Record<string, number>> = {},
): GameView => {
  const isChecked = new Set(reading.checked);
  const unsettled = new Set(reading.unsettled.map(([id]) => id));
  const checked: Record<string, boolean> = {};
  for (const id of FLAGGED) {
    if (!unsettled.has(id)) checked[id] = isChecked.has(id);
  }
  // Only Inverted's map has the Bomb Merchant (the pack's INVERTED_MARKERS)
  if (bombBought && worldOf(packSettings(board.settings)) === "inverted") {
    checked[BOMB_MERCHANT] = true;
  }
  const smallKeys =
    wildItems(board.settings).keys && !packSettings(board.settings).genericKeys
      ? keysFound(reading)
      : {};
  return {
    checked,
    counters: counterRanges(
      board,
      reading.items.counts,
      isChecked,
      new Set(Object.keys(checked)),
    ),
    items: {
      ...gameCells(reading, board),
      ...(bossesMayMove(board.settings)
        ? { ...bossesKept, ...bossesShown(reading) }
        : {}),
    },
    medallions: { ...medallionsKept, ...medallionsShown(reading) },
    settings: packSettings(board.settings),
    smallKeys,
  };
};

/** The entries of `next` that `prev` does not hold as they are. */
const changed = <T>(
  prev: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
  same: (a: T, b: T) => boolean = Object.is,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => !(key in prev) || !same(prev[key] as T, value),
    ),
  );

/** The hearts counter's two values, laid together (joinHearts). */
const HEARTS_CELLS = ["hearts", "heartquarters"] as const;

/**
 * Changed items with the hearts counter whole: either of its values
 * changed brings both, which are laid together.
 */
const withHeartsWhole = (
  news: Record<string, CellValue>,
  all: Readonly<Record<string, CellValue>>,
): Record<string, CellValue> =>
  HEARTS_CELLS.some((id) => id in news)
    ? {
        ...news,
        ...Object.fromEntries(
          HEARTS_CELLS.filter((id) => id in all).map((id) => [id, all[id]]),
        ),
      }
    : news;

/**
 * What the game says now that it did not at the last view: the news a
 * merge lays on the board. A run of other settings makes every counter and
 * key count news.
 */
export const newsOf = (prev: GameView, next: GameView): GameView => {
  const sameRun = prev.settings === next.settings;
  return {
    checked: changed(prev.checked, next.checked),
    counters: sameRun
      ? changed(
          prev.counters,
          next.counters,
          (a, b) => a[0] === b[0] && a[1] === b[1],
        )
      : next.counters,
    items: withHeartsWhole(changed(prev.items, next.items), next.items),
    medallions: changed(prev.medallions, next.medallions),
    settings: next.settings,
    smallKeys: sameRun
      ? changed(prev.smallKeys, next.smallKeys)
      : next.smallKeys,
  };
};

/** Whether a view says nothing. */
export const isEmptyView = (view: GameView) =>
  Object.keys(view.items).length === 0 &&
  Object.keys(view.counters).length === 0 &&
  Object.keys(view.checked).length === 0 &&
  Object.keys(view.medallions).length === 0 &&
  Object.keys(view.smallKeys).length === 0;

/** How a value of the board moves to what the game says of it. */
type Lay = {
  item: (id: string, board: CellValue, game: CellValue) => CellValue;
  hearts: (board: Hearts, game: Hearts) => Hearts;
  counter: (board: number, least: number, most: number) => number;
  checked: (board: boolean, game: boolean) => boolean;
  keys: (board: number, game: number) => number;
  medallion: (board: number, game: number) => number;
};

/** Towards progress only: nothing the player marked beyond the game is undone. */
const MERGE: Lay = {
  checked: (board, game) => board || game,
  counter: (board, _least, most) => Math.min(board, most),
  hearts: joinHearts,
  item: joinValues,
  keys: (board, game) => Math.max(board, game),
  // A medallion the player named stays theirs, as a prize does
  medallion: (board, game) =>
    board === MEDALLION_VALUES.UNKNOWN ? game : board,
};

/**
 * To what the game says: the player's marks beyond it go. A counter stays a
 * range, since memory bounds it only.
 */
const SYNC: Lay = {
  checked: (_board, game) => game,
  counter: (board, least, most) => Math.min(most, Math.max(least, board)),
  hearts: (_board, game) => game,
  item: (_id, _board, game) => game,
  keys: (_board, game) => game,
  medallion: (_board, game) => game,
};

/** The slices of the board a view changes when laid on it, and how many values. */
export type Laid = { readonly next: Partial<Progress>; readonly count: number };

const lay = (board: Board, view: GameView, how: Lay): Laid | null => {
  const sameRun = packSettings(board.settings) === view.settings;
  let count = 0;
  let items: Record<string, CellValue> | undefined;
  const setItem = (id: string, value: CellValue) => {
    if (board.items[id] === value) return;
    items ??= { ...board.items };
    items[id] = value;
    count++;
  };
  for (const [id, game] of Object.entries(view.items)) {
    // The hearts counter's two values, laid together below
    if ((HEARTS_CELLS as readonly string[]).includes(id)) continue;
    const current = board.items[id];
    if (current !== undefined) setItem(id, how.item(id, current, game));
  }
  if (view.items.hearts !== undefined) {
    const now = heartsOf(board.items);
    const next = how.hearts(now, heartsOf(view.items));
    if (next.hearts !== now.hearts) setItem("hearts", next.hearts);
    if (next.quarters !== now.quarters) {
      setItem("heartquarters", next.quarters);
    }
  }
  if (sameRun) {
    for (const [id, [least, most]] of Object.entries(view.counters)) {
      setItem(id, how.counter(Number(board.items[id]), least, most));
    }
  }
  let checked: Record<string, true> | undefined;
  for (const [id, game] of Object.entries(view.checked)) {
    const current = board.checked[id] === true;
    const next = how.checked(current, game);
    if (next === current) continue;
    checked ??= { ...board.checked };
    if (next) checked[id] = true;
    else delete checked[id];
    count++;
  }
  let smallKeys: number[] | undefined;
  if (sameRun) {
    for (const [index, game] of Object.entries(view.smallKeys)) {
      const i = Number(index);
      const next = how.keys(board.smallKeys[i] ?? 0, game);
      if (next === board.smallKeys[i]) continue;
      smallKeys ??= [...board.smallKeys];
      smallKeys[i] = next;
      count++;
    }
  }
  let medallions: number[] | undefined;
  for (const [slot, game] of Object.entries(view.medallions)) {
    const i = Number(slot);
    const next = how.medallion(board.medallions[i] ?? 0, game);
    if (next === board.medallions[i]) continue;
    medallions ??= [...board.medallions];
    medallions[i] = next;
    count++;
  }
  if (count === 0) return null;
  return {
    count,
    next: {
      ...(items && { items: items as Progress["items"] }),
      ...(checked && { checked }),
      ...(medallions && { medallions }),
      ...(smallKeys && { smallKeys }),
    },
  };
};

/**
 * Lay a view on the board towards progress only.
 * @returns The slices it changes, or null when it changes nothing
 */
export const mergeView = (board: Board, view: GameView): Laid | null =>
  lay(board, view, MERGE);

/**
 * Set the board to what the game says, where it says it.
 * @returns The slices it changes, or null when it changes nothing
 */
export const syncView = (board: Board, view: GameView): Laid | null =>
  lay(board, view, SYNC);

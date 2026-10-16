// The board's cells as autotracking reads them from the game, through the
// app's one table of the pack's items (logic/packItems.ts, PACK_ITEMS):
// which cells the game's item counts settle and the value each then shows
// (itemsFromPack), the cells that say a boss is beaten, the prize cells and
// the value each prize takes, and how a value the player marked joins one
// the game shows. Nothing here names an item: a cell added to the table is
// read from the game with no change here.

import {
  type DungeonId,
  dungeon,
  ITEMS,
  type ItemId,
  LEGACY_DUNGEONS,
  PRIZES,
  type Prize,
} from "@alltp/pack-alttpr";
import {
  items as freshItems,
  type ItemState,
  itemsMax,
  itemsMin,
} from "@/data/items";
import {
  itemsFromPack,
  PACK_ITEMS,
  type PackItem,
  packReading,
} from "@/logic/packItems";

/** A cell's value: held or not, or a level, a count, a boss's state. */
export type CellValue = number | boolean;

/** The pack items a cell's value counts: none for a boss or a prize. */
const countedBy = (entry: PackItem): readonly string[] => {
  if (entry.kind === "count") return [entry.item];
  return entry.kind === "bits" ? entry.items : [];
};

const ENTRIES = Object.entries(PACK_ITEMS);

/**
 * The cells the game's item counts settle, and the value each shows. A cell
 * is left out while the game leaves any pack item it counts unknown (Race
 * Mode, a range not read yet).
 * @param counts - The pack items the game holds, by pack id; one left out
 * is not known
 */
export const cellsFromPack = (
  counts: Readonly<Record<string, number>>,
): Record<string, CellValue> => {
  const values = itemsFromPack(counts);
  const cells: Record<string, CellValue> = {};
  for (const [id, entry] of ENTRIES) {
    const counted = countedBy(entry);
    const value = values[id];
    if (
      counted.length > 0 &&
      counted.every((item) => item in counts) &&
      value !== undefined
    ) {
      cells[id] = value;
    }
  }
  return cells;
};

/**
 * The highest count of a pack item any cell shows: the bow cell, one bit
 * per item, shows one bow at most.
 */
export const mostShown = (item: string): number =>
  Math.max(
    0,
    ...ENTRIES.map(([id, entry]) => {
      if (entry.kind === "count" && entry.item === item) {
        return (itemsMax[id] ?? 0) - (entry.base ?? 0);
      }
      return entry.kind === "bits" && entry.items.includes(item as never)
        ? 1
        : 0;
    }),
  );

/** A cell that says a dungeon's boss is beaten, at the value `at`. */
export type BeatenCell = {
  readonly id: string;
  readonly dungeon: DungeonId;
  readonly at: number;
  /** Its value while the boss stands: a fresh run's. */
  readonly alive: CellValue;
};

/** The cells that say a boss is beaten: the grid's, both Agahnims. */
export const BEATEN_CELLS: readonly BeatenCell[] = ENTRIES.flatMap(
  ([id, entry]) =>
    entry.kind === "beaten"
      ? [{ alive: freshItems[id], at: entry.at, dungeon: entry.dungeon, id }]
      : [],
);

/** A dungeon's prize cell, and the value it takes for each prize. */
export type PrizeCell = {
  readonly id: string;
  readonly dungeon: DungeonId;
  readonly values: Readonly<Partial<Record<Prize, number>>>;
};

/** The prize cells, each value's prize read through packReading. */
export const PRIZE_CELLS: readonly PrizeCell[] = ENTRIES.flatMap(
  ([id, entry]) => {
    if (entry.kind !== "prize") return [];
    const values: Partial<Record<Prize, number>> = {};
    for (let value = itemsMin[id]; value <= itemsMax[id]; value++) {
      const prize = packReading({ [id]: value } as ItemState).prizes[
        entry.dungeon
      ];
      if (prize !== undefined) values[prize] = value;
    }
    return [{ dungeon: entry.dungeon, id, values }];
  },
);

/** The prize a prize cell's value names, if any. */
export const prizeOf = (
  cell: PrizeCell,
  value: CellValue | undefined,
): Prize | undefined =>
  (Object.keys(cell.values) as Prize[]).find(
    (prize) => cell.values[prize] === value,
  );

/**
 * The least value of a cell that holds both what the player marked and
 * what the game shows: the higher of two levels, the blue and the red
 * boomerang together, a boss beaten on either side. A prize the player
 * named stays: two prizes never join.
 * @param id - The cell's item id
 * @param board - The value the player marked
 * @param game - The value the game shows
 */
export const joinValues = (
  id: string,
  board: CellValue,
  game: CellValue,
): CellValue => {
  const entry = PACK_ITEMS[id];
  switch (entry?.kind) {
    case "count":
      return typeof board === "boolean"
        ? board || game === true
        : Math.max(board, Number(game));
    case "bits":
      return Number(board) | Number(game);
    case "beaten":
      return game === entry.at ? game : board;
    case "prize":
      return board === 0 ? game : board;
    default:
      return board;
  }
};

/**
 * The pack items the board marks from the game: those its cells count, the
 * pendants and crystals its prize cells stand for, and with keysanity the
 * small keys of the grid's dungeons.
 * @param keysanity - Whether the run's small keys are wild
 */
export const boardItems = (keysanity: boolean): ReadonlySet<ItemId> => {
  const shown = new Set<string>(
    keysanity ? LEGACY_DUNGEONS.map((id) => `key${dungeon(id).code}`) : [],
  );
  for (const [, entry] of ENTRIES) {
    for (const item of countedBy(entry)) shown.add(item);
  }
  if (PRIZE_CELLS.length > 0) {
    for (const items of Object.values(PRIZES)) {
      for (const item of items) shown.add(item);
    }
  }
  return new Set(ITEMS.map(({ id }) => id).filter((id) => shown.has(id)));
};

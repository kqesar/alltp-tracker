// A skin: a world's items drawn as a grid of the tracker's art, from the
// names AP gives them. A skin maps names to cells and nothing else: what a
// cell shows is counted from the items the server says the slot received.
// Worlds without one get the generic list (components/ItemsPanel.tsx).

import type { ApItem } from "@/games/archipelago/store";

/** A cell of a skin. */
export type SkinCell =
  | {
      readonly kind: "item";
      readonly id: string;
      readonly name: string;
      /** The AP item names it counts. */
      readonly names: readonly string[];
      /** Its level, from how many of each name the slot holds. */
      readonly level: (count: (name: string) => number) => number;
      /** Its sprite at a level, an ALttPR asset's file name. */
      readonly sprite: (level: number) => string;
      /** Its level in words, after its name. */
      readonly describe: (level: number) => string;
      /** The sprite draws the count: no number on it. */
      readonly leveled?: boolean;
      /** Never greyed: what the game starts with (Link's green mail). */
      readonly always?: boolean;
    }
  | {
      /** A dungeon's keys: its big key and its small keys, counted. */
      readonly kind: "keys";
      readonly id: string;
      readonly dungeon: string;
      /** The short name the cell shows, decorative. */
      readonly short: string;
      readonly big: string;
      readonly small: string;
    };

/** An item's cell. */
export type ItemCell = Extract<SkinCell, { readonly kind: "item" }>;

export interface Skin {
  /** The world's name, as the room's data names it. */
  readonly game: string;
  readonly columns: number;
  /** Item cells, then key cells, each kind starting a row. */
  readonly cells: readonly SkinCell[];
  /** Progression items with no cell, each with why: under "More items". */
  readonly excluded: Readonly<Record<string, string>>;
}

/** The AP names a cell counts. */
export const namesOf = (cell: SkinCell): readonly string[] =>
  cell.kind === "item" ? cell.names : [cell.big, cell.small];

/** Every name some cell of the skin counts. */
export const mappedNames = (skin: Skin): ReadonlySet<string> =>
  new Set(skin.cells.flatMap(namesOf));

/**
 * The skin's rows: its item cells, then its key cells, each kind starting a
 * row of `columns`, the last of each filled with gaps.
 */
export const rowsOf = (
  skin: Skin,
): readonly (readonly (SkinCell | null)[])[] => {
  const rows: (SkinCell | null)[][] = [];
  for (const kind of ["item", "keys"] as const) {
    const cells = skin.cells.filter((cell) => cell.kind === kind);
    for (let i = 0; i < cells.length; i += skin.columns) {
      const row: (SkinCell | null)[] = cells.slice(i, i + skin.columns);
      while (row.length < skin.columns) row.push(null);
      rows.push(row);
    }
  }
  return rows;
};

/** How many of each name the slot holds. */
export const countsOf = (items: readonly ApItem[]) => {
  const counts = new Map(items.map((item) => [item.name, item.count]));
  return (name: string) => counts.get(name) ?? 0;
};

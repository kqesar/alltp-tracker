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
  readonly cells: readonly SkinCell[];
  /**
   * The grid, row by row, by cell id: every row `columns` long and every cell
   * once (the skin's spec holds it), so no row is left half empty.
   */
  readonly layout: readonly (readonly string[])[];
  /** Progression items with no cell, each with why: under "More items". */
  readonly excluded: Readonly<Record<string, string>>;
}

/** The AP names a cell counts. */
export const namesOf = (cell: SkinCell): readonly string[] =>
  cell.kind === "item" ? cell.names : [cell.big, cell.small];

/** Every name some cell of the skin counts. */
export const mappedNames = (skin: Skin): ReadonlySet<string> =>
  new Set(skin.cells.flatMap(namesOf));

/** The skin's rows of cells, as its layout lays them. */
export const rowsOf = (skin: Skin): readonly (readonly SkinCell[])[] => {
  const byId = new Map(skin.cells.map((cell) => [cell.id, cell]));
  return skin.layout.map((row) =>
    row.map((id) => {
      const cell = byId.get(id);
      if (cell === undefined) throw new Error(`No cell ${id} in ${skin.game}`);
      return cell;
    }),
  );
};

/** How many of each name the slot holds. */
export const countsOf = (items: readonly ApItem[]) => {
  const counts = new Map(items.map((item) => [item.name, item.count]));
  return (name: string) => counts.get(name) ?? 0;
};

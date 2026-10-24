// A skin: a world's items drawn as a grid of the tracker's art, from the
// names AP gives them. A skin maps names to cells and nothing else: what a
// cell shows is counted from the items the server says the slot received.
// Worlds without one get the generic list (components/ItemsPanel.tsx). Each
// skin is a chunk of its own (worlds/skins.ts), fetched for its world only.

import type { LocationGroups } from "@/games/archipelago/datapackageCache";
import type { ApItem } from "@/games/archipelago/store";

/**
 * A cell's sprite: an ALttPR asset's file name (`public/assets/`), or a frame
 * of Map Rando's Super Metroid item sheet (`games/sm/assets/items.png`).
 */
export type SkinSprite = string | { readonly frame: number };

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
      /** Its sprite at a level. */
      readonly sprite: (level: number) => SkinSprite;
      /** Its level in words, after its name. */
      readonly describe: (level: number) => string;
      /** The sprite draws the count: no number on it. */
      readonly leveled?: boolean;
      /** Its names' count drawn on it from one (tanks, packs): a counter. */
      readonly counter?: boolean;
      /** Never greyed: what the game starts with (Link's green mail). */
      readonly always?: boolean;
      /**
       * The most of each name a world's pool holds, where AP's world fixes
       * it; a name left out is open-ended (packs, tanks: options set them).
       */
      readonly caps: Readonly<Record<string, number>>;
    }
  | {
      /** A dungeon's keys: its big key, its small keys counted; either may not exist. */
      readonly kind: "keys";
      readonly id: string;
      readonly dungeon: string;
      /** The short name the cell shows, decorative. */
      readonly short: string;
      readonly big?: string;
      readonly small?: string;
    }
  | {
      /** An area's keycards (SMZ3's Super Metroid under keysanity), each lit once held. */
      readonly kind: "cards";
      readonly id: string;
      readonly area: string;
      /** The short name the cell shows, decorative. */
      readonly short: string;
      /** Its cards in the game's order: the AP name, the level's mark and words. */
      readonly cards: readonly {
        readonly name: string;
        readonly mark: string;
        readonly level: string;
      }[];
    };

/** An item's cell. */
export type ItemCell = Extract<SkinCell, { readonly kind: "item" }>;

/** A grid's rows, by cell id. */
export type Layout = readonly (readonly string[])[];

export interface Skin {
  /** The world's name, as the room's data names it. */
  readonly game: string;
  readonly columns: number;
  readonly cells: readonly SkinCell[];
  /**
   * The grid, row by row, by cell id: every row `columns` long and every cell
   * once (the skin's spec holds it), so no row is left half empty.
   */
  readonly layout: Layout;
  /**
   * Rows drawn under the layout once the slot holds any item they count: what
   * only some seeds send (SMZ3's keycards and Super Metroid maps, keysanity's).
   */
  readonly extraRows?: Layout;
  /** Progression items with no cell, each with why: under "More items". */
  readonly excluded: Readonly<Record<string, string>>;
  /**
   * The world's location groups as data, for a world whose AP code names
   * none (only `Everywhere`): every location in exactly one group.
   */
  readonly groups?: LocationGroups;
}

/** The AP names a cell counts. */
export const namesOf = (cell: SkinCell): readonly string[] => {
  switch (cell.kind) {
    case "item":
      return cell.names;
    case "keys":
      return [cell.big, cell.small].filter((name) => name !== undefined);
    case "cards":
      return cell.cards.map((card) => card.name);
  }
};

/** Every name some cell of the skin counts. */
export const mappedNames = (skin: Skin): ReadonlySet<string> =>
  new Set(skin.cells.flatMap(namesOf));

/** How many of each name the slot holds. */
export const countsOf = (items: readonly ApItem[]) => {
  const counts = new Map(items.map((item) => [item.name, item.count]));
  return (name: string) => counts.get(name) ?? 0;
};

/**
 * The skin's rows of cells, as its layout lays them, its extra rows too once
 * the slot holds any item they count.
 * @param count - How many of each name the slot holds; none, the layout alone
 */
export const rowsOf = (
  skin: Skin,
  count?: (name: string) => number,
): readonly (readonly SkinCell[])[] => {
  const byId = new Map(skin.cells.map((cell) => [cell.id, cell]));
  const cellsOf = (layout: Layout) =>
    layout.map((row) =>
      row.map((id) => {
        const cell = byId.get(id);
        if (cell === undefined) {
          throw new Error(`No cell ${id} in ${skin.game}`);
        }
        return cell;
      }),
    );
  const rows = cellsOf(skin.layout);
  if (skin.extraRows === undefined || count === undefined) return rows;
  const extra = cellsOf(skin.extraRows);
  const held = extra.some((row) =>
    row.some((cell) => namesOf(cell).some((name) => count(name) > 0)),
  );
  return held ? [...rows, ...extra] : rows;
};

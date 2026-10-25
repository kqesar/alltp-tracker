// What each place of the board held, in a review: the log's placements laid
// over the map's markers, the Checks list and the item grid. Worked out once
// per review (the store's `Loaded` is immutable, so a WeakMap holds the
// answer) and read through selectors that return the same object until the
// review changes: a review costs the board nothing past its first paint, and
// outside a review every hook answers null.

import {
  type AlttprSpoilerLog,
  INVERTED_MARKERS,
  type MapMarker,
} from "@alltp/pack-alttpr";
import { itemsMax, TOGGLE_ITEMS } from "@/games/alttpr/data/items";
import { PACK_ITEMS } from "@/games/alttpr/logic/packItems";
import { locationName } from "@/games/alttpr/logic/solution";
import { type Loaded, useReviewStore } from "@/review/store";

/** One location and what it held. */
export interface Held {
  readonly location: string;
  /** The location's name, as the Checks list names it. */
  readonly where: string;
  /** The pack's item id, or null for an item the board has no cell for. */
  readonly item: string | null;
  /** The item's name as the log writes it: "Progressive Sword". */
  readonly name: string;
  /** The asset the board draws the item with, or null (rupees, arrows…). */
  readonly icon: string | null;
  /** The playthrough sphere it sits in, or null for an item the win does not need. */
  readonly sphere: number | null;
  /** How notable it is: 0 required, 1 a progression item or a prize, 2 a dungeon item, 3 the rest. */
  readonly rank: number;
}

/** What a marker held, most notable first. */
export interface MarkerHeld {
  readonly held: readonly Held[];
  /** The one drawn on the marker. */
  readonly top: Held;
  /** "Bug Catching Net, Magic Powder and 3 more". */
  readonly words: string;
}

/** What a review lays on the board. */
export interface Labels {
  readonly byLocation: ReadonlyMap<string, Held>;
  readonly byMarker: ReadonlyMap<string, MarkerHeld>;
  /** The places an item of the grid was, by the tracker's item id. */
  readonly byCell: ReadonlyMap<string, readonly Held[]>;
}

/** The tracker's cell for each pack item it records, and how it draws it. */
const CELL_OF: ReadonlyMap<
  string,
  { readonly id: string; readonly icon: string }
> = (() => {
  const cells = new Map<string, { id: string; icon: string }>();
  for (const [id, entry] of Object.entries(PACK_ITEMS)) {
    if (entry.kind === "count") {
      // A leveled item is drawn at its first level, the one a find of it gives
      const leveled =
        !TOGGLE_ITEMS.has(id) &&
        (itemsMax[id] ?? 1) > 1 &&
        typeof itemsMax[id] === "number";
      cells.set(entry.item, {
        icon: leveled ? `${id}${(entry.base ?? 0) + 1}.png` : `${id}.png`,
        id,
      });
    } else if (entry.kind === "bits") {
      entry.items.forEach((item, bit) => {
        cells.set(item, { icon: `${id}${1 << bit}.png`, id });
      });
    }
  }
  return cells;
})();

/** The images a pack item has outside the grid's cells. */
const iconOf = (item: string | null): string | null => {
  if (item === null) return null;
  if (/^bigKey/.test(item)) return "bigkey.png";
  if (/^key[A-Z]\d/.test(item)) return "smallkey.png";
  if (/^compass/.test(item)) return "compass.png";
  if (/^map[A-Z]\d/.test(item)) return "dungeonmap.png";
  if (/^crystal/.test(item)) return "crystal0.png";
  if (item === "pendantOfCourage") return "pendant1.png";
  if (/^pendant/.test(item)) return "pendant2.png";
  return CELL_OF.get(item)?.icon ?? null;
};

const rankOf = (item: string | null, sphere: number | null): number => {
  if (sphere !== null) return 0;
  if (item === null) return 3;
  if (CELL_OF.has(item) || /^(crystal|pendant)/.test(item)) return 1;
  return iconOf(item) === null ? 3 : 2;
};

const byNotable = (a: Held, b: Held): number =>
  a.rank - b.rank ||
  (a.sphere ?? Number.POSITIVE_INFINITY) -
    (b.sphere ?? Number.POSITIVE_INFINITY) ||
  a.where.localeCompare(b.where);

/** What a marker held, in words: "A and B", "A, B and 3 more". */
const wordsOf = (held: readonly Held[]): string => {
  const names = held.slice(0, 2).map(({ name }) => name);
  const more = held.length - names.length;
  if (more > 0) return `${names.join(", ")} and ${more} more`;
  return names.join(" and ");
};

/** What every placement of a log held, laid on the board's places. */
export const labelsOfLog = (log: AlttprSpoilerLog): Labels => {
  const byLocation = new Map<string, Held>();
  for (const p of log.placements) {
    byLocation.set(p.location, {
      icon: iconOf(p.item),
      item: p.item,
      location: p.location,
      name: p.itemName,
      rank: rankOf(p.item, p.sphere),
      sphere: p.sphere,
      where: locationName(p.location),
    });
  }

  const byMarker = new Map<string, MarkerHeld>();
  const markers: readonly MapMarker[] = INVERTED_MARKERS;
  for (const marker of markers) {
    if (marker.dungeon !== undefined) continue;
    const held = marker.locations
      .flatMap((id) => byLocation.get(id) ?? [])
      .sort(byNotable);
    const [top] = held;
    if (top !== undefined) {
      byMarker.set(marker.id, { held, top, words: wordsOf(held) });
    }
  }

  const cells = new Map<string, Held[]>();
  for (const held of byLocation.values()) {
    const cell = held.item === null ? undefined : CELL_OF.get(held.item);
    if (cell === undefined) continue;
    cells.set(cell.id, [...(cells.get(cell.id) ?? []), held]);
  }
  for (const places of cells.values()) places.sort(byNotable);

  return { byCell: cells, byLocation, byMarker };
};

const cache = new WeakMap<Loaded, Labels>();

/** The labels of a review, worked out once; null outside an ALttPR review. */
export const labelsOf = (review: Loaded | null): Labels | null => {
  if (review === null || review.game !== "alttpr") return null;
  let labels = cache.get(review);
  if (labels === undefined) {
    labels = labelsOfLog(review.log as AlttprSpoilerLog);
    cache.set(review, labels);
  }
  return labels;
};

/** What a map marker held, or null: no review, or nothing the log placed there. */
export const useMarkerHeld = (id: string): MarkerHeld | null =>
  useReviewStore((state) => labelsOf(state.review)?.byMarker.get(id) ?? null);

const NONE: ReadonlyMap<string, Held> = new Map();

/** What every location held (empty outside a review): for a list of them, as the tooltip's. */
export const useReviewHeld = (): ReadonlyMap<string, Held> =>
  useReviewStore((state) => labelsOf(state.review)?.byLocation ?? NONE);

/** What a check of the list held, or null. */
export const useLocationHeld = (id: string): Held | null =>
  useReviewStore((state) => labelsOf(state.review)?.byLocation.get(id) ?? null);

/** Where an item of the grid was, most notable first, or null outside a review. */
export const useCellHeld = (id: string): readonly Held[] | null =>
  useReviewStore((state) => labelsOf(state.review)?.byCell.get(id) ?? null);

/** Whether a review is on the board, for the parts that only change then. */
export const useInReview = (): boolean =>
  useReviewStore((state) => labelsOf(state.review) !== null);

/** The words of the places an item was: "at Zora's Domain, or 3 more places". */
export const placesText = (places: readonly Held[]): string => {
  const [first] = places;
  if (first === undefined) return "";
  if (places.length === 1) return `at ${first.where}`;
  const shown = places.slice(0, 3).map(({ where }) => where);
  const more = places.length - shown.length;
  return `${places.length} places: ${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
};

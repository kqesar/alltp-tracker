// What each place of SMZ3's board held, in a review: the log's placements laid
// over both maps' markers and the item grid. Worked out once per review (the
// store's `Loaded` is immutable, so a WeakMap holds the answer) and read
// through selectors that return the same object until the review changes: a
// review costs the board nothing past its first paint, and outside a review
// every hook answers null.

import {
  HYRULE_MARKERS,
  type Smz3Marker,
  type Smz3SpoilerExtra,
  ZEBES_MARKERS,
} from "@alltp/pack-smz3";
import type { SpoilerLog } from "@alltp/spoiler";
import { SM_CELLS, ZELDA_CELLS } from "@/games/smz3/data";
import { type Loaded, useReviewStore } from "@/review/store";

/** An SMZ3 spoiler log, as the pack reads it. */
export type Smz3SpoilerLog = SpoilerLog<Smz3SpoilerExtra>;

/** How an item is drawn: an ALttPR asset of the app, or a frame of Super Metroid's sheet. */
export type Icon =
  | { readonly kind: "asset"; readonly file: string }
  | { readonly kind: "sheet"; readonly frame: number };

/** One location and what it held. */
export interface Held {
  readonly location: string;
  /** The location's name as the randomizer writes it: "Eastern Palace - Big Chest". */
  readonly where: string;
  /** The region the file lists it under. */
  readonly area: string | null;
  /** The pack's item id, or null for an item the logic does not read (rupees, maps…). */
  readonly item: string | null;
  /** The item's name as the randomizer writes it. */
  readonly name: string;
  /** How the board draws it, or null (rupees, hearts, arrows, maps…). */
  readonly icon: Icon | null;
  /** The playthrough sphere it sits in, or null for a location the win does not need. */
  readonly sphere: number | null;
  /** How notable it is: 0 in the playthrough, 1 an item of the grid, 2 a dungeon key, 3 the rest. */
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
  /** The places an item of the grid was, by the pack's item id. */
  readonly byItem: ReadonlyMap<string, readonly Held[]>;
}

/** The icon of each item the grid has a cell for. */
const CELL_ICONS: ReadonlyMap<string, Icon> = new Map([
  ...ZELDA_CELLS.flatMap((cell): [string, Icon][] =>
    "asset" in cell.sprite
      ? [[cell.id, { file: cell.sprite.asset(1), kind: "asset" }]]
      : [],
  ),
  ...SM_CELLS.flatMap((cell): [string, Icon][] =>
    "frame" in cell.sprite
      ? [[cell.id, { frame: cell.sprite.frame, kind: "sheet" }]]
      : [],
  ),
]);

/** An item's icon: its cell's, or the dungeon keys' art. */
const iconOf = (item: string | null): Icon | null => {
  if (item === null) return null;
  if (/^bigKey[A-Z]+$/.test(item)) return { file: "bigkey.png", kind: "asset" };
  if (/^key[A-Z]+$/.test(item)) return { file: "smallkey.png", kind: "asset" };
  return CELL_ICONS.get(item) ?? null;
};

const rankOf = (
  item: string | null,
  sphere: number | null,
  icon: Icon | null,
): number => {
  if (sphere !== null) return 0;
  if (item !== null && CELL_ICONS.has(item)) return 1;
  return icon === null ? 3 : 2;
};

/** Most notable first, then by sphere, then by name. */
export const byNotable = (a: Held, b: Held): number =>
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

/** Every marker of both maps. */
const MARKERS: readonly Smz3Marker[] = [
  ...HYRULE_MARKERS.light,
  ...HYRULE_MARKERS.dark,
  ...ZEBES_MARKERS,
];

/** What every placement of a log held, laid on the board's places. */
export const labelsOfLog = (log: Smz3SpoilerLog): Labels => {
  const byLocation = new Map<string, Held>();
  for (const p of log.placements) {
    const icon = iconOf(p.item);
    byLocation.set(p.location, {
      area: p.area,
      icon,
      item: p.item,
      location: p.location,
      name: p.itemName,
      rank: rankOf(p.item, p.sphere, icon),
      sphere: p.sphere,
      where: p.locationName,
    });
  }

  const byMarker = new Map<string, MarkerHeld>();
  for (const marker of MARKERS) {
    const held = marker.locations
      .flatMap((id) => byLocation.get(id) ?? [])
      .sort(byNotable);
    const [top] = held;
    if (top !== undefined) {
      byMarker.set(marker.id, { held, top, words: wordsOf(held) });
    }
  }

  const byItem = new Map<string, Held[]>();
  for (const held of byLocation.values()) {
    if (held.item === null) continue;
    byItem.set(held.item, [...(byItem.get(held.item) ?? []), held]);
  }
  for (const places of byItem.values()) places.sort(byNotable);

  return { byItem, byLocation, byMarker };
};

const cache = new WeakMap<Loaded, Labels>();

/** The labels of a review, worked out once; null outside an SMZ3 review. */
export const labelsOf = (review: Loaded | null): Labels | null => {
  if (review === null || review.game !== "smz3") return null;
  let labels = cache.get(review);
  if (labels === undefined) {
    labels = labelsOfLog(review.log as Smz3SpoilerLog);
    cache.set(review, labels);
  }
  return labels;
};

/** What a map marker held, or null: no review, or nothing the log placed there. */
export const useMarkerHeld = (id: string): MarkerHeld | null =>
  useReviewStore((state) => labelsOf(state.review)?.byMarker.get(id) ?? null);

/** Where an item of the grid was, most notable first, or null outside a review. */
export const useItemPlaces = (id: string): readonly Held[] | null =>
  useReviewStore((state) => labelsOf(state.review)?.byItem.get(id) ?? null);

/** The words of the places an item was: "at Zora's Domain", "5 places: a, b, c and 2 more". */
export const placesText = (places: readonly Held[]): string => {
  const [first] = places;
  if (first === undefined) return "";
  if (places.length === 1) return `at ${first.where}`;
  const shown = places.slice(0, 3).map(({ where }) => where);
  const more = places.length - shown.length;
  return `${places.length} places: ${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
};

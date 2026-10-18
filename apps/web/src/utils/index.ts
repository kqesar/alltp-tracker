import { BOSS_STATES } from "@/constants";
import { isKeyCell, itemsMin } from "@/data/items";

/**
 * Gets the correct asset path with base URL support
 * @param assetPath - The asset path relative to assets folder
 * @returns Complete asset URL
 */
export const getAssetPath = (assetPath: string): string => {
  return `${import.meta.env.BASE_URL}assets/${assetPath}`;
};

/**
 * Resolves the background-image URL for a tracker item based on its state.
 * @param item - The item identifier (e.g. "bow", "boss0", "bigkey3")
 * @param value - The item's current value in the store
 * @returns CSS background-image value (empty string for blank slots)
 */
export const getItemBackground = (
  item: string,
  value: number | boolean,
): string => {
  if (!item || item === "blank") return "";
  // Agahnim 2, atop Ganon's Tower, is drawn as Agahnim (agahnim0, agahnim1)
  if (item === "agahnim2")
    return `url(${getAssetPath(`agahnim${value ? 1 : 0}.png`)})`;
  // Big keys all share a single image
  if (item.startsWith("bigkey")) return `url(${getAssetPath("bigkey.png")})`;
  // A boss has one portrait; dimming it (isItemDimmed) marks it not beaten
  if (item.startsWith("boss")) {
    return `url(${getAssetPath(`${item}${BOSS_STATES.BEATEN}.png`)})`;
  }
  if (typeof value === "boolean") return `url(${getAssetPath(`${item}.png`)})`;
  return `url(${getAssetPath(`${item}${value}.png`)})`;
};

/**
 * Whether a tracker cell shows its item as not obtained, or its boss as not
 * beaten: drawn greyed (`griditem--dimmed`).
 * @param item - The item identifier
 * @param value - The item's current value in the store
 */
export const isItemDimmed = (
  item: string,
  value: number | boolean,
): boolean => {
  if (!item || item === "blank") return true;
  if (item.startsWith("bigkey")) return value !== 1;
  if (typeof value === "boolean") return !value;
  // A boss starts at its minimum, 1 (alive), like any other counter
  return value <= (itemsMin[item] || 0);
};

/**
 * The rows of the item grid on screen: while the key cells are hidden, a row
 * of nothing but key cells, castle labels and gaps is left out, since it
 * would be empty.
 * @param layout - The grid layout, one array of item identifiers per row
 * @param bigKeysVisible - Whether the key cells are shown
 */
export const visibleRows = (
  layout: string[][],
  bigKeysVisible: boolean,
): string[][] =>
  bigKeysVisible
    ? layout
    : layout.filter(
        (row) => !row.every((item) => item === "" || isKeyCell(item)),
      );

/**
 * How the two worlds are arranged on screen.
 * - `auto`: side by side while each world gets enough width, stacked below
 * - `side-by-side`: as the map asset stores them, Light World left, Dark right
 * - `stacked`: Light World on top, Dark World below
 */
export type MapLayout = "auto" | "side-by-side" | "stacked";

/** What the map panel shows: the two worlds, or every check as a list. */
export type MapView = "map" | "checks";

/** The two halves of the map asset. */
export type World = "light" | "dark";

/** Midpoint of the map asset, where the Light World ends and the Dark begins. */
const WORLD_SPLIT = 50;

/**
 * Places a marker in its own world. Coordinates are authored against the
 * whole asset (both worlds side by side); each world is drawn as its own
 * square, so a marker keeps its height and doubles its share of the width
 * within its half.
 * @param x - Horizontal position over the whole asset, e.g. "46.8%"
 * @param y - Vertical position, e.g. "38.8%"
 * @returns The world and the position inside it, in percent
 */
export const toWorldPosition = (
  x: string,
  y: string,
): { world: World; x: number; y: number } => {
  const left = Number.parseFloat(x);
  const world: World = left > WORLD_SPLIT ? "dark" : "light";
  return {
    world,
    x: (world === "dark" ? left - WORLD_SPLIT : left) * 2,
    y: Number.parseFloat(y),
  };
};

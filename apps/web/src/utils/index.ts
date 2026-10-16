import { itemsMin } from "@/data/items";

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
  // Big keys all share a single image
  if (item.startsWith("bigkey")) return `url(${getAssetPath("bigkey.png")})`;
  if (typeof value === "boolean") return `url(${getAssetPath(`${item}.png`)})`;
  return `url(${getAssetPath(`${item}${value}.png`)})`;
};

/**
 * Whether a tracker cell shows its item as not obtained (drawn dimmed).
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
  // A boss icon is always drawn at full strength; its overlays carry the state.
  if (item.startsWith("boss")) return false;
  return value <= (itemsMin[item] || 0);
};

/**
 * How the two worlds are arranged on screen.
 * - `auto`: side by side while each world gets enough width, stacked below
 * - `side-by-side`: as the map asset stores them, Light World left, Dark right
 * - `stacked`: Light World on top, Dark World below
 */
export type MapLayout = "auto" | "side-by-side" | "stacked";

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

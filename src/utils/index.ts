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
 * - `side-by-side`: as the map asset stores them, Light World left, Dark right
 * - `stacked`: Light World on top, Dark World below, for tall/narrow screens
 */
export type MapLayout = "side-by-side" | "stacked";

/** Midpoint of the map asset, where the Light World ends and the Dark begins. */
const WORLD_SPLIT = 0.5;

/**
 * Re-projects a marker's percentage coordinates for the current layout.
 *
 * Marker coordinates are authored against the side-by-side asset. Stacked,
 * each world spans the full width and half the height, so a marker's x doubles
 * within its own half while its y halves — shifted into the lower half for
 * Dark World markers.
 * @param x - Horizontal position as a percentage string (e.g. "46.8%")
 * @param y - Vertical position as a percentage string
 * @param layout - The arrangement currently on screen
 * @returns The percentage strings to position the marker with
 */
export const transformMapCoordinates = (
  x: string,
  y: string,
  layout: MapLayout,
): { x: string; y: string } => {
  if (layout === "side-by-side") return { x, y };

  const xFraction = Number.parseFloat(x) / 100;
  const yFraction = Number.parseFloat(y) / 100;
  const isDarkWorld = xFraction > WORLD_SPLIT;

  const stackedX = (isDarkWorld ? xFraction - WORLD_SPLIT : xFraction) * 2;
  const stackedY = yFraction / 2 + (isDarkWorld ? WORLD_SPLIT : 0);

  return { x: `${stackedX * 100}%`, y: `${stackedY * 100}%` };
};

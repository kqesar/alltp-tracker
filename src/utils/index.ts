import { itemsMin } from "@/data/items";
import type { ItemState } from "@/data/logic";

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
 * @param items - Current item state
 * @returns CSS background-image value (empty string for blank slots)
 */
const getItemBackground = (item: string, items: ItemState): string => {
  if (!item || item === "blank") return "";
  // Big keys all share a single image
  if (item.startsWith("bigkey")) return `url(${getAssetPath("bigkey.png")})`;
  if (typeof items[item] === "boolean") {
    return `url(${getAssetPath(`${item}.png`)})`;
  }
  return `url(${getAssetPath(`${item}${items[item]}.png`)})`;
};

/**
 * Computes the opacity for a tracker item: full when obtained, dimmed otherwise.
 * @param item - The item identifier
 * @param items - Current item state
 * @returns Opacity value as a string
 */
const getItemOpacity = (item: string, items: ItemState): string => {
  if (!item || item === "blank") return "0.25";
  if (item.startsWith("bigkey")) {
    return (items[item] as number) === 1 ? "1" : "0.25";
  }
  if (typeof items[item] === "boolean") {
    return items[item] ? "1" : "0.25";
  }
  // A boss icon is always drawn at full strength; its overlays carry the state.
  if (typeof items[item] === "number" && item.startsWith("boss")) {
    return "1";
  }
  const minValue = itemsMin[item] || 0;
  return (items[item] as number) > minValue ? "1" : "0.25";
};

/**
 * Dynamic style object (background + opacity) for a tracker grid item.
 * @param item - The item identifier
 * @param items - Current item state
 */
export const getGridItemStyles = (item: string, items: ItemState) => ({
  backgroundImage: getItemBackground(item, items),
  opacity: getItemOpacity(item, items),
});

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

import { MAP_COORDINATES } from "@/constants";
import type { ItemState } from "@/data/chests";
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
 * @param items - Current item state
 * @returns CSS background-image value (empty string for blank slots)
 */
export const getItemBackground = (item: string, items: ItemState): string => {
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
export const getItemOpacity = (item: string, items: ItemState): string => {
  if (!item || item === "blank") return "0.25";
  if (item.startsWith("bigkey")) {
    return (items[item] as number) === 1 ? "1" : "0.25";
  }
  if (typeof items[item] === "boolean") {
    return items[item] ? "1" : "0.25";
  }
  if (typeof items[item] === "number" && item.indexOf("boss") === 0) {
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
 * Transforms a map marker's percentage coordinates for the current map
 * orientation. In vertical orientation the light and dark worlds are stacked,
 * so the right half of the map is moved below the left half.
 * @param x - Horizontal position as a percentage string (e.g. "46.8%")
 * @param y - Vertical position as a percentage string
 * @param mapOrientation - true when the map is shown vertically (stacked)
 * @returns The transformed { x, y } percentage strings
 */
export const transformMapCoordinates = (
  x: string,
  y: string,
  mapOrientation: boolean,
): { x: string; y: string } => {
  if (!mapOrientation) return { x, y };

  const { COORDINATE_MULTIPLIER, PERCENTAGE_MULTIPLIER, SPLIT_THRESHOLD } =
    MAP_COORDINATES;
  const xNum = parseFloat(x) / PERCENTAGE_MULTIPLIER;
  const yNum = parseFloat(y) / PERCENTAGE_MULTIPLIER;

  if (xNum > SPLIT_THRESHOLD) {
    return {
      x: `${(xNum - SPLIT_THRESHOLD) * COORDINATE_MULTIPLIER * PERCENTAGE_MULTIPLIER}%`,
      y: `${(yNum / COORDINATE_MULTIPLIER + SPLIT_THRESHOLD) * PERCENTAGE_MULTIPLIER}%`,
    };
  }
  return {
    x: `${xNum * COORDINATE_MULTIPLIER * PERCENTAGE_MULTIPLIER}%`,
    y: `${(yNum / COORDINATE_MULTIPLIER) * PERCENTAGE_MULTIPLIER}%`,
  };
};

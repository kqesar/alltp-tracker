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

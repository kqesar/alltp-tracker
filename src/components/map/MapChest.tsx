import { CSS_CLASSES, MAP_ORIENTATION_VALUES } from "@/constants";
import type { ChestItem } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type MapChestProps = {
  chest: ChestItem;
  index: number;
};

/**
 * MapChest component handles the rendering of a single chest on the map
 * @param chest - The chest data
 * @param index - The chest index
 */
export const MapChest = ({ chest, index }: MapChestProps) => {
  const { items, medallions, mapOrientation, toggleChest, setCaption } =
    useGameStore();

  // Get chest availability class
  const getAvailabilityClass = () => {
    if (chest.isOpened) return "opened";
    return chest.isAvailable(items, medallions);
  };

  // Highlight chest and show caption
  const handleHighlight = () => {
    setCaption(chest.name);
  };

  // Remove highlight and clear caption
  const handleUnhighlight = () => {
    setCaption("");
  };

  // Transform coordinates for vertical orientation
  const getTransformedCoordinates = () => {
    const x = chest.x;
    const y = chest.y;

    if (mapOrientation === MAP_ORIENTATION_VALUES.HORIZONTAL) return { x, y };

    const xNum = parseFloat(x) / 100;
    const yNum = parseFloat(y) / 100;

    if (xNum > 0.5) {
      return {
        x: `${(xNum - 0.5) * 2 * 100}%`,
        y: `${(yNum / 2 + 0.5) * 100}%`,
      };
    } else {
      return {
        x: `${xNum * 2 * 100}%`,
        y: `${(yNum / 2) * 100}%`,
      };
    }
  };

  const coords = getTransformedCoordinates();
  const availabilityClass = getAvailabilityClass();

  return (
    <div
      className={`${CSS_CLASSES.MAPSPAN} chest ${CSS_CLASSES.MAP_ELEMENT_BASE} ${CSS_CLASSES.MAP_CHEST} ${availabilityClass}`}
      onClick={() => toggleChest(index)}
      onMouseOut={handleUnhighlight}
      onMouseOver={handleHighlight}
      style={{
        backgroundImage: `url(${getAssetPath("poi.png")})`,
        left: coords.x,
        top: coords.y,
      }}
    />
  );
};

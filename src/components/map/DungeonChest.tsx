import {
  ASSET_NAMES,
  AVAILABILITY_CLASSES,
  CHEST_STATES,
  CSS_CLASSES,
  EMPTY_STRING,
} from "@/constants";
import { buildDungeonCaption, type DungeonItem } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath, transformMapCoordinates } from "@/utils";

type DungeonChestProps = {
  dungeon: DungeonItem;
  index: number;
};

/**
 * DungeonChest component handles the rendering of a single dungeon chest indicator on the map
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 */
export const DungeonChest = ({ dungeon, index }: DungeonChestProps) => {
  const { items, medallions, mapOrientation, setCaption } = useGameStore();

  // Get chest count from store
  const chestKey = `chest${index}` as keyof typeof items;
  const chestCount = items[chestKey] as number;

  // Get dungeon chest availability class
  const getAvailabilityClass = () => {
    if (chestCount === CHEST_STATES.OPENED) return AVAILABILITY_CLASSES.OPENED;
    return dungeon.canGetChest(items, medallions);
  };

  // Highlight dungeon and show caption with dynamic medallion info
  // Highlight dungeon and show caption (medallion icon resolved for 8/9)
  const handleHighlight = () => {
    setCaption(buildDungeonCaption(dungeon, index, medallions));
  };

  // Remove highlight and clear caption
  const handleUnhighlight = () => {
    setCaption(EMPTY_STRING);
  };

  const coords = transformMapCoordinates(dungeon.x, dungeon.y, mapOrientation);
  const availabilityClass = getAvailabilityClass();

  return (
    <div
      className={`${CSS_CLASSES.MAPSPAN} dungeon ${CSS_CLASSES.MAP_ELEMENT_BASE} ${availabilityClass}`}
      onMouseOut={handleUnhighlight}
      onMouseOver={handleHighlight}
      style={{
        backgroundImage: `url(${getAssetPath(ASSET_NAMES.POI)})`,
        left: coords.x,
        top: coords.y,
      }}
    />
  );
};

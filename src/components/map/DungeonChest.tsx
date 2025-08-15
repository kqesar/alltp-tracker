import {
  ASSET_NAMES,
  AVAILABILITY_CLASSES,
  CHEST_STATES,
  CSS_CLASSES,
  DUNGEON_INDICES,
  EMPTY_STRING,
  MAP_COORDINATES,
  MEDALLION_VALUES,
} from "@/constants";
import type { DungeonItem } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

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
  const handleHighlight = () => {
    let dungeonName = dungeon.name;

    // For Misery Mire (8) and Turtle Rock (9), update medallion in caption
    if (
      index === DUNGEON_INDICES.MISERY_MIRE ||
      index === DUNGEON_INDICES.TURTLE_ROCK
    ) {
      const medallionValue = medallions[index];
      let medallionName = ASSET_NAMES.MEDALLION_UNKNOWN; // default/unknown

      switch (medallionValue) {
        case MEDALLION_VALUES.BOMBOS:
          medallionName = ASSET_NAMES.MEDALLION_BOMBOS; // bombos
          break;
        case MEDALLION_VALUES.ETHER:
          medallionName = ASSET_NAMES.MEDALLION_ETHER; // ether
          break;
        case MEDALLION_VALUES.QUAKE:
          medallionName = ASSET_NAMES.MEDALLION_QUAKE; // quake (uses medallion0 image)
          break;
      }

      // Replace the medallion image in the name
      dungeonName = dungeonName.replace(
        ASSET_NAMES.MEDALLION_UNKNOWN,
        medallionName,
      );
    }

    setCaption(dungeonName);
  };

  // Remove highlight and clear caption
  const handleUnhighlight = () => {
    setCaption(EMPTY_STRING);
  };

  // Transform coordinates for vertical orientation
  const getTransformedCoordinates = () => {
    const x = dungeon.x;
    const y = dungeon.y;

    if (!mapOrientation) return { x, y };

    const xNum = parseFloat(x) / MAP_COORDINATES.PERCENTAGE_MULTIPLIER;
    const yNum = parseFloat(y) / MAP_COORDINATES.PERCENTAGE_MULTIPLIER;

    if (xNum > MAP_COORDINATES.SPLIT_THRESHOLD) {
      return {
        x: `${(xNum - MAP_COORDINATES.SPLIT_THRESHOLD) * MAP_COORDINATES.COORDINATE_MULTIPLIER * MAP_COORDINATES.PERCENTAGE_MULTIPLIER}%`,
        y: `${(yNum / MAP_COORDINATES.COORDINATE_MULTIPLIER + MAP_COORDINATES.SPLIT_THRESHOLD) * MAP_COORDINATES.PERCENTAGE_MULTIPLIER}%`,
      };
    } else {
      return {
        x: `${xNum * MAP_COORDINATES.COORDINATE_MULTIPLIER * MAP_COORDINATES.PERCENTAGE_MULTIPLIER}%`,
        y: `${(yNum / MAP_COORDINATES.COORDINATE_MULTIPLIER) * MAP_COORDINATES.PERCENTAGE_MULTIPLIER}%`,
      };
    }
  };

  const coords = getTransformedCoordinates();
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

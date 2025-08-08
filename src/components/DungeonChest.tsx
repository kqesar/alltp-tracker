import { getAssetPath } from "@/utils";
import type { DungeonItem } from "../data/chests";
import { useGameStore } from "../stores/gameStore";

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
    if (chestCount === 0) return "opened";
    return dungeon.canGetChest(items, medallions);
  };

  // Highlight dungeon and show caption with dynamic medallion info
  const handleHighlight = () => {
    let dungeonName = dungeon.name;

    // For Misery Mire (8) and Turtle Rock (9), update medallion in caption
    if (index === 8 || index === 9) {
      const medallionValue = medallions[index];
      let medallionName = "medallion0"; // default/unknown

      switch (medallionValue) {
        case 1:
          medallionName = "medallion1"; // bombos
          break;
        case 2:
          medallionName = "medallion2"; // ether
          break;
        case 3:
          medallionName = "medallion0"; // quake (uses medallion0 image)
          break;
        default:
          medallionName = "medallion0"; // unknown
          break;
      }

      // Replace the medallion image in the name
      dungeonName = dungeonName.replace("medallion0", medallionName);
    }

    setCaption(dungeonName);
  };

  // Remove highlight and clear caption
  const handleUnhighlight = () => {
    setCaption("");
  };

  // Transform coordinates for vertical orientation
  const getTransformedCoordinates = () => {
    const x = dungeon.x;
    const y = dungeon.y;

    if (!mapOrientation) return { x, y };

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
      className={`mapspan dungeon map-element-base ${availabilityClass}`}
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

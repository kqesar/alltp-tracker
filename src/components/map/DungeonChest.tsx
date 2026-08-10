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
    if (chestCount === 0) return "opened";
    return dungeon.canGetChest(items, medallions);
  };

  // Highlight dungeon and show caption (medallion icon resolved for 8/9)
  const handleHighlight = () => {
    setCaption(buildDungeonCaption(dungeon, index, medallions));
  };

  // Remove highlight and clear caption
  const handleUnhighlight = () => {
    setCaption("");
  };

  const coords = transformMapCoordinates(dungeon.x, dungeon.y, mapOrientation);
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

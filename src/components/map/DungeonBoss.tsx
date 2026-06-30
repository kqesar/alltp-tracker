import { BOSS_STATES, CSS_CLASSES } from "@/constants";
import { buildDungeonCaption, type DungeonItem } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath, transformMapCoordinates } from "@/utils";

type DungeonBossProps = {
  dungeon: DungeonItem;
  index: number;
};

/**
 * DungeonBoss component handles the rendering of a single dungeon boss on the map
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 */
export const DungeonBoss = ({ dungeon, index }: DungeonBossProps) => {
  const {
    items,
    medallions,
    mapOrientation,
    toggleDungeonBoss,
    setCaption,
    bigKeysVisible,
  } = useGameStore();

  // Get dungeon boss availability class
  const getAvailabilityClass = () => {
    const bossKey = `boss${index}`;
    const bossValue = items[bossKey] as number;

    // If boss is beaten, return "opened"
    if (bossValue === BOSS_STATES.BEATEN) return "opened";

    if (dungeon.isBeaten) return "opened";
    return dungeon.isBeatable(items, medallions, bigKeysVisible);
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
      className={`${CSS_CLASSES.MAPSPAN} boss ${CSS_CLASSES.MAP_ELEMENT_BASE} ${availabilityClass}`}
      onClick={() => toggleDungeonBoss(index)}
      onMouseOut={handleUnhighlight}
      onMouseOver={handleHighlight}
      style={{
        backgroundImage: `url(${getAssetPath(dungeon.image)})`,
        left: coords.x,
        top: coords.y,
      }}
    />
  );
};

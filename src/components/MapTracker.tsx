import { getAssetPath } from "@/utils";
import { useGameStore } from "../stores/gameStore";
import { DungeonBoss } from "./DungeonBoss";

interface MapTrackerProps {
  dungeonChests: Record<number, number>;
}

/**
 * MapTracker component handles the map display with chests and dungeons
 */
export const MapTracker = ({ dungeonChests }: MapTrackerProps) => {
  // Get all state and actions from Zustand store
  const {
    chestsState,
    dungeonsState,
    items,
    medallions,
    mapOrientation,
    toggleChest,
    toggleDungeonBoss,
    setCaption,
  } = useGameStore();

  // Highlight chest and show caption
  const highlightChest = (chestIndex: number) => {
    setCaption(chestsState[chestIndex].name);
  };

  // Remove highlight and clear caption
  const unhighlightChest = () => {
    setCaption("&nbsp;");
  };

  // Highlight dungeon and show caption with dynamic medallion info
  const highlightDungeon = (dungeonIndex: number) => {
    let dungeonName = dungeonsState[dungeonIndex].name;

    // For Misery Mire (8) and Turtle Rock (9), update medallion in caption
    if (dungeonIndex === 8 || dungeonIndex === 9) {
      const medallionValue = medallions[dungeonIndex];
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

  // Get chest availability class
  const getChestAvailability = (chestIndex: number) => {
    const chest = chestsState[chestIndex];
    if (chest.isOpened) return "opened";
    return chest.isAvailable(items, medallions);
  };

  // Get dungeon chest availability class
  const getDungeonChestAvailability = (dungeonIndex: number) => {
    const dungeon = dungeonsState[dungeonIndex];
    if (dungeonChests[dungeonIndex] === 0) return "opened";
    return dungeon.canGetChest(items, medallions);
  };

  // Transform coordinates for vertical orientation
  const transformCoordinates = (x: string, y: string) => {
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

  return (
    <div className="map-container">
      {/* Render chests */}
      {chestsState.map((chest, index) => {
        const coords = transformCoordinates(chest.x, chest.y);
        return (
          <div
            className={`mapspan chest map-element-base map-chest ${getChestAvailability(index)}`}
            key={`chest-${chest.id}`}
            onClick={() => toggleChest(index)}
            onMouseOut={unhighlightChest}
            onMouseOver={() => highlightChest(index)}
            style={{
              backgroundImage: `url(${getAssetPath("poi.png")})`,
              left: coords.x,
              top: coords.y,
            }}
          />
        );
      })}

      {/* Render dungeon bosses */}
      {dungeonsState.map((dungeon, index) => (
        <DungeonBoss
          dungeon={dungeon}
          index={index}
          items={items}
          key={`boss-${dungeon.id}`}
          mapOrientation={mapOrientation}
          medallions={medallions}
          onHighlight={highlightDungeon}
          onToggle={toggleDungeonBoss}
          onUnhighlight={unhighlightChest}
        />
      ))}

      {/* Render dungeon chests */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        return (
          <div
            className={`mapspan dungeon map-element-base ${getDungeonChestAvailability(index)}`}
            key={`dungeon-${dungeon.id}`}
            onMouseOut={unhighlightChest}
            onMouseOver={() => highlightDungeon(index)}
            style={{
              backgroundImage: `url(${getAssetPath("poi.png")})`,
              left: coords.x,
              top: coords.y,
            }}
          />
        );
      })}
    </div>
  );
};

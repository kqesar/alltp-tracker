import type { ChestItem, DungeonItem, ItemState } from "../data/chests";

interface MapTrackerProps {
  chestsState: ChestItem[];
  setChestsState: (chests: ChestItem[]) => void;
  dungeonsState: DungeonItem[];
  setDungeonsState: (dungeons: DungeonItem[]) => void;
  items: ItemState;
  medallions: number[];
  dungeonChests: Record<number, number>;
  mapOrientation: boolean;
  caption: string;
  setCaption: (caption: string) => void;
}

/**
 * Gets the correct asset path with base URL support
 * @param assetPath - The asset path relative to assets folder
 * @returns Complete asset URL
 */
const getAssetPath = (assetPath: string): string => {
  return `${import.meta.env.BASE_URL}assets/${assetPath}`;
};

/**
 * MapTracker component handles the map display with chests and dungeons
 */
export const MapTracker = ({
  chestsState,
  setChestsState,
  dungeonsState,
  setDungeonsState,
  items,
  medallions,
  dungeonChests,
  mapOrientation,
  setCaption,
}: MapTrackerProps) => {
  // Toggle chest opened/closed state
  const toggleChest = (chestIndex: number) => {
    const newChests = [...chestsState];
    newChests[chestIndex].isOpened = !newChests[chestIndex].isOpened;
    setChestsState(newChests);
  };

  // Toggle dungeon boss beaten/not beaten state
  const toggleDungeonBoss = (dungeonIndex: number) => {
    const newDungeons = [...dungeonsState];
    newDungeons[dungeonIndex].isBeaten = !newDungeons[dungeonIndex].isBeaten;
    setDungeonsState(newDungeons);
  };

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
      dungeonName = dungeonName.replace(
        /<img src='\/assets\/medallion0\.png' class='mini'>/g,
        `<img src='/assets/${medallionName}.png' class='mini'>`,
      );
    }

    setCaption(dungeonName);
  };

  // Get chest availability class
  const getChestAvailability = (chestIndex: number) => {
    const chest = chestsState[chestIndex];
    if (chest.isOpened) return "opened";
    return chest.isAvailable(items, medallions);
  };

  // Get dungeon boss availability class
  const getDungeonBossAvailability = (dungeonIndex: number) => {
    const bossKey = `boss${dungeonIndex}`;
    const bossValue = items[bossKey] as number;

    // If boss is beaten (value 2), return "opened"
    if (bossValue === 2) return "opened";

    const dungeon = dungeonsState[dungeonIndex];
    if (dungeon.isBeaten) return "opened";
    return dungeon.isBeatable(items, medallions);
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
    <div style={{ height: "100%", position: "relative", width: "100%" }}>
      {/* Render chests */}
      {chestsState.map((chest, index) => {
        const coords = transformCoordinates(chest.x, chest.y);
        return (
          <div
            className={`mapspan chest ${getChestAvailability(index)}`}
            key={`chest-${chest.id}`}
            onClick={() => toggleChest(index)}
            onMouseOut={unhighlightChest}
            onMouseOver={() => highlightChest(index)}
            style={{
              backgroundImage: `url(${getAssetPath("poi.png")})`,
              backgroundSize: "100% 100%",
              cursor: "pointer",
              height: "24px",
              left: coords.x,
              marginLeft: "-12px",
              marginTop: "-12px",
              position: "absolute",
              top: coords.y,
              width: "24px",
            }}
          />
        );
      })}

      {/* Render dungeon bosses */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        const availabilityClass = getDungeonBossAvailability(index);
        return (
          <div
            className={`mapspan boss ${availabilityClass}`}
            key={`boss-${dungeon.id}`}
            onClick={() => toggleDungeonBoss(index)}
            onMouseOut={unhighlightChest}
            onMouseOver={() => highlightDungeon(index)}
            style={{
              backgroundImage: `url(${getAssetPath(dungeon.image)})`,
              cursor: "pointer",
              left: coords.x,
              position: "absolute",
              top: coords.y,
            }}
          />
        );
      })}

      {/* Render dungeon chests */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        return (
          <div
            className={`mapspan dungeon ${getDungeonChestAvailability(index)}`}
            key={`dungeon-${dungeon.id}`}
            onMouseOut={unhighlightChest}
            onMouseOver={() => highlightDungeon(index)}
            style={{
              backgroundImage: `url(${getAssetPath("poi.png")})`,
              cursor: "pointer",
              left: coords.x,
              position: "absolute",
              top: coords.y,
            }}
          />
        );
      })}
    </div>
  );
};

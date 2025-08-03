import React, { useState } from 'react';

interface MapTrackerProps {
  chestsState: any[];
  setChestsState: (chests: any[]) => void;
  dungeonsState: any[];
  setDungeonsState: (dungeons: any[]) => void;
  items: any;
  medallions: number[];
  dungeonChests: any;
  mapOrientation: boolean;
}

/**
 * MapTracker component handles the map display with chests and dungeons
 */
const MapTracker: React.FC<MapTrackerProps> = ({
  chestsState,
  setChestsState,
  dungeonsState,
  items,
  medallions,
  dungeonChests,
  mapOrientation
}) => {
  const [, setCaption] = useState('&nbsp;');

  // Toggle chest opened/closed state
  const toggleChest = (chestIndex: number) => {
    const newChests = [...chestsState];
    newChests[chestIndex].isOpened = !newChests[chestIndex].isOpened;
    setChestsState(newChests);
  };

  // Highlight chest and show caption
  const highlightChest = (chestIndex: number) => {
    setCaption(chestsState[chestIndex].name);
  };

  // Remove highlight and clear caption
  const unhighlightChest = () => {
    setCaption('&nbsp;');
  };

  // Highlight dungeon and show caption
  const highlightDungeon = (dungeonIndex: number) => {
    setCaption(dungeonsState[dungeonIndex].name);
  };

  // Get chest availability class
  const getChestAvailability = (chestIndex: number) => {
    const chest = chestsState[chestIndex];
    if (chest.isOpened) return 'opened';
    return chest.isAvailable(items, medallions);
  };

  // Get dungeon boss availability class
  const getDungeonBossAvailability = (dungeonIndex: number) => {
    const dungeon = dungeonsState[dungeonIndex];
    if (dungeon.isBeaten) return 'opened';
    return dungeon.isBeatable(items, medallions);
  };

  // Get dungeon chest availability class
  const getDungeonChestAvailability = (dungeonIndex: number) => {
    const dungeon = dungeonsState[dungeonIndex];
    if (dungeonChests[dungeonIndex] === 0) return 'opened';
    return dungeon.canGetChest(items, medallions);
  };

  // Transform coordinates for vertical orientation
  const transformCoordinates = (x: string, y: string) => {
    if (!mapOrientation) return { x, y };
    
    const xNum = parseFloat(x) / 100;
    const yNum = parseFloat(y) / 100;
    
    if (xNum > 0.5) {
      return {
        x: (((xNum - 0.5) * 2) * 100) + '%',
        y: (((yNum / 2) + 0.5) * 100) + '%'
      };
    } else {
      return {
        x: ((xNum * 2) * 100) + '%',
        y: ((yNum / 2) * 100) + '%'
      };
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Render chests */}
      {chestsState.map((chest, index) => {
        const coords = transformCoordinates(chest.x, chest.y);
        return (
          <span
            key={`chest-${index}`}
            className={`mapspan chest ${getChestAvailability(index)}`}
            style={{
              backgroundImage: 'url(/assets/poi.png)',
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              cursor: 'pointer'
            }}
            onClick={() => toggleChest(index)}
            onMouseOver={() => highlightChest(index)}
            onMouseOut={unhighlightChest}
          />
        );
      })}

      {/* Render dungeon bosses */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        return (
          <span
            key={`boss-${index}`}
            className={`mapspan boss ${getDungeonBossAvailability(index)}`}
            style={{
              backgroundImage: `url(/assets/${dungeon.image})`,
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              cursor: 'pointer'
            }}
            onMouseOver={() => highlightDungeon(index)}
            onMouseOut={unhighlightChest}
          />
        );
      })}

      {/* Render dungeon chests */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        return (
          <span
            key={`dungeon-${index}`}
            className={`mapspan dungeon ${getDungeonChestAvailability(index)}`}
            style={{
              backgroundImage: 'url(/assets/poi.png)',
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              cursor: 'pointer'
            }}
            onMouseOver={() => highlightDungeon(index)}
            onMouseOut={unhighlightChest}
          />
        );
      })}
    </div>
  );
};

export default MapTracker;

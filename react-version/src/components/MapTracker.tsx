import React from 'react';

interface MapTrackerProps {
  chestsState: any[];
  setChestsState: (chests: any[]) => void;
  dungeonsState: any[];
  setDungeonsState: (dungeons: any[]) => void;
  items: any;
  medallions: number[];
  dungeonChests: any;
  mapOrientation: boolean;
  caption: string;
  setCaption: (caption: string) => void;
}

/**
 * MapTracker component handles the map display with chests and dungeons
 */
const MapTracker: React.FC<MapTrackerProps> = ({
  chestsState,
  setChestsState,
  dungeonsState,
  setDungeonsState,
  items,
  medallions,
  dungeonChests,
  mapOrientation,
  setCaption
}) => {

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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Render chests */}
      {chestsState.map((chest, index) => {
        const coords = transformCoordinates(chest.x, chest.y);
        return (
          <div
            key={`chest-${index}`}
            className={`mapspan chest ${getChestAvailability(index)}`}
            style={{
              backgroundImage: 'url(/assets/poi.png)',
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              cursor: 'pointer',
              width: '24px',
              height: '24px',
              backgroundSize: '100% 100%',
              marginLeft: '-12px',
              marginTop: '-12px'
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
        const availabilityClass = getDungeonBossAvailability(index);
        return (
          <div
            key={`boss-${index}`}
            className={`mapspan boss ${availabilityClass}`}
            style={{
              backgroundImage: `url(/assets/${dungeon.image})`,
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              cursor: 'pointer'
            }}
            onClick={() => toggleDungeonBoss(index)}
            onMouseOver={() => highlightDungeon(index)}
            onMouseOut={unhighlightChest}
          />
        );
      })}

      {/* Render dungeon chests */}
      {dungeonsState.map((dungeon, index) => {
        const coords = transformCoordinates(dungeon.x, dungeon.y);
        return (
          <div
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

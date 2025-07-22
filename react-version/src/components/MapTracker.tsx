import type { GameState } from '../types/game'

interface MapTrackerProps {
  gameState: GameState
  onToggleChest: (chestId: string) => void
}

export function MapTracker({ gameState, onToggleChest }: MapTrackerProps) {
  const { settings } = gameState
  
  if (!settings.showMap) return null

  return (
    <div 
      className={`mapdiv ${settings.mapOrientation} ${settings.mapPosition}`}
      style={{
        width: '884px',
        height: '442px',
        backgroundImage: 'url(/img/map.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        position: 'relative'
      }}
    >
      {/* Dungeons */}
      {gameState.dungeons.map(dungeon => (
        <div
          key={dungeon.id}
          className={`dungeon-marker ${dungeon.completed ? 'completed' : ''} ${!dungeon.accessible ? 'inaccessible' : ''}`}
          style={{
            position: 'absolute',
            left: `${dungeon.x}px`,
            top: `${dungeon.y}px`,
            width: '20px',
            height: '20px',
          }}
          title={dungeon.name}
        />
      ))}
      
      {/* Chests */}
      {settings.showChests && gameState.chests.map(chest => (
        <div
          key={chest.id}
          className={`chest-marker ${chest.status}`}
          style={{
            position: 'absolute',
            left: `${chest.x}px`,
            top: `${chest.y}px`,
            width: '12px',
            height: '12px',
            cursor: 'pointer'
          }}
          onClick={() => onToggleChest(chest.id)}
          title={`Chest ${chest.id}: ${chest.status}`}
        />
      ))}
    </div>
  )
}

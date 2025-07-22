import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { ItemGrid } from './components/ItemGrid'
import { MapTracker } from './components/MapTracker'
import { Settings } from './components/Settings'
import './styles/tracker.css'

function App() {
  const { 
    gameState, 
    updateItem, 
    toggleDungeon, 
    toggleChest, 
    updateSettings, 
    resetGame 
  } = useGameState()
  
  const [showSettings, setShowSettings] = useState(false)
  
  const isMapSide = gameState.settings.mapPosition === 'side'

  return (
    <div className="app-container">
      <div className="controls">
        <button onClick={resetGame}>Reset Game</button>
        <button onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? 'Hide Settings' : 'Show Settings'}
        </button>
      </div>
      
      <div className={`main-layout ${isMapSide ? 'map-side' : 'map-below'}`}>
        <ItemGrid 
          gameState={gameState} 
          onUpdateItem={updateItem}
        />
        
        <MapTracker 
          gameState={gameState}
          onToggleChest={toggleChest}
        />
      </div>
      
      <Settings 
        settings={gameState.settings}
        onUpdateSettings={updateSettings}
        visible={showSettings}
      />
    </div>
  )
}

export default App

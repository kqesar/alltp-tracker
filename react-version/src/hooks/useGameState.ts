import { useState, useCallback, useEffect } from 'react'
import type { GameState, GameItem, UseGameStateReturn, GameSettings } from '../types/game'

// Grille d'items basée sur defaultItemGrid de l'original
export const defaultItemGrid = [
  ["", "hookshot", "hammer", "firerod", "icerod", "boomerang", ""],
  ["bow", "lantern", "flute", "sword", "tunic", "shield", "boss0"],
  ["flute", "book", "mirror", "bombos", "ether", "quake", "boss1"],
  ["shovel", "glove", "bottle", "somaria", "byrna", "boots", "boss2"],
  ["powder", "mushroom", "cape", "mirror", "moonpearl", "flippers", "agahnim"],
  ["boss3", "boss4", "boss5", "", "", "", ""],
]

// État initial basé sur l'application originale
const createInitialGameState = (): GameState => {
  const items: { [key: string]: GameItem } = {}
  
  // Créer les items basés sur la grille
  const itemDefs = {
    bow: { name: 'Bow', maxValue: 3 },
    hookshot: { name: 'Hookshot', maxValue: 1 },
    hammer: { name: 'Hammer', maxValue: 1 },
    firerod: { name: 'Fire Rod', maxValue: 1 },
    icerod: { name: 'Ice Rod', maxValue: 1 },
    boomerang: { name: 'Boomerang', maxValue: 2 },
    lantern: { name: 'Lantern', maxValue: 1 },
    flute: { name: 'Flute', maxValue: 1 },
    sword: { name: 'Sword', maxValue: 4 },
    tunic: { name: 'Tunic', maxValue: 2 },
    shield: { name: 'Shield', maxValue: 3 },
    boss0: { name: 'Eastern Palace', maxValue: 1 },
    book: { name: 'Book', maxValue: 1 },
    mirror: { name: 'Mirror', maxValue: 1 },
    bombos: { name: 'Bombos', maxValue: 1 },
    ether: { name: 'Ether', maxValue: 1 },
    quake: { name: 'Quake', maxValue: 1 },
    boss1: { name: 'Desert Palace', maxValue: 1 },
    shovel: { name: 'Shovel', maxValue: 1 },
    glove: { name: 'Glove', maxValue: 2 },
    bottle: { name: 'Bottle', maxValue: 1 },
    somaria: { name: 'Somaria', maxValue: 1 },
    byrna: { name: 'Byrna', maxValue: 1 },
    boots: { name: 'Boots', maxValue: 1 },
    boss2: { name: 'Tower of Hera', maxValue: 1 },
    powder: { name: 'Powder', maxValue: 1 },
    mushroom: { name: 'Mushroom', maxValue: 1 },
    cape: { name: 'Cape', maxValue: 1 },
    moonpearl: { name: 'Moon Pearl', maxValue: 1 },
    flippers: { name: 'Flippers', maxValue: 1 },
    agahnim: { name: 'Agahnim', maxValue: 1 },
    boss3: { name: 'Palace of Darkness', maxValue: 1 },
    boss4: { name: 'Swamp Palace', maxValue: 1 },
    boss5: { name: 'Skull Woods', maxValue: 1 },
  }
  
  Object.entries(itemDefs).forEach(([id, def]) => {
    items[id] = { id, name: def.name, value: 0, maxValue: def.maxValue }
  })

  return {
    items,
    chests: [],
    dungeons: [
      { id: 'eastern', name: 'Eastern Palace', completed: false, accessible: true, x: 192, y: 136 },
      { id: 'desert', name: 'Desert Palace', completed: false, accessible: true, x: 30, y: 192 },
      { id: 'hera', name: 'Tower of Hera', completed: false, accessible: true, x: 114, y: 34 },
      { id: 'darkness', name: 'Palace of Darkness', completed: false, accessible: false, x: 192, y: 136 },
      { id: 'swamp', name: 'Swamp Palace', completed: false, accessible: false, x: 74, y: 192 },
      { id: 'skull', name: 'Skull Woods', completed: false, accessible: false, x: 76, y: 64 },
    ],
    settings: {
      showChests: true,
      showCrystals: true,
      showMedallions: true,
      showMap: true,
      mapPosition: 'below',
      mapOrientation: 'horizontal'
    }
  }
}

const STORAGE_KEY = 'alttp-tracker-state'

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : createInitialGameState()
    } catch {
      return createInitialGameState()
    }
  })

  const updateItem = useCallback((itemId: string, value: number) => {
    setGameState(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [itemId]: { ...prev.items[itemId], value }
      }
    }))
  }, [])

  const toggleDungeon = useCallback((dungeonId: string) => {
    setGameState(prev => ({
      ...prev,
      dungeons: prev.dungeons.map(dungeon =>
        dungeon.id === dungeonId 
          ? { ...dungeon, completed: !dungeon.completed }
          : dungeon
      )
    }))
  }, [])

  const toggleChest = useCallback((chestId: string) => {
    setGameState(prev => ({
      ...prev,
      chests: prev.chests.map(chest => 
        chest.id === chestId 
          ? { 
              ...chest, 
              status: chest.status === 'green' 
                ? 'red' 
                : chest.status === 'red'
                ? 'yellow'
                : chest.status === 'yellow'
                ? 'disabled'
                : 'green'
            }
          : chest
      )
    }))
  }, [])

  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setGameState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }))
  }, [])

  const resetGame = useCallback(() => {
    const newState = createInitialGameState()
    setGameState(newState)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
  }, [])

  const saveGame = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
  }, [gameState])

  const loadGame = useCallback((): GameState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const loadedState = JSON.parse(saved)
        setGameState(loadedState)
        return loadedState
      }
    } catch (error) {
      console.error('Error loading game state:', error)
    }
    return null
  }, [])

  useEffect(() => {
    saveGame()
  }, [gameState, saveGame])

  return {
    gameState,
    updateItem,
    toggleDungeon,
    toggleChest,
    updateSettings,
    resetGame,
    saveGame,
    loadGame,
  }
}

// Types pour l'application ALTTP Tracker React (identique à l'original)

export interface GameItem {
  id: string
  name: string
  value: number
  maxValue: number
  image?: string
}

export interface ItemGrid {
  [key: string]: GameItem
}

export interface Chest {
  id: string
  x: number
  y: number
  status: 'green' | 'red' | 'yellow' | 'disabled'
}

export interface Dungeon {
  id: string
  name: string
  completed: boolean
  accessible: boolean
  x: number
  y: number
  requirements?: string[]
}

export interface GameState {
  items: ItemGrid
  chests: Chest[]
  dungeons: Dungeon[]
  settings: GameSettings
}

export interface GameSettings {
  showChests: boolean
  showCrystals: boolean
  showMedallions: boolean
  showMap: boolean
  mapPosition: 'below' | 'side'
  mapOrientation: 'horizontal' | 'vertical'
}

// Types pour les items spécifiques basés sur l'application originale
export type ItemType = 
  | 'bow' | 'hookshot' | 'hammer' | 'firerod' | 'icerod' | 'boomerang'
  | 'lantern' | 'flute' | 'sword' | 'tunic' | 'shield' | 'boss0'
  | 'book' | 'mirror' | 'bombos' | 'ether' | 'quake' | 'boss1'
  | 'shovel' | 'glove' | 'bottle' | 'somaria' | 'byrna' | 'boots' | 'boss2'
  | 'powder' | 'mushroom' | 'cape' | 'moonpearl' | 'flippers' | 'agahnim'
  | 'boss3' | 'boss4' | 'boss5'

// Interface pour les props des composants
export interface ItemGridProps {
  items: ItemGrid
  onItemClick: (itemId: string, value: number) => void
}

export interface MapTrackerProps {
  chests: Chest[]
  dungeons: Dungeon[]
  onChestToggle: (chestId: string) => void
  onDungeonToggle: (dungeonId: string) => void
  mapOrientation: 'horizontal' | 'vertical'
}

export interface SettingsProps {
  settings: GameSettings
  onSettingsChange: (newSettings: Partial<GameSettings>) => void
}

// Interface pour les hooks personnalisés
export interface UseGameStateReturn {
  gameState: GameState
  updateItem: (itemId: string, value: number) => void
  toggleChest: (chestId: string) => void
  toggleDungeon: (dungeonId: string) => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetGame: () => void
  saveGame: () => void
  loadGame: () => GameState | null
}

// Types pour les événements
export type ItemClickEvent = (itemId: string, newValue: number) => void
export type ChestToggleEvent = (chestId: string, status: Chest['status']) => void
export type DungeonToggleEvent = (dungeonId: string, completed: boolean) => void
export type SettingsChangeEvent = (settings: Partial<GameSettings>) => void

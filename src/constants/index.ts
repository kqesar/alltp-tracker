// CSS Class Names
export const CSS_CLASSES = {
  CAPTION_CONTAINER: "caption-container",
  CORNER: "corner",
  GRID_ITEM_BASE: "grid-item-base",
  GRID_ITEM_RELATIVE: "grid-item-relative",
  GRID_SPACER: "grid-spacer",
  GRIDITEM: "griditem",
  HALFCELL: "halfcell",

  // Layout classes
  ITEMDIV: "itemdiv",

  // Special classes
  LONK: "lonk",
  MAP_CHEST: "map-chest",
  MAP_CONTAINER: "map-container",
  MAP_ELEMENT_BASE: "map-element-base",
  MAPDIV: "mapdiv",

  // Map element classes
  MAPSPAN: "mapspan",
  MINI: "mini",

  // Overlay classes
  OVERLAY_BASE: "overlay-base",
  OVERLAY_BOTTOM_LEFT: "overlay--bottom-left",
  OVERLAY_BOTTOM_RIGHT: "overlay--bottom-right",
  OVERLAY_TOP_RIGHT: "overlay--top-right",
  // Grid and tracker classes
  TRACKER: "tracker",
};

// Dungeon Indices
export const DUNGEON_INDICES = {
  MISERY_MIRE: 8,
  TURTLE_ROCK: 9,
};

// Medallion Values
export const MEDALLION_VALUES = {
  BOMBOS: 1,
  ETHER: 2,
  QUAKE: 3,
  UNKNOWN: 0,
};

// Glove (gauntlet) progression levels
export const GLOVE_LEVELS = {
  TITAN: 2, // Titan's Mitt
} as const;

// Boss progression states (value stored in items.bossN)
export const BOSS_STATES = {
  BEATEN: 2,
} as const;

// Small Keys Maximum Values per Dungeon Index (ordered by dungeon index 0-9)
export const SMALL_KEYS_MAX_BY_INDEX = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4] as const;

// Map Orientation Constants
export const MAP_COORDINATES = {
  COORDINATE_MULTIPLIER: 2,
  PERCENTAGE_MULTIPLIER: 100,
  SPLIT_THRESHOLD: 0.5,
};

// Grid Constants
export const GRID_CONSTANTS = {
  ITEMS_PER_ROW: 7,
};

// Keyboard Navigation Constants
export const KEYBOARD_NAVIGATION = {
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
} as const;

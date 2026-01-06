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

// Small Keys Maximum Values per Dungeon
export const SMALL_KEYS_MAX = {
  DESERT_PALACE: 1, // smallkey1
  EASTERN_PALACE: 1, // smallkey0
  ICE_PALACE: 2, // smallkey7
  MISERY_MIRE: 3, // smallkey8
  PALACE_OF_DARKNESS: 6, // smallkey3
  SKULL_WOODS: 3, // smallkey5
  SWAMP_PALACE: 1, // smallkey4
  THIEVES_TOWN: 1, // smallkey6
  TOWER_OF_HERA: 1, // smallkey2
  TURTLE_ROCK: 4, // smallkey9
} as const;

// Small Keys Maximum Values per Dungeon Index (ordered by dungeon index 0-9)
export const SMALL_KEYS_MAX_BY_INDEX = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4] as const;

// Asset Names
export const ASSET_NAMES = {
  MEDALLION_BOMBOS: "medallion1",
  MEDALLION_ETHER: "medallion2",
  MEDALLION_QUAKE: "medallion3",
  MEDALLION_UNKNOWN: "medallion0",
  POI: "poi.png",
};

// Map Orientation Constants
export const MAP_COORDINATES = {
  COORDINATE_MULTIPLIER: 2,
  PERCENTAGE_MULTIPLIER: 100,
  SPLIT_THRESHOLD: 0.5,
};

// Chest States
export const CHEST_STATES = {
  OPENED: 0,
};

// Availability Classes
export const AVAILABILITY_CLASSES = {
  OPENED: "opened",
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
  ENTER: "Enter",
  ESCAPE: "Escape",
  SPACE: " ",
  TAB: "Tab",
} as const;

// Empty String Constant
export const EMPTY_STRING = "";

// LocalStorage Keys
export const STORAGE_KEYS = {
  ITEM_LAYOUT: "alltp-tracker-item-layout",
  MAP_ORIENTATION: "alltp-tracker-map-orientation",
  MAP_POSITION: "alltp-tracker-map-position",
} as const;

// Map Settings
export const MAP_ORIENTATION_VALUES = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
} as const;

export const MAP_POSITION_VALUES = {
  BOTTOM: "bottom",
  SIDE: "side",
  TOP: "top",
} as const;

export type MapOrientation =
  (typeof MAP_ORIENTATION_VALUES)[keyof typeof MAP_ORIENTATION_VALUES];
export type MapPosition =
  (typeof MAP_POSITION_VALUES)[keyof typeof MAP_POSITION_VALUES];

/**
 * Values that carry game meaning and are shared across modules. Plain CSS class
 * names are written literally in the JSX instead: aliasing "griditem" to
 * CSS_CLASSES.GRIDITEM only made the markup harder to grep against the
 * stylesheets.
 */

/** Dungeons whose entrance is gated behind a medallion. */
export const DUNGEON_INDICES = {
  MISERY_MIRE: 8,
  TURTLE_ROCK: 9,
};

/** Value stored in medallions[dungeonIndex]. */
export const MEDALLION_VALUES = {
  BOMBOS: 1,
  ETHER: 2,
  QUAKE: 3,
  UNKNOWN: 0,
};

/** Glove (gauntlet) progression levels. */
export const GLOVE_LEVELS = {
  TITAN: 2, // Titan's Mitt
} as const;

/** Boss progression state stored in items.bossN. */
export const BOSS_STATES = {
  BEATEN: 2,
} as const;

/** Small keys available per dungeon, indexed by dungeon index 0-9. */
export const SMALL_KEYS_MAX_BY_INDEX = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4] as const;

/** Percentage-coordinate maths for map markers. */
export const MAP_COORDINATES = {
  COORDINATE_MULTIPLIER: 2,
  PERCENTAGE_MULTIPLIER: 100,
  SPLIT_THRESHOLD: 0.5,
};

/** Columns rendered per tracker grid row. */
export const ITEMS_PER_ROW = 7;

/** Arrow keys handled by the grid navigation. */
export const KEYBOARD_NAVIGATION = {
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
} as const;

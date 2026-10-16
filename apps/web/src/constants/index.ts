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

/** Boss progression state stored in items.bossN. */
export const BOSS_STATES = {
  BEATEN: 2,
} as const;

/** Columns rendered per tracker grid row. */
export const ITEMS_PER_ROW = 7;

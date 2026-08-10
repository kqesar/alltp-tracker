import { DUNGEON_INDICES, GLOVE_LEVELS, MEDALLION_VALUES } from "@/constants";
import { getAssetPath } from "@/utils";

/** Accessibility states returned by chest/dungeon availability logic. */
export type Availability = "available" | "possible" | "unavailable";

/**
 * Tracked item state.
 *
 * The index signature is what the logic actually reads from: items are looked
 * up by computed keys (`chest${index}`, `bigkey${index}`, ...). The explicit
 * members are only those compared numerically below, which the index signature
 * alone would type as `number | boolean` and so refuse to compare.
 */
export interface ItemState {
  [key: string]: number | boolean;

  agahnim: number;
  bow: number;
  chest0: number;
  chest1: number;
  chest2: number;
  chest3: number;
  chest4: number;
  chest5: number;
  chest6: number;
  chest7: number;
  chest8: number;
  chest9: number;
  glove: number;
  sword: number;
}

export interface ChestItem {
  name: string;
  x: string;
  y: string;
  isOpened: boolean;
  isAvailable: (items: ItemState, medallions?: number[]) => Availability;
}

export interface DungeonItem {
  name: string;
  x: string;
  y: string;
  image: string;
  isBeaten: boolean;
  isBeatable: (
    items: ItemState,
    medallions?: number[],
    bigKeysVisible?: boolean,
  ) => Availability;
  canGetChest: (items: ItemState, medallions?: number[]) => Availability;
}

/**
 * Collapse a single requirement into the two states it can produce. Takes
 * `unknown` because item values are `number | boolean` and the game logic
 * relies on their truthiness throughout.
 */
export const avail = (reachable: unknown): Availability =>
  reachable ? "available" : "unavailable";

/** True when the player has the Titan's Mitt (glove level 2). */
export const hasTitansMitt = (items: ItemState): boolean =>
  items.glove === GLOVE_LEVELS.TITAN;

/** True when the player can cross into the Dark World at all. */
export function canReachDarkWorld(items: ItemState): boolean {
  if (!items.moonpearl) return false;
  if (hasTitansMitt(items) || (items.glove > 0 && items.hammer)) return true;
  return Boolean(
    items.agahnim > 0 &&
      items.hookshot &&
      (items.hammer || items.glove > 0 || items.flippers),
  );
}

/** True when the player can reach the southern Dark World (village side). */
export const canReachSouthDarkWorld = (items: ItemState): boolean =>
  canReachDarkWorld(items) ||
  Boolean(items.agahnim && items.moonpearl && items.hammer);

/** True when the player can get onto Death Mountain. */
export const canReachDeathMountain = (items: ItemState): boolean =>
  Boolean(items.glove || items.flute);

/** True when the player can cross to the east side of Death Mountain. */
export const canReachEastDeathMountain = (items: ItemState): boolean =>
  canReachDeathMountain(items) &&
  Boolean(items.hookshot || (items.mirror && items.hammer));

/**
 * Evaluates the medallion gate for Misery Mire / Turtle Rock.
 * @returns an Availability when the gate is decisive ("unavailable" / "possible"),
 * or null when the gate is satisfied and evaluation should continue.
 */
export function checkMedallion(
  items: ItemState,
  medallions: number[],
  index: number,
): Availability | null {
  if (!items.bombos && !items.ether && !items.quake) return "unavailable";
  if (
    (medallions[index] === MEDALLION_VALUES.BOMBOS && !items.bombos) ||
    (medallions[index] === MEDALLION_VALUES.ETHER && !items.ether) ||
    (medallions[index] === MEDALLION_VALUES.QUAKE && !items.quake)
  )
    return "unavailable";
  if (
    medallions[index] === MEDALLION_VALUES.UNKNOWN &&
    !(items.bombos && items.ether && items.quake)
  )
    return "possible";
  return null;
}

/**
 * Builds the inline icon markup used inside chest/dungeon names. Centralizing
 * it here keeps the raw <img> markup out of the data definitions, so the
 * markup format lives in a single place.
 * @param asset - Icon asset filename (e.g. "moonpearl.png")
 */
export function icon(asset: string): string {
  return `<img src='${getAssetPath(asset)}' class='mini'/>`;
}

/**
 * Builds the caption for a dungeon. For Misery Mire (8) and Turtle Rock (9)
 * it appends the currently-selected medallion requirement icon, resolved from
 * the medallions array.
 */
export function buildDungeonCaption(
  dungeon: DungeonItem,
  index: number,
  medallions: number[],
): string {
  if (
    index !== DUNGEON_INDICES.MISERY_MIRE &&
    index !== DUNGEON_INDICES.TURTLE_ROCK
  ) {
    return dungeon.name;
  }
  const medallion = medallions[index] ?? MEDALLION_VALUES.UNKNOWN;
  return `${dungeon.name} ${icon(`medallion${medallion}.png`)}`;
}

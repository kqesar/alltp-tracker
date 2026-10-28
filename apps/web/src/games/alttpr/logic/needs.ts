// The engine's blockers in the tracker's words: each atom (an item at a
// level, a count of crystals) as the name and the icon the player knows it
// by, from the grid's cells where it has one.
import { type Atom, type Blockers, itemValue, type State } from "@alltp/engine";
import { DUNGEONS } from "@alltp/pack-alttpr";
import {
  items as freshItems,
  itemLabels,
  STARTING_HEARTS,
} from "@/games/alttpr/data/items";
import { PACK_ITEMS } from "@/games/alttpr/logic/packItems";

/** One thing to get, as the tracker shows it. */
export type Need = {
  /** Stable across renders: the atom, as `item>=level`. */
  readonly key: string;
  readonly label: string;
  /** Its icon, under `assets/`; none for what the grid draws no cell of. */
  readonly icon?: string;
};

/** The ways to get somewhere: each a set of needs, fewest first. */
export type Ways = {
  readonly sets: readonly (readonly Need[])[];
  /**
   * Some ways were left out: the engine keeps the cheapest 32 per node.
   */
  readonly truncated: boolean;
  /**
   * No item brings it, everything held: in a run with shuffled entrances,
   * it is behind a door not noted yet.
   */
  readonly door?: true;
};

/** The names of an item's levels, from 1, where they differ. */
const LEVELS: Readonly<Record<string, readonly string[]>> = {
  armor: ["Blue Mail", "Red Mail"],
  glove: ["Power Glove", "Titan's Mitt"],
  magic: ["Half Magic", "Quarter Magic"],
  shield: ["Fighter's Shield", "Fire Shield", "Mirror Shield"],
  sword: ["Fighter's Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
};

/** Pack items whose name is not their cell's. */
const NAMES: Readonly<Record<string, string>> = {
  boomerang: "Blue Boomerang",
  bow: "Bow",
  crystal1: "Crystal 1",
  crystal2: "Crystal 2",
  crystal3: "Crystal 3",
  crystal4: "Crystal 4",
  crystal5: "Crystal 5",
  crystal6: "Crystal 6",
  crystal7: "Crystal 7",
  defeatAgahnim: "Agahnim",
  defeatAgahnim2: "Agahnim 2",
  pendantOfCourage: "Pendant of Courage",
  pendantOfPower: "Pendant of Power",
  pendantOfWisdom: "Pendant of Wisdom",
  redBoomerang: "Red Boomerang",
  silverArrowUpgrade: "Silver Arrows",
};

/** Icons of what no cell draws at its own value. */
const ICONS: Readonly<Record<string, string>> = {
  crystal1: "dungeon3.png",
  crystal2: "dungeon3.png",
  crystal3: "dungeon3.png",
  crystal4: "dungeon3.png",
  // The reward overlay's red crystal: the Pyramid Fairy's two
  crystal5: "dungeon4.png",
  crystal6: "dungeon4.png",
  crystal7: "dungeon3.png",
  defeatAgahnim: "agahnim0.png",
  defeatAgahnim2: "agahnim0.png",
  // One picture for the half and the quarter, as the cell shows it
  magic: "magic.png",
  pendantOfCourage: "dungeon1.png",
  pendantOfPower: "dungeon2.png",
  pendantOfWisdom: "dungeon2.png",
};

/** A dungeon's own item: its kind, then the dungeon's code. */
const DUNGEON_ITEM = /^(bigKey|compass|key|map)([A-Z]\d)$/;

const DUNGEON_ITEM_WORDS: Readonly<
  Record<string, { icon: string; name: string }>
> = {
  bigKey: { icon: "bigkey.png", name: "big key" },
  compass: { icon: "compass.png", name: "compass" },
  key: { icon: "smallkey.png", name: "small key" },
  map: { icon: "dungeonmap.png", name: "map" },
};

/** The grid's cell of a pack item, and the cell's value at a level. */
const CELLS: ReadonlyMap<string, (level: number) => string> = (() => {
  const cells = new Map<string, (level: number) => string>();
  for (const [id, entry] of Object.entries(PACK_ITEMS)) {
    if (entry.kind === "count" && !DUNGEON_ITEM.test(entry.item)) {
      const boolean = typeof freshItems[id] === "boolean";
      cells.set(entry.item, (level) =>
        boolean ? `${id}.png` : `${id}${level + (entry.base ?? 0)}.png`,
      );
    } else if (entry.kind === "bits") {
      entry.items.forEach((item, bit) => {
        cells.set(item, () => `${id}${1 << bit}.png`);
      });
    }
  }
  return cells;
})();

/** The cell id of a pack item, for its name. */
const CELL_IDS: ReadonlyMap<string, string> = new Map(
  Object.entries(PACK_ITEMS).flatMap(([id, entry]) =>
    entry.kind === "count" ? [[entry.item, id] as const] : [],
  ),
);

const plural = (count: number, one: string, many = `${one}s`) =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;

/** What each heart item adds to the hearts found: a piece is a quarter. */
const HEART_POWER: Readonly<Record<string, number>> = {
  heartContainer: 1,
  pieceOfHeart: 0.25,
};

const QUARTERS = ["", "¼", "½", "¾"];

/**
 * Hearts found, as the hearts on screen they make: 7 found are "10
 * hearts", the 3 Link starts with added, as the player counts them.
 */
const heartsNeed = (found: number): Need => {
  const shown = STARTING_HEARTS + found;
  const whole = Math.floor(shown);
  return {
    icon: "heart.png",
    key: `hearts>=${found}`,
    label: `${whole}${QUARTERS[Math.round((shown - whole) * 4)]} hearts`,
  };
};

/** An item at a level, in the tracker's words. */
const itemNeed = (item: string, level: number): Need => {
  const key = `${item}>=${level}`;
  const dungeonItem = DUNGEON_ITEM.exec(item);
  if (dungeonItem) {
    const [, kind, code] = dungeonItem;
    const words = DUNGEON_ITEM_WORDS[kind];
    const place = DUNGEONS.find((d) => d.code === code)?.name ?? code;
    return {
      icon: words.icon,
      key,
      label:
        kind === "key" && level > 1
          ? `${level} ${place} small keys`
          : `${place} ${words.name}`,
    };
  }
  const icon = ICONS[item] ?? CELLS.get(item)?.(level);
  const levels = LEVELS[item];
  if (levels) return { icon, key, label: levels[level - 1] ?? item };
  if (item === "bottle") {
    return { icon, key, label: level === 1 ? "Bottle" : `${level} Bottles` };
  }
  const cell = CELL_IDS.get(item);
  return {
    icon,
    key,
    label: NAMES[item] ?? (cell === undefined ? item : itemLabels(cell)),
  };
};

/** One atom of a blocker set, in the tracker's words. */
export const needOf = (atom: Atom): Need => {
  if ("item" in atom) {
    const power = HEART_POWER[atom.item];
    return power === undefined
      ? itemNeed(atom.item, atom.min)
      : heartsNeed(atom.min * power);
  }
  return {
    icon: atom.group === "crystal" ? "dungeon3.png" : undefined,
    key: `${atom.group}>=${atom.min}`,
    label:
      atom.group === "crystal"
        ? plural(atom.min, "crystal")
        : `${atom.min} ${atom.group}`,
  };
};

/**
 * A blocker set in the tracker's words: its heart containers and pieces as
 * the hearts they make with those held, as the hearts cell counts them (7
 * found, whether a seventh container or four pieces beside six).
 */
const setOf = (set: readonly Atom[], held: State): Need[] => {
  const hearts = new Map<string, number>();
  const needs: Need[] = [];
  for (const atom of set) {
    if ("item" in atom && HEART_POWER[atom.item] !== undefined) {
      hearts.set(atom.item, atom.min);
    } else needs.push(needOf(atom));
  }
  if (hearts.size === 0) return needs;
  const found = Object.entries(HEART_POWER).reduce(
    (sum, [item, power]) =>
      sum + power * Math.max(hearts.get(item) ?? 0, itemValue(held, item)),
    0,
  );
  return [heartsNeed(found), ...needs];
};

/**
 * The engine's blockers in the tracker's words: sets that read the same
 * (the ways to 7 hearts found, containers or pieces) are one.
 * @param held - The state they were worked out in, for the hearts held
 */
export const waysOf = (blockers: Blockers, held: State = {}): Ways => {
  const seen = new Set<string>();
  const sets: Need[][] = [];
  for (const set of blockers.sets) {
    const needs = setOf(set, held);
    const key = needs.map((need) => need.key).join();
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(needs);
  }
  return { sets, truncated: blockers.truncated };
};

/** Whether two lists of ways name the same sets. */
export const sameWays = (a: Ways, b: Ways): boolean =>
  a.sets.length === b.sets.length &&
  a.sets.every(
    (set, index) =>
      set.map((need) => need.key).join() ===
      b.sets[index]?.map((need) => need.key).join(),
  );

/** "Hammer, or Moon Pearl + Power Glove": the ways, as one line of text. */
export const waysText = (ways: Ways): string => {
  const text = ways.sets
    .map((set) => set.map((need) => need.label).join(" + "))
    .join(", or ");
  return ways.truncated ? `${text}, and more` : text;
};

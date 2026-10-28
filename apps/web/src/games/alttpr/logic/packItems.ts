// The tracker's items in the alltpr pack's terms: one table, from each of
// the tracker's item ids to what its value records for the rules. The run
// is read through it (trackerInput), and whatever else moves items between
// the tracker and the pack (autotracking) reads the same table, so an item
// added here reaches every one of them.
import {
  type DungeonId,
  dungeon,
  type HeldPrize,
  type InventoryItemId,
  ITEMS,
  LEGACY_DUNGEONS,
  PRE_COLLECTED_STATE,
  PRIZES,
  type Prize,
  STATE_MAX,
  type TrackerInput,
  UNKNOWN_COUNTS,
  type UnknownCount,
} from "@alltp/pack-alttpr";
import { BOSS_STATES } from "@/games/alttpr/constants";
import {
  items as freshItems,
  heartsOf,
  heartsShown,
  type ItemState,
  itemsMax,
  itemsMin,
} from "@/games/alttpr/data/items";

/** What one of the tracker's item ids records, in the pack's terms. */
export type PackItem =
  /**
   * A pack item, held as many times as the value counts up from `base`
   * (0 unless said): `true` is one, the tunic's 1 (green) none.
   */
  | {
      readonly kind: "count";
      readonly item: InventoryItemId;
      readonly base?: number;
    }
  /**
   * Pack items held or not, one per bit of the value, bit 0 first: the bow
   * (1 the silver arrows, 2 the bow, 3 both), the boomerangs.
   */
  | { readonly kind: "bits"; readonly items: readonly InventoryItemId[] }
  /** A dungeon finished, once the value is `at`: a boss beaten. */
  | {
      readonly kind: "beaten";
      readonly dungeon: DungeonId;
      readonly at: number;
    }
  /** What a dungeon's boss drops, by the value: see REWARDS. */
  | { readonly kind: "prize"; readonly dungeon: DungeonId }
  /**
   * Link's hearts on screen (`heartsShown`): the heart containers and
   * pieces found beyond the 3 he starts with, to which the pack's toState
   * adds those 3 (every world is given them), so upstream's hasHealth
   * sums the hearts on screen; not set, the health is unknown to the rules.
   */
  | { readonly kind: "hearts" }
  /**
   * The heart pieces toward the next heart (0-3), which the `hearts` entry
   * reads with the hearts on screen: a quarter each, nothing while the
   * hearts are not set.
   */
  | { readonly kind: "quarters" }
  /**
   * A count no cell draws, which autotracking reads: 0 not known (the
   * pack's `unknown`), else the item held one less times than the value.
   */
  | {
      readonly kind: "known";
      readonly item: InventoryItemId;
      readonly count: UnknownCount;
    }
  /**
   * Whether an item held reached its higher level, which no cell draws and
   * autotracking reads outside Race Mode: the flute activated (flute 2),
   * where the flute's cell says found. ACTIVATION gives the values: by hand
   * (0) the item is as its cell says; in Race Mode (1) whether it was
   * activated is the pack's unknown `count`, so a rule asking for it is
   * maybe at most; read (2, 3) it is not, or is. Only while the cell holds
   * the item: clearing the cell clears the level.
   */
  | {
      readonly kind: "activation";
      readonly item: InventoryItemId;
      readonly at: number;
      readonly count: UnknownCount;
    }
  /**
   * Standard's escape, which no cell draws and autotracking reads: 0 not
   * known (Hyrule Castle counted finished, as a run by hand counts it), 1
   * Zelda not yet in the Sanctuary, 2 the escape done.
   */
  | { readonly kind: "escape" }
  /**
   * How many prizes of a class Link holds, whichever dungeons gave them,
   * as autotracking counts them (the crystals never told 5/6 or not): no
   * cell draws it, and the rules get at least as many (TrackerInput's
   * `held`).
   */
  | { readonly kind: "held"; readonly prize: HeldPrize }
  /** Nothing the rules read: the blank cell, a dungeon's counter. */
  | { readonly kind: "none" };

/**
 * The values of the `escape` cell. It never sticks: Race Mode, the end of
 * autotracking, an imported or shared run set it back to NOT_KNOWN
 * (`forgetEscape`, `loadProgress`), and the relay of a race never carries it.
 */
export const ESCAPE = {
  /** Read: the escape done. */
  DONE: 2,
  /** Read: Zelda not yet in the Sanctuary. */
  GOING: 1,
  /** Not known: Hyrule Castle counted finished, as a run by hand counts it. */
  NOT_KNOWN: 0,
} as const;

/** A run's items with the escape no longer known: the same object if it was not. */
export const withoutEscape = <Items extends Readonly<Record<string, unknown>>>(
  items: Items,
): Items =>
  items.escape === undefined || items.escape === ESCAPE.NOT_KNOWN
    ? items
    : { ...items, escape: ESCAPE.NOT_KNOWN };

/** The values of an `activation` cell (`fluteactive`). */
export const ACTIVATION = {
  /** Read: activated. */
  ACTIVE: 3,
  /** Read: not activated. */
  INACTIVE: 2,
  /** Not read: the item is as its cell says (a run by hand). */
  NOT_READ: 0,
  /** Read in Race Mode, which never reads it: not known. */
  UNKNOWN: 1,
} as const;

/**
 * The prize each reward value records: 1 the Pendant of Courage, 2 another
 * pendant, 3 a crystal, 4 crystal 5 or 6; 0 unknown.
 */
const REWARDS: readonly (Prize | undefined)[] = [
  undefined,
  "greenPendant",
  "pendant",
  "crystal",
  "redCrystal",
];

const NONE: PackItem = { kind: "none" };

const count = (item: InventoryItemId, base?: number): PackItem =>
  base === undefined ? { item, kind: "count" } : { base, item, kind: "count" };

/** One entry per grid dungeon (`bigkey0`...`bigkey9`), from its pack id. */
const perDungeon = (
  prefix: string,
  entry: (id: DungeonId) => PackItem,
): Record<string, PackItem> =>
  Object.fromEntries(
    LEGACY_DUNGEONS.map((id, index) => [`${prefix}${index}`, entry(id)]),
  );

/** A dungeon's own item, by its kind and the dungeon's code: `bigKeyP1`. */
const dungeonItem =
  (kind: "bigKey" | "compass" | "map") =>
  (id: DungeonId): PackItem =>
    count(`${kind}${dungeon(id).code}` as InventoryItemId);

/** Every item id the tracker tracks, and what it records for the rules. */
export const PACK_ITEMS: Readonly<Record<string, PackItem>> = {
  agahnim: { at: 1, dungeon: "castle-tower", kind: "beaten" },
  // Agahnim beaten again, atop Ganon's Tower: its map marker
  agahnim2: { at: 1, dungeon: "ganons-tower", kind: "beaten" },
  blank: NONE,
  bombos: count("bombos"),
  book: count("bookOfMudora"),
  boomerang: { items: ["boomerang", "redBoomerang"], kind: "bits" },
  boots: count("pegasusBoots"),
  bottle: count("bottle"),
  bow: { items: ["silverArrowUpgrade", "bow"], kind: "bits" },
  byrna: count("caneOfByrna"),
  cape: count("cape"),
  // What autotracking alone sets, no cell drawing it: Standard's escape,
  // the flute activated (canFly without the weathervane, which only
  // Inverted can deny), the prizes held by class
  escape: { kind: "escape" },
  ether: count("ether"),
  firerod: count("fireRod"),
  flippers: count("flippers"),
  // Found: this world activates it without the weathervane (canFly)
  flute: count("flute"),
  fluteactive: { at: 2, count: "flute", item: "flute", kind: "activation" },
  glove: count("glove"),
  // A triforce hunt's pieces, which no rule of the pack reads: its go mode
  // is the count (goModeStatusOf)
  goalpieces: NONE,
  hammer: count("hammer"),
  heartquarters: { kind: "quarters" },
  hearts: { kind: "hearts" },
  heldcrystals: { kind: "held", prize: "crystal" },
  heldgreen: { kind: "held", prize: "greenPendant" },
  heldpendants: { kind: "held", prize: "pendant" },
  hookshot: count("hookshot"),
  icerod: count("iceRod"),
  lantern: count("lamp"),
  // 1 the half magic, 2 the quarter: the pack's `magic` counts the same
  magic: count("magic"),
  mirror: count("magicMirror"),
  moonpearl: count("moonPearl"),
  mushroom: count("mushroom"),
  net: count("bugCatchingNet"),
  powder: count("powder"),
  quake: count("quake"),
  shield: count("shield"),
  // The retro world's shops: what a shop found sells (ItemCollection.php)
  shoparrow: count("shopArrow"),
  shopkey: count("shopKey"),
  shovel: count("shovel"),
  somaria: count("caneOfSomaria"),
  sword: count("sword"),
  // The escape's Ten Bombs: known only once autotracking reads them
  tenbombs: { count: "bombs", item: "tenBombs", kind: "known" },
  triforce: NONE,
  // 1 the green tunic, which every run starts with: no armor yet
  tunic: count("armor", 1),
  ...perDungeon("bigkey", dungeonItem("bigKey")),
  // With wild maps and compasses (MC Shuffle and up) a boss wants its dungeon's
  ...perDungeon("map", dungeonItem("map")),
  ...perDungeon("compass", dungeonItem("compass")),
  ...perDungeon("boss", (id) => ({
    at: BOSS_STATES.BEATEN,
    dungeon: id,
    kind: "beaten",
  })),
  // The items a dungeon has left: the map counts them, the rules do not
  ...perDungeon("chest", () => NONE),
  ...perDungeon("reward", (id) => ({ dungeon: id, kind: "prize" })),
  // The castle dungeons' own items, on key cells 10-12 (KEY_DUNGEONS), as
  // their pools hold them
  bigkey12: dungeonItem("bigKey")("ganons-tower"),
  // Ganon's Tower's items left, which the rules do not read either
  chest12: NONE,
  compass12: dungeonItem("compass")("ganons-tower"),
  map10: dungeonItem("map")("hyrule-castle"),
  map12: dungeonItem("map")("ganons-tower"),
};

/**
 * The unknown counts an `activation` cell stands for: known unless it says
 * Race Mode did not read them (a run by hand counts the item as its cell
 * says), where the hearts and the bombs are unknown until set.
 */
const ACTIVATION_COUNTS: ReadonlySet<UnknownCount> = new Set(
  Object.values(PACK_ITEMS).flatMap((entry) =>
    entry.kind === "activation" ? [entry.count] : [],
  ),
);

/** The pool's heart containers and pieces: the most the hearts cell records. */
const POOL = new Map(ITEMS.map(({ id, max }) => [id, max]));
const HEART_CONTAINERS = POOL.get("heartContainer") ?? 0;
const PIECES_OF_HEART = POOL.get("pieceOfHeart") ?? 0;

/** The heart containers every world is given: Link's 3 starting hearts. */
const GIVEN_HEARTS = PRE_COLLECTED_STATE.heartContainer ?? 0;

/**
 * Every pack item the tracker's cells can record, at the highest level they
 * reach: a count's top less its base (the tunic's 3 is armor 2), each bit's
 * item, the event a dungeon beaten gives (Agahnim, Agahnim 2), the prizes a
 * boss drops, and the heart containers and pieces the hearts cell stands
 * for, as the state holds them: the pool's 11 and the 3 every world is
 * given (the pack's STATE_MAX), and the pool's 24 pieces. What the cells
 * cannot say (the escape's bombs and its end, the flute activated, the
 * bow's second level) is left out: no player could mark it collected.
 */
export const RECORDED_LEVELS: ReadonlyMap<string, number> = (() => {
  const levels = new Map<string, number>();
  const reach = (item: string, level: number) =>
    levels.set(item, Math.max(levels.get(item) ?? 0, level));
  for (const [id, entry] of Object.entries(PACK_ITEMS)) {
    if (entry.kind === "count") {
      const top = typeof freshItems[id] === "boolean" ? 1 : (itemsMax[id] ?? 1);
      reach(entry.item, top - (entry.base ?? 0));
    } else if (entry.kind === "bits") {
      for (const item of entry.items) reach(item, 1);
    } else if (entry.kind === "hearts") {
      reach("heartContainer", STATE_MAX.get("heartContainer") ?? 0);
      reach("pieceOfHeart", STATE_MAX.get("pieceOfHeart") ?? 0);
    } else if (entry.kind === "beaten") {
      const { event } = dungeon(entry.dungeon);
      if (event) reach(event.item, 1);
    }
  }
  for (const item of Object.values(PRIZES).flat()) reach(item, 1);
  return levels;
})();

/**
 * What the tracker's items record: TrackerInput's items, beaten, prizes, the
 * prizes held by class, and the counts it does not know.
 */
export type PackReading = Pick<
  TrackerInput,
  "beaten" | "held" | "items" | "prizes" | "unknown"
>;

/**
 * The heart containers and pieces of hearts found, as upstream's hasHealth
 * sums them beside the 3 every world is given: the containers first, up to
 * the pool's, then four pieces a heart, then the pieces toward the next
 * heart, never more pieces than the pool holds.
 * @param found - The whole hearts found
 * @param quarters - The pieces toward the next heart
 */
const heartItems = (
  found: number,
  quarters: number,
): Partial<Record<InventoryItemId, number>> => {
  const containers = Math.min(HEART_CONTAINERS, found);
  return {
    heartContainer: containers,
    pieceOfHeart: Math.min(
      PIECES_OF_HEART,
      4 * (found - containers) + quarters,
    ),
  };
};

/**
 * The tracker's items as the pack reads them, through PACK_ITEMS. Like a
 * legacy run, a run counts Hyrule Castle finished, Zelda rescued: no cell
 * records the escape, which in Standard opens the Light World, until
 * autotracking reads that Zelda is not yet in the Sanctuary (`escape` 1).
 * The flute activated raises the flute to 2, and the prizes held by class
 * go to `held`. An id the table lacks records nothing. The hearts found
 * are those on screen less the 3 Link starts with, which the pack's toState
 * gives, with the pieces toward the next one; hearts not set (or not given) leave the health unknown, and the
 * escape's bombs are unknown until autotracking reads them.
 * @param items - The run's items, by the tracker's ids
 */
export const packReading = (items: Readonly<ItemState>): PackReading => {
  const held: Partial<Record<InventoryItemId, number>> = {};
  const beaten: Partial<Record<DungeonId, boolean>> = {
    "hyrule-castle": true,
  };
  const prizes: Partial<Record<DungeonId, Prize>> = {};
  const prizesHeld: Partial<Record<HeldPrize, number>> = {};
  const atLeast = new Map<InventoryItemId, number>();
  const known = new Set<UnknownCount>();
  /** An activation Race Mode did not read: its count is not known. */
  const notRead = new Set<UnknownCount>();
  const hold = (item: InventoryItemId, times: number) => {
    if (times > 0) held[item] = (held[item] ?? 0) + times;
  };
  for (const [id, raw] of Object.entries(items)) {
    const entry = Object.hasOwn(PACK_ITEMS, id) ? PACK_ITEMS[id] : undefined;
    const value = Number(raw);
    switch (entry?.kind) {
      case "count":
        hold(entry.item, value - (entry.base ?? 0));
        break;
      case "bits":
        entry.items.forEach((item, bit) => {
          hold(item, (value >> bit) & 1);
        });
        break;
      case "beaten":
        if (value === entry.at) beaten[entry.dungeon] = true;
        break;
      case "prize": {
        const prize = REWARDS[value];
        if (prize !== undefined) prizes[entry.dungeon] = prize;
        break;
      }
      case "known":
        if (value > 0) {
          known.add(entry.count);
          hold(entry.item, value - 1);
        }
        break;
      case "hearts": {
        const { quarters } = heartsOf(items);
        const shown = heartsShown(value);
        if (shown === null) break;
        known.add("health");
        for (const [item, times] of Object.entries(
          heartItems(shown - GIVEN_HEARTS, quarters),
        )) {
          hold(item as InventoryItemId, times);
        }
        break;
      }
      case "activation":
        if (value === ACTIVATION.ACTIVE) atLeast.set(entry.item, entry.at);
        if (value === ACTIVATION.UNKNOWN) notRead.add(entry.count);
        break;
      case "escape":
        // Zelda not yet in the Sanctuary: Hyrule Castle not finished
        if (value === ESCAPE.GOING) beaten["hyrule-castle"] = false;
        break;
      case "held":
        if (value > 0) prizesHeld[entry.prize] = value;
        break;
    }
  }
  // A level only while the cell holds the item: cleared, the flute is gone
  for (const [item, level] of atLeast) {
    if ((held[item] ?? 0) > 0) held[item] = Math.max(held[item] ?? 0, level);
  }
  return {
    beaten,
    ...(Object.keys(prizesHeld).length > 0 && { held: prizesHeld }),
    items: held,
    prizes,
    unknown: Object.fromEntries(
      (Object.keys(UNKNOWN_COUNTS) as UnknownCount[])
        .filter((count) =>
          ACTIVATION_COUNTS.has(count) ? notRead.has(count) : !known.has(count),
        )
        .map((count) => [count, true]),
    ),
  };
};

/**
 * The tracker's item values that pack item counts make, through PACK_ITEMS:
 * every id whose entry is a count or bits, from the pack items it reads (one
 * left out is not held), within the item's range. A held-or-not item is
 * `true` or `false`. A boss beaten, a prize, a dungeon's counter are no pack
 * item: their ids are left out, and so are the hearts, which autotracking
 * reads as the game shows them (`decodeHealth`).
 * @param counts - Pack items held, by pack id: an autotracker's reading
 */
export const itemsFromPack = (
  counts: Readonly<Partial<Record<string, number>>>,
): Partial<ItemState> => {
  const items: Record<string, number | boolean> = {};
  const held = (item: InventoryItemId) => counts[item] ?? 0;
  for (const [id, entry] of Object.entries(PACK_ITEMS)) {
    let value: number;
    if (entry.kind === "count") value = (entry.base ?? 0) + held(entry.item);
    else if (entry.kind === "known") {
      // Known only where the reading has it
      if (!(entry.item in counts)) continue;
      value = 1 + Math.min(1, held(entry.item));
    } else if (entry.kind === "bits") {
      value = entry.items.reduce(
        (sum, item, bit) => sum | (Math.min(1, held(item)) << bit),
        0,
      );
    } else if (entry.kind === "activation") {
      // Known only where the reading has it, as for a count; Race Mode lays
      // its own value (autotrack/apply.ts)
      if (!(entry.item in counts)) continue;
      value =
        held(entry.item) >= entry.at ? ACTIVATION.ACTIVE : ACTIVATION.INACTIVE;
    } else continue;
    items[id] =
      typeof freshItems[id] === "boolean"
        ? value > 0
        : Math.max(itemsMin[id] ?? 0, Math.min(itemsMax[id] ?? 0, value));
  }
  return items as Partial<ItemState>;
};

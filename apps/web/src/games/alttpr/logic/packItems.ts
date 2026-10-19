// The tracker's items in the alltpr pack's terms: one table, from each of
// the tracker's item ids to what its value records for the rules. The run
// is read through it (trackerInput), and whatever else moves items between
// the tracker and the pack (autotracking) reads the same table, so an item
// added here reaches every one of them.
import {
  type DungeonId,
  dungeon,
  type InventoryItemId,
  LEGACY_DUNGEONS,
  PRIZES,
  type Prize,
  type TrackerInput,
} from "@alltp/pack-alttpr";
import { BOSS_STATES } from "@/games/alttpr/constants";
import {
  items as freshItems,
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
  /** Nothing the rules read: the blank cell, a dungeon's counter. */
  | { readonly kind: "none" };

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
  ether: count("ether"),
  firerod: count("fireRod"),
  flippers: count("flippers"),
  // Found: this world activates it without the weathervane (canFly)
  flute: count("flute"),
  glove: count("glove"),
  hammer: count("hammer"),
  hookshot: count("hookshot"),
  icerod: count("iceRod"),
  lantern: count("lamp"),
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
 * Every pack item the tracker's cells can record, at the highest level they
 * reach: a count's top less its base (the tunic's 3 is armor 2), each bit's
 * item, the event a dungeon beaten gives (Agahnim, Agahnim 2), and the
 * prizes a boss drops. What the cells cannot say (magic, bombs, hearts,
 * the bow's second level) is left out: no player could mark it collected.
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
    } else if (entry.kind === "beaten") {
      const { event } = dungeon(entry.dungeon);
      if (event) reach(event.item, 1);
    }
  }
  for (const item of Object.values(PRIZES).flat()) reach(item, 1);
  return levels;
})();

/** What the tracker's items record: TrackerInput's items, beaten, prizes. */
export type PackReading = Pick<TrackerInput, "beaten" | "items" | "prizes">;

/**
 * The tracker's items as the pack reads them, through PACK_ITEMS. Like a
 * legacy run, a run counts Hyrule Castle finished, Zelda rescued: the
 * tracker does not record the escape, which in Standard opens the Light
 * World. An id the table lacks records nothing.
 * @param items - The run's items, by the tracker's ids
 */
export const packReading = (items: Readonly<ItemState>): PackReading => {
  const held: Partial<Record<InventoryItemId, number>> = {};
  const beaten: Partial<Record<DungeonId, boolean>> = {
    "hyrule-castle": true,
  };
  const prizes: Partial<Record<DungeonId, Prize>> = {};
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
    }
  }
  return { beaten, items: held, prizes };
};

/**
 * The tracker's item values that pack item counts make, through PACK_ITEMS:
 * every id whose entry is a count or bits, from the pack items it reads (one
 * left out is not held), within the item's range. A held-or-not item is
 * `true` or `false`. A boss beaten, a prize, a dungeon's counter are no pack
 * item: their ids are left out.
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
    else if (entry.kind === "bits") {
      value = entry.items.reduce(
        (sum, item, bit) => sum | (Math.min(1, held(item)) << bit),
        0,
      );
    } else continue;
    items[id] =
      typeof freshItems[id] === "boolean"
        ? value > 0
        : Math.max(itemsMin[id] ?? 0, Math.min(itemsMax[id] ?? 0, value));
  }
  return items as Partial<ItemState>;
};

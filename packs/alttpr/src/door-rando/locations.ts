// The Door Randomizer's locations alttpr.com never had: the keys enemies and
// pots hold (key drops), the pots of its pottery modes, the enemies of its
// underworld drop shuffle, and the shops' items of shopsanity and take-any,
// each with the bit DR's base patch sets once it is collected; and the
// Overworld Randomizer's bonk drops (owr/bonk.json, written by import-dr
// --owr), with the bit of their screen's byte.
//
// locations.json is written by scripts/import-dr.mjs from DR at the release
// upstream.json pins (`doorRandomizer`), never by hand. This module says
// which of them a seed has, from its settings, as DR decides it: Regions.py's
// adjust_locations (1165-1232), valid_pot_location (1235-1246) and
// create_pot_location (1249-1272), EnemyList.py's valid_drop_location
// (source/dungeon/EnemyList.py:2248-2257), and the take-any shops
// ItemList.py builds (536-580).

import { locationId } from "@alltp/engine";
import type { DungeonId } from "../dungeons";
import data from "./locations.json" with { type: "json" };
import bonkData from "./owr/bonk.json" with { type: "json" };

/** Where DR's location table was read: its repo, release and commit. */
export const DR_UPSTREAM: {
  readonly commit: string;
  readonly license: string;
  readonly repo: string;
  readonly version: string;
} = data.upstream;

/** The kinds of DR location. */
export type DrLocationKind =
  /** One of the 33 keys an enemy or a pot holds in the vanilla game. */
  | "keyDrop"
  /** A pot (or a large block) of the pottery modes. */
  | "pot"
  /** An enemy of the underworld drop shuffle. */
  | "enemyDrop"
  /** A shop's item under shopsanity. */
  | "shop"
  /** An item of the old man's sword cave or a take-any cave. */
  | "takeAny"
  /** An Overworld Randomizer bonk drop: a tree, a rock pile, a statue. */
  | "bonk";

/**
 * The base patch's memory that says a location was collected: a bit of a
 * room's word in RoomPotData or SpriteDropData, or a shop slot's purchase
 * count in PurchaseCounts.
 */
export type DrFlag =
  | {
      readonly memory: "pot" | "drop";
      /** The supertile, $000-$127. */
      readonly room: number;
      /**
       * The pot's index in its room's list, or the sprite's slot (its index
       * less the overlords before it): bit $8000 >> `bit` of the word.
       */
      readonly bit: number;
    }
  | {
      readonly memory: "purchase";
      /** The shop's sram index plus the item's slot. */
      readonly index: number;
    }
  | {
      /** A screen's byte of the overworld's save data ($7EF280 on). */
      readonly memory: "overworld";
      /**
       * The screen, $00-$81; `NO_SCREEN` for a drop no screen holds (in a
       * cave), which is never read (`unflagged`).
       */
      readonly screen: number;
      readonly mask: number;
    };

/** One DR location. */
export interface DrLocation {
  /** locationId(name): the save key, as every location of the pack. */
  readonly id: string;
  /** DR's name, as its spoiler log writes it. */
  readonly name: string;
  readonly kind: DrLocationKind;
  /** DR's region (Regions.py), which its rules and the pot's name use. */
  readonly region: string;
  /** The pack's dungeon it lies in, or null outside the dungeons. */
  readonly dungeon: DungeonId | null;
  /** In a cave (RegionType.Cave), so a cave pottery mode's. */
  readonly cave: boolean;
  readonly flag: DrFlag;
  /** A pot's vanilla content (PotItem) and whether it is a large block. */
  readonly pot?: { readonly content: string; readonly block: boolean };
  /** The enemy that holds it, by DR's name (enemy_names). */
  readonly enemy?: string;
  /** A key drop: the key it holds in the vanilla game. */
  readonly key?: "small" | "big";
  /** An enemy of a room a shuffled boss rewrites the sprites of. */
  readonly bossRoom?: boolean;
  /** A take-any item: its shop's own sram index. */
  readonly takeAny?: { readonly sram: number };
  /**
   * A bonk drop: whether Agahnim must fall first, and where the
   * Overworld Randomizer's world map draws it (the 4096-pixel world's x
   * and y, its light or dark half by its region), if a screen holds it.
   */
  readonly bonk?: {
    readonly aga: boolean;
    readonly map?: { readonly x: number; readonly y: number };
  };
  /** Where DR defines it: `file:line` in its checkout. */
  readonly source: string;
}

const REGIONS: Readonly<
  Record<string, { readonly cave: boolean; readonly dungeon: string | null }>
> = data.regions;

/** A bonk drop's screen when no screen holds it (a cave's). */
export const NO_SCREEN = -1;

/**
 * The Overworld Randomizer's bonk drops (owr:Regions.py bonk_prize_table,
 * owr/bonk.json): a run's locations while it shuffles them (`bonkDrops`).
 * A drop's flag is the bit of its screen's byte the fork's own client reads
 * (owr:MultiClient.py:978-987); the Cold Fairy's statue, in a cave, has
 * none, so it is never read.
 */
export const BONK_DROPS: readonly DrLocation[] = bonkData.drops.map(
  (drop): DrLocation => ({
    bonk: {
      aga: drop.aga,
      ...(drop.map === undefined
        ? {}
        : { map: { x: drop.map.x, y: drop.map.y } }),
    },
    cave: drop.flag === undefined,
    dungeon: null,
    // The cave's statue has no flag: no memory says it was taken
    flag:
      drop.flag === undefined
        ? { mask: 0, memory: "overworld", screen: NO_SCREEN }
        : {
            mask: drop.flag.mask,
            memory: "overworld",
            screen: drop.flag.screen,
          },
    id: locationId(drop.name),
    kind: "bonk",
    name: drop.name,
    region: drop.region,
    source: drop.source,
  }),
);

/** Every DR location, key drops first, then pots, enemies and shops. */
export const DR_LOCATIONS: readonly DrLocation[] = data.locations.map(
  (entry) => {
    const place = REGIONS[entry.region];
    return {
      ...(entry as Omit<DrLocation, "id" | "dungeon" | "cave">),
      cave: place.cave,
      dungeon: place.dungeon as DungeonId | null,
      id: locationId(entry.name),
    };
  },
);

/** DR's pottery modes (resources/app/cli/args.json, `pottery`). */
export type PotteryMode =
  | "none"
  | "keys"
  | "dungeon"
  | "cave"
  | "cavekeys"
  | "reduced"
  | "clustered"
  | "nonempty"
  | "lottery";

/** DR's drop shuffle (`dropshuffle`). */
export type DropShuffle = "none" | "keys" | "underworld";

/** DR's take-any caves (`take_any`). */
export type TakeAny = "none" | "random" | "fixed";

/** The settings that decide a seed's DR locations. */
export interface DrModes {
  readonly pottery: PotteryMode;
  readonly dropShuffle: DropShuffle;
  readonly shopsanity: boolean;
  readonly takeAny: TakeAny;
  /** `potshuffle`: the pots' vanilla contents moved within each room. */
  readonly potShuffle: boolean;
  /** Enemies shuffled (`shuffleenemies` other than none). */
  readonly enemyShuffle: boolean;
  /** Bosses shuffled (`shufflebosses` other than none). */
  readonly bossShuffle: boolean;
  /** The Overworld Randomizer's bonk drops shuffled (`bonk_drops`). */
  readonly bonkDrops?: boolean;
}

/** Why a seed's list may lack some of its locations. */
export type DrPartial =
  /** reduced / clustered: a random share of the dungeon pots. */
  | "chosen-pots"
  /** Enemy shuffle: which enemies drop depends on the kinds placed. */
  | "enemy-shuffle"
  /** Boss shuffle: a moved boss rewrites its room's sprites. */
  | "boss-rooms"
  /** potshuffle with nonempty pottery: which pots hold something moved. */
  | "pot-contents";

/** A seed's DR locations, and what of them is not known. */
export interface DrLocationSet {
  readonly locations: readonly DrLocation[];
  /** Why the list may lack some of the seed's: empty when it is whole. */
  readonly partial: readonly DrPartial[];
  /**
   * Locations whose flag memory cannot tell: a key pot potshuffle may have
   * moved to another pot of its room (PotShuffle.py:881-899), a take-any's
   * second item when a purchase marks only the shop (shopkeeper.asm:486-489
   * of the base patch, without shopsanity).
   */
  readonly unflagged: ReadonlySet<string>;
}

/** The old man's sword cave's sram index (ItemList.py:546). */
const OLD_MAN_SRAM = 32;

/** Whether a pot is one a pottery mode makes a location (Regions.py:1235-1252). */
function potIsLocation(location: DrLocation, modes: DrModes): boolean {
  const { pottery } = modes;
  const content = location.pot?.content;
  // A switch pot only once potshuffle may move it (Regions.py:1250-1252)
  if (
    content === "Switch" &&
    !(
      modes.potShuffle &&
      !["none", "cave", "keys", "cavekeys"].includes(pottery)
    )
  ) {
    return false;
  }
  switch (pottery) {
    case "lottery":
      return true;
    case "nonempty":
      return content !== "Nothing";
    // The cave pots are all in the pool, the dungeon's a random share
    // (PotShuffle.py:968-998, choose_pots)
    case "reduced":
    case "clustered":
    case "cave":
    case "cavekeys":
      return location.cave;
    case "dungeon":
      return location.dungeon !== null;
    default:
      return false;
  }
}

/**
 * The seed's DR locations, from its settings: key drops by the drop
 * shuffle (enemy-held) and the pottery (pot-held, Regions.py:1186-1187), the
 * pottery mode's pots, the underworld shuffle's enemies, shopsanity's shop
 * items and the take-any caves' items.
 */
export function drLocationsOf(modes: DrModes): DrLocationSet {
  const partial = new Set<DrPartial>();
  const unflagged = new Set<string>();
  const potKeys = !["none", "cave"].includes(modes.pottery);
  const locations: DrLocation[] = DR_LOCATIONS.filter((location) => {
    if (location.kind === "keyDrop") {
      if (location.flag.memory === "drop") return modes.dropShuffle !== "none";
      if (potKeys && modes.potShuffle) unflagged.add(location.id);
      return potKeys;
    }
    if (location.kind === "pot") return potIsLocation(location, modes);
    if (location.kind === "enemyDrop") {
      return (
        modes.dropShuffle === "underworld" &&
        !modes.enemyShuffle &&
        !(modes.bossShuffle && location.bossRoom === true)
      );
    }
    if (location.kind === "shop") return modes.shopsanity;
    if (modes.takeAny === "none") return false;
    // A take-any's potion is a location under shopsanity alone, its heart
    // and the old man's sword always (ItemList.py:555-580)
    const second = location.name.endsWith("Item 2");
    const potion = location.takeAny?.sram !== OLD_MAN_SRAM && !second;
    if (potion && !modes.shopsanity) return false;
    if (second && !modes.shopsanity) unflagged.add(location.id);
    return true;
  });
  if (modes.pottery === "reduced" || modes.pottery === "clustered")
    partial.add("chosen-pots");
  if (modes.dropShuffle === "underworld" && modes.enemyShuffle)
    partial.add("enemy-shuffle");
  if (
    modes.dropShuffle === "underworld" &&
    !modes.enemyShuffle &&
    modes.bossShuffle
  )
    partial.add("boss-rooms");
  if (modes.pottery === "nonempty" && modes.potShuffle)
    partial.add("pot-contents");
  if (modes.bonkDrops === true)
    for (const drop of BONK_DROPS) {
      if (drop.flag.memory === "overworld" && drop.flag.screen === NO_SCREEN)
        unflagged.add(drop.id);
      locations.push(drop);
    }
  return { locations, partial: [...partial], unflagged };
}

/**
 * The keys a seed's key drops add to a dungeon's pool: each real key drop
 * gives the dungeon the key it held (Regions.py:1188-1199).
 */
export function drKeysAdded(
  locations: readonly DrLocation[],
  dungeon: DungeonId,
): { readonly small: number; readonly big: number } {
  let small = 0;
  let big = 0;
  for (const location of locations) {
    if (location.kind !== "keyDrop" || location.dungeon !== dungeon) continue;
    if (location.key === "big") big++;
    else small++;
  }
  return { big, small };
}

/**
 * The base patch's tables (aerinon/z3randomizer at d0f4651, sram.asm:390-392
 * and 644-646): RoomPotData and SpriteDropData, a word a room, and
 * PurchaseCounts, a byte a shop slot. Saved with the file in the expanded
 * SRAM, live in WRAM bank $7F.
 */
/** The save's overworld data, a byte a screen (z3:sram.asm:54-69). */
export const OVERWORLD_FLAGS = 0x7e_f280;

export const DR_TABLES = {
  drop: { bus: 0x7f_6268, size: 592 },
  pot: { bus: 0x7f_6018, size: 592 },
  purchase: { bus: 0x7f_64b8, size: 96 },
} as const;

/**
 * Where a DR flag lies: its byte or word on the A-bus and the bits that say
 * collected. A pot's or an enemy's bit is BitFieldMasks' $8000 >> index
 * (keydrop/standing_items.asm:571-573), set in the room's word, little
 * endian (standing_items.asm:226-227, 558-559, 616-619); a shop slot's
 * count goes up with each purchase (shopkeeper.asm:463-480), so any value
 * but 0 says bought.
 */
export function drFlagAddress(flag: DrFlag): {
  readonly bus: number;
  readonly size: 1 | 2;
  readonly mask: number;
} {
  if (flag.memory === "purchase") {
    return { bus: DR_TABLES.purchase.bus + flag.index, mask: 0xff, size: 1 };
  }
  // A screen's byte of the save's overworld data (SAVEDATA_START + 0x280,
  // owr:MultiClient.py:978-987)
  if (flag.memory === "overworld")
    return { bus: OVERWORLD_FLAGS + flag.screen, mask: flag.mask, size: 1 };
  return {
    bus: DR_TABLES[flag.memory].bus + flag.room * 2,
    mask: 0x8000 >> flag.bit,
    size: 2,
  };
}

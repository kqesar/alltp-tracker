// The tracker's save format before the pack, mapped to the pack: its item
// ids, its 64 overworld chest markers and its 10 dungeons. The app's next
// save version migrates a save through these tables.
//
// The legacy format is the app's at 2.11.0 (save version 5):
// apps/web/src/data/items.ts (the items and their ranges), chests.ts (the
// markers, by their position in the table) and dungeons.ts (the dungeons,
// by index). It is frozen: a copy lives here, since the pack imports
// nothing of the app, and the app's tests hold its tables to this copy.
import { type DungeonId, dungeon, dungeonRegions } from "./dungeons";
import type { Medallion, Pad, PadKnowledge } from "./medallions";
import { STANDARD } from "./settings";
import type { InventoryItemId, Prize, TrackerInput } from "./tracker";

/** The legacy dungeon indices 0-9: the dungeon each stands for. */
export const LEGACY_DUNGEONS = [
  "eastern-palace",
  "desert-palace",
  "tower-of-hera",
  "palace-of-darkness",
  "swamp-palace",
  "skull-woods",
  "thieves-town",
  "ice-palace",
  "misery-mire",
  "turtle-rock",
] as const satisfies readonly DungeonId[];

/**
 * The items each legacy dungeon counter starts from (DUNGEON_CHEST_COUNTS):
 * those that are not the dungeon's map, compass and keys, whatever the run.
 */
export const LEGACY_DUNGEON_ITEMS = [3, 2, 2, 5, 6, 2, 4, 3, 2, 5] as const;

/** The legacy ids that are a simple flag, and the pack item each is. */
const FLAGS = {
  bombos: "bombos",
  book: "bookOfMudora",
  boots: "pegasusBoots",
  byrna: "caneOfByrna",
  cape: "cape",
  ether: "ether",
  firerod: "fireRod",
  flippers: "flippers",
  // Found: this world activates it without the weathervane (canFly)
  flute: "flute",
  hammer: "hammer",
  hookshot: "hookshot",
  icerod: "iceRod",
  lantern: "lamp",
  mirror: "magicMirror",
  moonpearl: "moonPearl",
  mushroom: "mushroom",
  net: "bugCatchingNet",
  powder: "powder",
  quake: "quake",
  shovel: "shovel",
  somaria: "caneOfSomaria",
} as const satisfies Readonly<Record<string, InventoryItemId>>;

/** The legacy ids that count, and the pack item each counts. */
const COUNTS = {
  bottle: "bottle",
  glove: "glove",
  shield: "shield",
  sword: "sword",
} as const satisfies Readonly<Record<string, InventoryItemId>>;

const perDungeon = (prefix: string, range: (i: number) => [number, number]) =>
  Object.fromEntries(
    LEGACY_DUNGEONS.map((_, i) => [`${prefix}${i}`, range(i)] as const),
  );

/**
 * Every legacy item id with its range of values (a flag is 0 to 1), as the
 * legacy items.ts declares them.
 */
export const LEGACY_ITEM_RANGES: Readonly<
  Record<string, readonly [number, number]>
> = {
  agahnim: [0, 1],
  blank: [0, 1],
  boomerang: [0, 3],
  bow: [0, 3],
  tunic: [1, 3],
  ...Object.fromEntries(Object.keys(FLAGS).map((id) => [id, [0, 1]])),
  ...Object.fromEntries(
    Object.keys(COUNTS).map((id) => [
      id,
      [0, { bottle: 4, glove: 2, shield: 3, sword: 4 }[id] ?? 0],
    ]),
  ),
  ...perDungeon("bigkey", () => [0, 1]),
  ...perDungeon("boss", () => [1, 2]),
  ...perDungeon("chest", (i) => [0, LEGACY_DUNGEON_ITEMS[i] ?? 0]),
  ...perDungeon("reward", () => [0, 4]),
};

/** The legacy reward values 1-4: the prize class each recorded. */
const REWARDS: readonly (Prize | undefined)[] = [
  undefined,
  "greenPendant",
  "pendant",
  "crystal",
  "redCrystal",
];

/** What one legacy item value records, in the pack's terms. */
export type LegacyEffect =
  | {
      readonly kind: "item";
      readonly item: InventoryItemId;
      readonly count: number;
    }
  | { readonly kind: "beaten"; readonly dungeon: DungeonId }
  | {
      readonly kind: "prize";
      readonly dungeon: DungeonId;
      readonly prize: Prize;
    }
  | {
      /**
       * How many of the dungeon's items the player found: the counter
       * counted down from LEGACY_DUNGEON_ITEMS. The pack's counter may
       * start higher (keysanity counts the keys too), so it is the count
       * found that carries over.
       */
      readonly kind: "found";
      readonly dungeon: DungeonId;
      readonly count: number;
    };

const item = (id: InventoryItemId, count: number): LegacyEffect[] =>
  count > 0 ? [{ count, item: id, kind: "item" }] : [];

/**
 * What a legacy item id and value record. A flag is `true` or `false`, a
 * count a whole number in its legacy range: the bow is 1 for the silver
 * arrows alone, 2 for the bow, 3 for both; the boomerang 1 blue, 2 red, 3
 * both; the tunic 1 green, 2 blue, 3 red; a boss 2 once beaten; a reward
 * 1 the Pendant of Courage, 2 another pendant, 3 a crystal, 4 crystal 5 or
 * 6. Throws a RangeError for an id or a value the legacy format does not
 * have.
 */
export function legacyItem(
  id: string,
  value: number | boolean,
): LegacyEffect[] {
  const range = Object.hasOwn(LEGACY_ITEM_RANGES, id)
    ? LEGACY_ITEM_RANGES[id]
    : undefined;
  const v = value === true ? 1 : value === false ? 0 : value;
  if (range === undefined) throw new RangeError(`No legacy item "${id}"`);
  if (!Number.isInteger(v) || v < range[0] || v > range[1]) {
    throw new RangeError(`Legacy ${id} cannot be ${String(value)}`);
  }
  if (Object.hasOwn(FLAGS, id)) return item(FLAGS[id as keyof typeof FLAGS], v);
  if (Object.hasOwn(COUNTS, id))
    return item(COUNTS[id as keyof typeof COUNTS], v);
  switch (id) {
    case "blank":
      return [];
    case "agahnim":
      return v === 1 ? [{ dungeon: "castle-tower", kind: "beaten" }] : [];
    case "bow":
      // Bit 1 the bow, bit 0 the silver arrows
      return [...item("bow", v >> 1), ...item("silverArrowUpgrade", v & 1)];
    case "boomerang":
      return [...item("boomerang", v & 1), ...item("redBoomerang", v >> 1)];
    case "tunic":
      return item("armor", v - 1);
  }
  const [, kind = "", index = ""] = /^([a-z]+)(\d)$/.exec(id) ?? [];
  const i = Number(index);
  const d = LEGACY_DUNGEONS[i] as DungeonId;
  switch (kind) {
    case "bigkey":
      return item(`bigKey${dungeon(d).code}` as InventoryItemId, v);
    case "boss":
      return v === 2 ? [{ dungeon: d, kind: "beaten" }] : [];
    case "chest": {
      const found = (LEGACY_DUNGEON_ITEMS[i] ?? 0) - v;
      return found > 0 ? [{ count: found, dungeon: d, kind: "found" }] : [];
    }
  }
  // A reward, the only kind left
  const prize = REWARDS[v];
  return prize === undefined ? [] : [{ dungeon: d, kind: "prize", prize }];
}

/** The legacy medallion values 0-3: unknown, Bombos, Ether, Quake. */
const MEDALLION_VALUES: readonly (Medallion | "unknown")[] = [
  "unknown",
  "bombos",
  "ether",
  "quake",
];

/** The legacy medallion slots: Misery Mire's is 8, Turtle Rock's 9. */
const PAD_SLOTS: Readonly<Record<Pad, number>> = { mire: 8, turtleRock: 9 };

/** The legacy run, as its save holds it (Progress, save version 5). */
export interface LegacyProgress {
  readonly items: Readonly<Record<string, number | boolean>>;
  /** One flag per legacy chest marker, by position. */
  readonly chestsOpened: readonly boolean[];
  /** Ten slots, by legacy dungeon index; only 8 and 9 hold a pad. */
  readonly medallions: readonly number[];
  /** Ten counts, by legacy dungeon index: the small keys found. */
  readonly smallKeys: readonly number[];
}

/** A legacy run in the pack's terms. */
export interface FromLegacy {
  readonly input: TrackerInput;
  /** The locations the opened markers stand for. */
  readonly checked: readonly string[];
  /** Per dungeon, how many of its items the player found. */
  readonly found: Readonly<Partial<Record<DungeonId, number>>>;
}

/**
 * A legacy run as the pack reads it: its items through legacyItem, its
 * opened markers through LEGACY_CHESTS, its pads and its keys by legacy
 * dungeon index. The legacy tracker never recorded the escape: its logic
 * opened the Light World from the start, so a legacy run counts Hyrule
 * Castle as finished, which in Standard rescues Zelda. Throws a RangeError
 * for a value the legacy format does not have.
 */
export function fromLegacy(progress: LegacyProgress): FromLegacy {
  const items: Partial<Record<InventoryItemId, number>> = {};
  const beaten: Partial<Record<DungeonId, boolean>> = {
    "hyrule-castle": true,
  };
  const prizes: Partial<Record<DungeonId, Prize>> = {};
  const found: Partial<Record<DungeonId, number>> = {};
  for (const [id, value] of Object.entries(progress.items)) {
    for (const effect of legacyItem(id, value)) {
      switch (effect.kind) {
        case "item":
          items[effect.item] = (items[effect.item] ?? 0) + effect.count;
          break;
        case "beaten":
          beaten[effect.dungeon] = true;
          break;
        case "prize":
          prizes[effect.dungeon] = effect.prize;
          break;
        case "found":
          found[effect.dungeon] = effect.count;
          break;
      }
    }
  }
  const medallions: Partial<Record<Pad, Medallion | "unknown">> = {};
  for (const [pad, slot] of Object.entries(PAD_SLOTS) as [Pad, number][]) {
    const known = MEDALLION_VALUES[progress.medallions[slot] ?? 0];
    if (known === undefined) {
      throw new RangeError(
        `Legacy medallion ${slot} cannot be ${progress.medallions[slot]}`,
      );
    }
    medallions[pad] = known;
  }
  const keys = Object.fromEntries(
    LEGACY_DUNGEONS.map((d, i) => [d, progress.smallKeys[i] ?? 0]),
  );
  const checked = progress.chestsOpened.flatMap((opened, i) =>
    opened ? (LEGACY_CHESTS[i]?.locations ?? []) : [],
  );
  return {
    checked: [...new Set(checked)],
    found,
    input: {
      beaten,
      items,
      keys,
      medallions: medallions satisfies PadKnowledge,
      prizes,
    },
  };
}

/** One legacy chest marker: its caption as text, and what it stands for. */
export interface LegacyChest {
  /** Its legacy caption, its icons left out. */
  readonly name: string;
  /** The locations it stands for; none when v31 has no check there. */
  readonly locations: readonly string[];
}

/**
 * The 64 legacy chest markers, by their position in the legacy chests.ts:
 * the locations each stands for. Most stand for one; a cave of several
 * chests for all of them. "Fugitive under the bridge" is the Hobo, under
 * the bridge east of Link's House. "Bridge" sits on Hyrule Castle's own
 * bridge, where v31 has no check: it stands for none.
 */
export const LEGACY_CHESTS: readonly LegacyChest[] = [
  { locations: ["kings-tomb"], name: "King's Tomb" },
  {
    locations: ["floodgate-chest", "sunken-treasure"],
    name: "Light World Swamp (2)",
  },
  { locations: ["links-house"], name: "Stoops Lonk's Hoose" },
  { locations: ["spiral-cave"], name: "Spiral Cave" },
  { locations: ["mimic-cave"], name: "Mimic Cave" },
  { locations: ["kakariko-tavern"], name: "Tavern" },
  { locations: ["chicken-house"], name: "Chicken House" },
  { locations: ["brewery"], name: "Bombable Hut" },
  { locations: ["c-shaped-house"], name: "C House" },
  { locations: ["aginahs-cave"], name: "Aginah's Cave" },
  {
    locations: ["mire-shed/left", "mire-shed/right"],
    name: "West of Mire (2)",
  },
  {
    locations: ["superbunny-cave/top", "superbunny-cave/bottom"],
    name: "DW Death Mountain (2)",
  },
  {
    locations: [
      "sahasrahlas-hut/left",
      "sahasrahlas-hut/middle",
      "sahasrahlas-hut/right",
    ],
    name: "Sahasrahla's Hut (3)",
  },
  { locations: ["spike-cave"], name: "Byrna Spike Cave" },
  {
    locations: [
      "kakariko-well/top",
      "kakariko-well/left",
      "kakariko-well/middle",
      "kakariko-well/right",
      "kakariko-well/bottom",
    ],
    name: "Kakariko Well (4 + bomb)",
  },
  {
    locations: [
      "blinds-hideout/top",
      "blinds-hideout/left",
      "blinds-hideout/right",
      "blinds-hideout/far-left",
      "blinds-hideout/far-right",
    ],
    name: "Thieve's Hut (4 + bomb)",
  },
  {
    locations: [
      "hype-cave/top",
      "hype-cave/middle-right",
      "hype-cave/middle-left",
      "hype-cave/bottom",
      "hype-cave/npc",
    ],
    name: "Hype Cave! (NPC + 4 bomb)",
  },
  {
    locations: [
      "paradox-cave-lower/far-left",
      "paradox-cave-lower/left",
      "paradox-cave-lower/right",
      "paradox-cave-lower/far-right",
      "paradox-cave-lower/middle",
      "paradox-cave-upper/left",
      "paradox-cave-upper/right",
    ],
    name: "Death Mountain East (5 + 2 bomb)",
  },
  { locations: ["pegasus-rocks"], name: "West of Sanctuary" },
  {
    locations: [
      "mini-moldorm-cave/far-left",
      "mini-moldorm-cave/left",
      "mini-moldorm-cave/right",
      "mini-moldorm-cave/far-right",
      "mini-moldorm-cave/npc",
    ],
    name: "Minimoldorm Cave (NPC + 4)",
  },
  { locations: ["ice-rod-cave"], name: "Ice Rod Cave" },
  // The one chest the boots reach without the hookshot
  {
    locations: ["hookshot-cave/bottom-right"],
    name: "Cave Under Rock (bottom chest)",
  },
  {
    locations: [
      "hookshot-cave/top-right",
      "hookshot-cave/top-left",
      "hookshot-cave/bottom-left",
    ],
    name: "Cave Under Rock (3 top chests)",
  },
  { locations: ["chest-game"], name: "Treasure Chest Minigame" },
  { locations: ["bottle-merchant"], name: "Bottle Vendor" },
  { locations: ["sahasrahla"], name: "Sahasrahla" },
  { locations: ["stumpy"], name: "Ol' Stumpy" },
  { locations: ["sick-kid"], name: "Dying Boy" },
  { locations: ["purple-chest"], name: "Purple Chest" },
  { locations: ["hobo"], name: "Fugitive under the bridge" },
  { locations: ["ether-tablet"], name: "Ether Tablet" },
  { locations: ["bombos-tablet"], name: "Bombos Tablet" },
  { locations: ["catfish"], name: "Catfish" },
  { locations: ["king-zora"], name: "King Zora" },
  { locations: ["old-man"], name: "Lost Old Man" },
  { locations: ["potion-shop"], name: "Witch" },
  { locations: ["lost-woods-hideout"], name: "Forest Hideout" },
  { locations: ["lumberjack-tree"], name: "Lumberjack Tree" },
  { locations: ["spectacle-rock-cave"], name: "Spectacle Rock Cave" },
  { locations: ["cave-45"], name: "South of Grove" },
  { locations: ["graveyard-ledge"], name: "Graveyard Cliff Cave" },
  { locations: ["checkerboard-cave"], name: "Checkerboard Cave" },
  { locations: ["hammer-pegs"], name: "Hammer Pegs" },
  { locations: ["library"], name: "Library" },
  { locations: ["mushroom"], name: "Mushroom" },
  { locations: ["spectacle-rock"], name: "Spectacle Rock" },
  { locations: ["floating-island"], name: "Floating Island" },
  { locations: ["maze-race"], name: "Race Minigame" },
  { locations: ["desert-ledge"], name: "Desert West Ledge" },
  { locations: ["lake-hylia-island"], name: "Lake Hylia Island" },
  { locations: ["bumper-cave"], name: "Bumper Cave" },
  { locations: ["pyramid"], name: "Pyramid" },
  { locations: ["digging-game"], name: "Alec Baldwin's Dig-a-Thon" },
  { locations: ["zoras-ledge"], name: "Zora River Ledge" },
  { locations: ["flute-spot"], name: "Buried Item" },
  {
    locations: [
      "sewers/secret-room/left",
      "sewers/secret-room/middle",
      "sewers/secret-room/right",
    ],
    name: "Fall to Escape Sewer (3)",
  },
  {
    locations: ["links-uncle", "secret-passage"],
    name: "Castle Secret Entrance",
  },
  {
    locations: [
      "hyrule-castle/boomerang-chest",
      "hyrule-castle/map-chest",
      "hyrule-castle/zeldas-cell",
      "sewers/dark-cross",
    ],
    name: "Hyrule Castle (4 including Key)",
  },
  { locations: ["sanctuary"], name: "Sanctuary" },
  { locations: ["magic-bat"], name: "Mad Batter" },
  { locations: ["blacksmith"], name: "Take the frog home" },
  {
    locations: ["pyramid-fairy/left", "pyramid-fairy/right"],
    name: "Fat Fairy (2 items)",
  },
  { locations: ["master-sword-pedestal"], name: "Master Sword Pedestal" },
  { locations: [], name: "Bridge" },
];

/**
 * The pack's locations no legacy marker stands for, outside the ten legacy
 * dungeons, and why.
 */
export const NOT_ON_THE_OLD_MAP: ReadonlyMap<string, string> = new Map([
  [
    "waterfall-fairy/left",
    "the legacy map had no marker for the Waterfall of Wishing",
  ],
  [
    "waterfall-fairy/right",
    "the legacy map had no marker for the Waterfall of Wishing",
  ],
  // Not checks: upstream fills no item there (World::getTotalItemCount)
  ["pyramid-fairy/sword", "a trade: the fairy upgrades the sword it is given"],
  ["pyramid-fairy/bow", "a trade: the fairy upgrades the bow it is given"],
  ["waterfall-bottle", "a fountain: what the fairy puts in a bottle"],
  ["pyramid-bottle", "a fountain: what the fairy puts in a bottle"],
  ["misery-mire-medallion", "a medallion pad, which the dungeon counter shows"],
  ["turtle-rock-medallion", "a medallion pad, which the dungeon counter shows"],
  ["zelda", "an event: Hyrule Castle finished"],
  ["ganon", "the goal, not a check"],
  // Two dungeons the legacy map had no marker for; Agahnim was an item
  ...(["castle-tower", "ganons-tower"] as const).flatMap((id) =>
    dungeonRegions(dungeon(id), STANDARD).flatMap((r) =>
      r.locations.map(
        (l) =>
          [l.id, `${dungeon(id).name}, which the legacy map lacked`] as const,
      ),
    ),
  ),
]);

// What the tracker read, in the game's words: the "What I read" panel lists
// it so the player can hold it against their game and confirm the memory
// map. Item names follow the game's (Master Sword, Titan's Mitt); location
// names are upstream's, rebuilt from the pack's ids.

import {
  dungeonOf,
  type ItemId,
  type SeedGoal,
  type SeedLogic,
  type SeedSetting,
  type SeedSettingsReading,
  type SeedUnknown,
  type Unsettled,
} from "@alltp/pack-alttpr";
import type { AutotrackReading } from "@/games/alttpr/autotrack/reading";
import { boardItems } from "@/games/alttpr/autotrack/table";
import {
  ACCESSIBILITY_LABELS,
  ENTRANCE_LABELS,
  FUNCTIONALITY_LABELS,
  MODE_LABELS,
  PLACEMENT_LABELS,
  POOL_LABELS,
} from "@/games/alttpr/data/presets";

/** The dungeons, by the pack's codes. */
const DUNGEON_NAMES = {
  A1: "Castle Tower",
  A2: "Ganon's Tower",
  D1: "Palace of Darkness",
  D2: "Swamp Palace",
  D3: "Skull Woods",
  D4: "Thieves' Town",
  D5: "Ice Palace",
  D6: "Misery Mire",
  D7: "Turtle Rock",
  H2: "Hyrule Castle",
  P1: "Eastern Palace",
  P2: "Desert Palace",
  P3: "Tower of Hera",
} as const;

type DungeonCode = keyof typeof DUNGEON_NAMES;

/** The order the panel lists dungeons in: the order the game meets them. */
const DUNGEON_CODES: readonly DungeonCode[] = [
  "H2",
  "P1",
  "P2",
  "P3",
  "A1",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "A2",
];

/** Who falls in the two Agahnim dungeons. */
const BOSS_NAMES: Partial<Record<DungeonCode, string>> = {
  A1: "Agahnim",
  A2: "Agahnim 2",
};

/** An item counted by level: the name of each level, from the first. */
const LEVELS: Partial<Record<ItemId, readonly string[]>> = {
  armor: ["Blue Mail", "Red Mail"],
  bow: ["Bow", "Silver Bow"],
  flute: ["Flute", "Flute (activated)"],
  glove: ["Power Glove", "Titan's Mitt"],
  magic: ["Half Magic", "Quarter Magic"],
  shield: ["Fighter's Shield", "Fire Shield", "Mirror Shield"],
  sword: ["Fighter's Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
};

/** The other items, by name. */
const NAMES: Partial<Record<ItemId, string>> = {
  bombos: "Bombos",
  bookOfMudora: "Book of Mudora",
  boomerang: "Blue Boomerang",
  bottle: "Bottle",
  bugCatchingNet: "Bug-Catching Net",
  caneOfByrna: "Cane of Byrna",
  caneOfSomaria: "Cane of Somaria",
  cape: "Magic Cape",
  ether: "Ether",
  fireRod: "Fire Rod",
  flippers: "Zora's Flippers",
  hammer: "Hammer",
  heartContainer: "Heart Container",
  hookshot: "Hookshot",
  iceRod: "Ice Rod",
  lamp: "Lamp",
  magicMirror: "Magic Mirror",
  moonPearl: "Moon Pearl",
  mushroom: "Mushroom",
  pegasusBoots: "Pegasus Boots",
  pieceOfHeart: "Piece of Heart",
  powder: "Magic Powder",
  quake: "Quake",
  redBoomerang: "Red Boomerang",
  shovel: "Shovel",
  silverArrowUpgrade: "Silver Arrows",
  // Any bomb item: memory keeps no flag for Ten Bombs itself (decode.ts)
  tenBombs: "Bombs",
};

/** Items whose count matters beyond one. */
const COUNTED: ReadonlySet<ItemId> = new Set([
  "bottle",
  "heartContainer",
  "pieceOfHeart",
]);

const PRIZES: Partial<Record<ItemId, string>> = {
  crystal1: "Crystal 1",
  crystal2: "Crystal 2",
  crystal3: "Crystal 3",
  crystal4: "Crystal 4",
  crystal5: "Crystal 5",
  crystal6: "Crystal 6",
  crystal7: "Crystal 7",
  pendantOfCourage: "Pendant of Courage",
  pendantOfPower: "Pendant of Power",
  pendantOfWisdom: "Pendant of Wisdom",
};

/**
 * Events the pack counts as items. The progress and the bosses say the
 * same, from the same flags, so the item lists leave them out.
 */
const EVENTS: ReadonlySet<ItemId> = new Set([
  "defeatAgahnim",
  "defeatAgahnim2",
  "rescueZelda",
]);

/** A dungeon's own item: its kind, then the dungeon's code. */
const DUNGEON_ITEM = /^(bigKey|compass|map|key)([A-Z]\d)$/;

const DUNGEON_ITEM_NAMES: Readonly<Record<string, string>> = {
  bigKey: "Big Key",
  compass: "Compass",
  map: "Map",
};

/** Items not listed one by one when withheld, named once as a group. */
const GROUPS: readonly (readonly [RegExp, string])[] = [
  [/^(pendant|crystal)/, "Pendants and crystals"],
  [/^(heartContainer|pieceOfHeart)$/, "Heart containers and pieces"],
  [/^bottle$/, "Bottles"],
];

export type Readout = {
  /** Equipment held, in the pack's order: "Master Sword", "Bottle ×2". */
  readonly items: readonly string[];
  /** Each dungeon's own items held, by dungeon. */
  readonly dungeons: readonly {
    readonly dungeon: string;
    readonly items: readonly string[];
  }[];
  readonly prizes: readonly string[];
  /** Why the prizes are not known, when they are not (Race Mode). */
  readonly prizesUnread: Unsettled | null;
  /** The run's milestones, each reached or not, or not known and why. */
  readonly progress: readonly {
    readonly label: string;
    readonly value: boolean | Unsettled;
  }[];
  /** The bosses defeated, by dungeon. */
  readonly bosses: readonly string[];
  /** The dungeons whose prize was taken. */
  readonly completed: readonly string[];
  /** The locations checked: outside dungeons first, then by dungeon. */
  readonly checked: readonly {
    readonly area: string;
    readonly locations: readonly string[];
  }[];
  readonly checkedCount: number;
  /** What memory was not asked for in Race Mode, or has not given yet. */
  readonly withheld: readonly {
    readonly label: string;
    readonly why: Unsettled;
  }[];
  /** What was read that the board has no cell for, so leaves alone. */
  readonly untracked: readonly string[];
  /** The seed's name and settings, each in words or why it is unknown. */
  readonly seed: readonly { readonly label: string; readonly value: string }[];
};

/** Why a seed's setting is unknown, in words. */
const SETTING_UNKNOWN: Readonly<Record<SeedUnknown, string>> = {
  mystery: "hidden: a Mystery seed",
  "not-read": "not read yet",
  "race-mode": "not read in Race Mode",
  unrecognized: "not recognized",
};

const LOGIC_NAMES: Readonly<Record<SeedLogic, string>> = {
  MajorGlitches: "Major Glitches",
  NoGlitches: "No Glitches",
  OverworldGlitches: "Overworld Glitches",
};

const GOAL_NAMES: Readonly<Record<SeedGoal, string>> = {
  completionist: "Completionist",
  dungeons: "All Dungeons",
  fast_ganon: "Fast Ganon",
  ganon: "Defeat Ganon",
  ganonhunt: "Ganonhunt",
  pedestal: "Master Sword Pedestal",
  "triforce-hunt": "Triforce Hunt",
};

/**
 * A setting in words, or why it is unknown; one only a seed's file states
 * is "not in the ROM" without the file.
 */
const settingText = <T>(
  setting: SeedSetting<T> | undefined,
  words: (value: T) => string,
): string =>
  setting === undefined
    ? "not in the ROM"
    : setting.known
      ? words(setting.value)
      : SETTING_UNKNOWN[setting.why];

/** A label table as words for a setting's value. */
const labelled =
  <T extends string>(labels: Readonly<Record<T, string>>) =>
  (value: T) =>
    labels[value];

/** The dungeon items a seed lets out of their dungeons, by setting. */
const WILD_ITEMS = [
  ["wildMaps", "maps"],
  ["wildCompasses", "compasses"],
  ["wildKeys", "small keys"],
  ["wildBigKeys", "big keys"],
] as const;

/** A seed's name and settings, as the panel lists them. */
export const describeSeed = (seed: SeedSettingsReading): Readout["seed"] => {
  const wild = WILD_ITEMS.map(([key]) => seed[key]);
  const unknown = wild.find((setting) => !setting.known);
  const crystals = (count: number) =>
    `${count} crystal${count === 1 ? "" : "s"}`;
  return [
    { label: "Seed", value: seed.seed ?? "not an alttpr.com seed" },
    { label: "Logic", value: settingText(seed.logic, (v) => LOGIC_NAMES[v]) },
    { label: "World", value: settingText(seed.mode, (v) => MODE_LABELS[v]) },
    {
      label: "Entrances",
      value: settingText(seed.entrances, labelled(ENTRANCE_LABELS)),
    },
    {
      label: "Swordless",
      value: settingText(seed.swordless, (v) => (v ? "yes" : "no")),
    },
    { label: "Goal", value: settingText(seed.goal, (v) => GOAL_NAMES[v]) },
    {
      label: "Ganon's Tower",
      value: settingText(seed.crystalsTower, crystals),
    },
    { label: "Ganon", value: settingText(seed.crystalsGanon, crystals) },
    {
      label: "Outside their dungeons",
      value:
        unknown !== undefined && !unknown.known
          ? SETTING_UNKNOWN[unknown.why]
          : WILD_ITEMS.filter(([key]) => seed[key].known && seed[key].value)
              .map(([, name]) => name)
              .join(", ") || "none",
    },
    {
      label: "Item placement",
      value: settingText(seed.itemPlacement, labelled(PLACEMENT_LABELS)),
    },
    {
      label: "Item pool",
      value: settingText(seed.itemPool, labelled(POOL_LABELS)),
    },
    {
      label: "Item functionality",
      value: settingText(
        seed.itemFunctionality,
        labelled(FUNCTIONALITY_LABELS),
      ),
    },
    {
      label: "Accessibility",
      value: settingText(seed.accessibility, labelled(ACCESSIBILITY_LABELS)),
    },
  ];
};

/** A dungeon's own items, named as a kind when the board has no cell for them. */
const DUNGEON_ITEM_KINDS: Readonly<Record<string, string>> = {
  bigKey: "Big keys",
  compass: "Compasses",
  key: "Small keys",
  map: "Maps",
};

/** Words of location ids that a capital letter alone would get wrong. */
const WORDS: Readonly<Record<string, string>> = {
  aginahs: "Aginah's",
  blinds: "Blind's",
  bobs: "Bob's",
  dms: "DMs",
  ganons: "Ganon's",
  kings: "King's",
  links: "Link's",
  npc: "NPC",
  sahasrahlas: "Sahasrahla's",
  thieves: "Thieves'",
  zeldas: "Zelda's",
  zoras: "Zora's",
};

const word = (text: string, index: number) =>
  index > 0 && (text === "of" || text === "the")
    ? text
    : (WORDS[text] ?? `${text.charAt(0).toUpperCase()}${text.slice(1)}`);

/** One part of a location id ("big-key-chest") in words ("Big Key Chest"). */
const words = (part: string) =>
  part
    .split("-")
    .map(word)
    .join(" ")
    // The two names upstream hyphenates, whose hyphen locationId() keeps
    .replace("C Shaped", "C-Shaped")
    .replace("Pre Moldorm", "Pre-Moldorm");

/**
 * A location's name from its pack id: "eastern-palace/big-key-chest" is
 * "Eastern Palace - Big Key Chest", or "Big Key Chest" when listed under its
 * dungeon (the sewers keep their name, under Hyrule Castle).
 * @param id - The pack's location id
 * @param underDungeon - Whether it is listed under its dungeon
 */
export const locationName = (id: string, underDungeon = false) => {
  const parts = id.split("/");
  const shown =
    underDungeon && parts.length > 1 && parts[0] !== "sewers"
      ? parts.slice(1)
      : parts;
  return shown.map(words).join(" - ");
};

/** An item's name at a count: a level's name, or the item's with its count. */
const itemName = (id: ItemId, count: number) => {
  const levels = LEVELS[id];
  if (levels) return levels[Math.min(count, levels.length) - 1];
  const name = NAMES[id] ?? id;
  return COUNTED.has(id) ? `${name} ×${count}` : name;
};

/** Pushes `entry` to the list `key` holds in `map`. */
const add = <K>(map: Map<K, string[]>, key: K, entry: string) => {
  const list = map.get(key);
  if (list) list.push(entry);
  else map.set(key, [entry]);
};

/**
 * The reading as the panel lists it.
 * @param reading - What the session decoded last
 * @param wildKeys - Whether the run's small keys are wild, which the board
 * then counts
 */
export const describeReading = (
  reading: AutotrackReading,
  wildKeys = false,
): Readout => {
  const { atLeast, counts, unsettled } = reading.items;
  const items: string[] = [];
  const prizes: string[] = [];
  const byDungeon = new Map<DungeonCode, string[]>();
  const withheld = new Map<string, Unsettled>();
  const onBoard = boardItems(wildKeys);
  const untracked = new Set<string>();
  const offBoard = (id: ItemId, count: number) => {
    if (count === 0 || EVENTS.has(id) || onBoard.has(id)) return;
    const kind = DUNGEON_ITEM.exec(id)?.[1];
    untracked.add(kind ? DUNGEON_ITEM_KINDS[kind] : itemName(id, count));
  };

  for (const [id, count] of Object.entries(counts) as [ItemId, number][]) {
    offBoard(id, count);
    if (count === 0 || EVENTS.has(id)) continue;
    const own = DUNGEON_ITEM.exec(id);
    if (own) add(byDungeon, own[2] as DungeonCode, DUNGEON_ITEM_NAMES[own[1]]);
    else if (PRIZES[id]) prizes.push(PRIZES[id]);
    else items.push(itemName(id, count));
  }
  // Memory holds the small keys in hand, which the keys found can exceed
  for (const [id, count] of Object.entries(atLeast) as [ItemId, number][]) {
    offBoard(id, count);
    const code = DUNGEON_ITEM.exec(id)?.[2] as DungeonCode;
    if (count > 0)
      add(byDungeon, code, `${count} small key${count > 1 ? "s" : ""} in hand`);
  }
  let prizesUnread: Unsettled | null = null;
  for (const [id, why] of Object.entries(unsettled) as [ItemId, Unsettled][]) {
    if (EVENTS.has(id)) continue;
    if (PRIZES[id]) prizesUnread = why;
    const group = GROUPS.find(([pattern]) => pattern.test(id))?.[1];
    withheld.set(group ?? NAMES[id] ?? LEVELS[id]?.[0] ?? id, why);
  }

  const checked = new Map<string, string[]>();
  for (const id of reading.checked) {
    const code = dungeonOf(id) as DungeonCode | null;
    add(
      checked,
      code === null ? "Outside dungeons" : DUNGEON_NAMES[code],
      locationName(id, code !== null),
    );
  }
  for (const why of ["race-mode", "not-read"] as const) {
    const count = reading.unsettled.filter(([, w]) => w === why).length;
    if (count > 0) {
      withheld.set(
        why === "race-mode"
          ? `Checks inside dungeons (${count})`
          : `Checked locations (${count})`,
        why,
      );
    }
  }

  const { bosses, completed, goal, rescueZelda, started } = reading.progress;
  const fallen = (code: DungeonCode) =>
    BOSS_NAMES[code]
      ? `${BOSS_NAMES[code]} (${DUNGEON_NAMES[code]})`
      : DUNGEON_NAMES[code];
  const beaten = DUNGEON_CODES.filter(
    (code) => code !== "H2" && bosses[code] === true,
  );
  return {
    bosses: beaten.map(fallen),
    checked: ["Outside dungeons", ...DUNGEON_CODES.map((c) => DUNGEON_NAMES[c])]
      .filter((area) => checked.has(area))
      .map((area) => ({ area, locations: checked.get(area) as string[] })),
    checkedCount: reading.checked.length,
    completed: DUNGEON_CODES.filter(
      (code) => code !== "H2" && completed[code] === true,
    ).map((code) => DUNGEON_NAMES[code]),
    dungeons: DUNGEON_CODES.filter((code) => byDungeon.has(code)).map(
      (code) => ({
        dungeon: DUNGEON_NAMES[code],
        items: byDungeon.get(code) as string[],
      }),
    ),
    items,
    prizes,
    prizesUnread,
    progress: [
      { label: "Game started", value: started },
      { label: "Zelda rescued", value: rescueZelda },
      { label: "Triforce reached", value: goal },
    ],
    seed: describeSeed(reading.seed),
    untracked: [...untracked],
    withheld: [...withheld].map(([label, why]) => ({ label, why })),
  };
};

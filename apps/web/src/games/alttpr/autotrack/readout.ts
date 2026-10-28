// What the tracker read, in the game's words: the "What I read" panel lists
// it so the player can hold it against their game and confirm the memory
// map. Item names follow the game's (Master Sword, Titan's Mitt); location
// names are upstream's, rebuilt from the pack's ids.

import {
  dungeonOf,
  type ItemId,
  type Medallion,
  type MedallionReading,
  type MedallionShownBy,
  type Pad,
  type Prize,
  type PrizeDungeon,
  type PrizeReading,
  type PrizeShownBy,
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
import { withCost } from "@/games/alttpr/logic/costs";

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

/** A crystal by its number. */
const CRYSTAL = /^crystal\d$/;

/** What Race Mode keeps of the crystals: which are 5 and 6. */
const CRYSTAL_NUMBERS = "Which crystals are 5 and 6";

/** Zelda's rescue, a location the pack checks (check-flags.ts). */
const ZELDA = "zelda";

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
  /**
   * The pendants and crystals held: each by name, or in Race Mode the
   * crystals as a count ("Crystals ×2"), never which are 5 and 6.
   */
  readonly prizes: readonly string[];
  /** Why the prizes are not known, when they are not (not read yet). */
  readonly prizesUnread: Unsettled | null;
  /**
   * The dungeon prizes the game shows, read from the ROM (the pack's
   * decodePrizes), by dungeon: the prize and why the game shows it. None
   * the game would not show.
   */
  readonly shownPrizes: readonly {
    readonly dungeon: string;
    readonly prize: string;
    readonly why: string;
  }[];
  /** Why no dungeon prize was read, when none was. */
  readonly shownPrizesUnread: Unsettled | null;
  /**
   * The medallions the game shows for Misery Mire and Turtle Rock, read from
   * the ROM (the pack's decodeMedallions): the medallion and why the game
   * shows it. None the game would not show.
   */
  readonly shownMedallions: readonly {
    readonly pad: string;
    readonly medallion: string;
    readonly why: string;
  }[];
  /** Why no medallion was read, when none was. */
  readonly shownMedallionsUnread: Unsettled | null;
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

/** A prize class, as the board's prize cells tell them apart. */
const PRIZE_WORDS: Readonly<Record<Prize, string>> = {
  crystal: "A crystal, not 5 or 6",
  greenPendant: "The Pendant of Courage",
  pendant: "The Pendant of Power or Wisdom",
  redCrystal: "Crystal 5 or 6",
};

/** Why the game shows a prize, in words. */
const shownWhy = (prize: Prize, shownBy: PrizeShownBy): string => {
  switch (shownBy) {
    case "finished":
      return "dungeon finished";
    case "map":
      return "its map held";
    case "map-mode":
      return "on the world map";
    case "mark":
      if (prize === "greenPendant") return "marked by Sahasrahla";
      return prize === "redCrystal"
        ? "marked by the Bomb Merchant"
        : "marked on the map";
  }
};

/** The prizes the game shows, in the panel's words and dungeon order. */
const describeShown = (prizes: PrizeReading): Readout["shownPrizes"] => {
  if (typeof prizes === "string") return [];
  return DUNGEON_CODES.flatMap((code) => {
    const shown = prizes[code as PrizeDungeon];
    if (shown === undefined) return [];
    return [
      {
        dungeon: DUNGEON_NAMES[code],
        prize: PRIZE_WORDS[shown.prize],
        why: shownWhy(shown.prize, shown.shownBy),
      },
    ];
  });
};

/** The pads, as the panel names them, in the board's order. */
const PAD_NAMES: Readonly<Record<Pad, string>> = {
  mire: "Misery Mire",
  turtleRock: "Turtle Rock",
};

const MEDALLION_NAMES: Readonly<Record<Medallion, string>> = {
  bombos: "Bombos",
  ether: "Ether",
  quake: "Quake",
};

/** Why the game shows a medallion, in words. */
const MEDALLION_WHY: Readonly<Record<MedallionShownBy, string>> = {
  "on-screen": "its entrance's screen in view",
  opened: "entrance opened",
};

/** The medallions the game shows, in the panel's words. */
const describeMedallions = (
  medallions: MedallionReading,
): Readout["shownMedallions"] => {
  if (typeof medallions === "string") return [];
  return (Object.keys(PAD_NAMES) as Pad[]).flatMap((pad) => {
    const shown = medallions[pad];
    if (shown === undefined) return [];
    return [
      {
        medallion: MEDALLION_NAMES[shown.medallion],
        pad: PAD_NAMES[pad],
        why: MEDALLION_WHY[shown.shownBy],
      },
    ];
  });
};

/** Why a seed's setting is unknown, in words. */
const SETTING_UNKNOWN: Readonly<Record<SeedUnknown, string>> = {
  mystery: "hidden: a Mystery seed",
  "not-read": "not read yet",
  "race-mode": "not read in Race Mode",
  unrecognized: "not recognized",
};

const LOGIC_NAMES: Readonly<Record<SeedLogic, string>> = {
  HybridMajorGlitches: "Hybrid Major Glitches",
  MajorGlitches: "Major Glitches",
  NoGlitches: "No Glitches",
  NoLogic: "No Logic",
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

/**
 * A seed's name and settings, as the panel lists them. In Race Mode the name
 * is not shown: the race rules (v2.0) let a tracker present only what they
 * list before the seed is completed, and a seed's name is not among it.
 */
export const describeSeed = (
  seed: SeedSettingsReading,
  race = false,
): Readout["seed"] => {
  const wild = WILD_ITEMS.map(([key]) => seed[key]);
  const unknown = wild.find((setting) => !setting.known);
  const crystals = (count: number) =>
    `${count} crystal${count === 1 ? "" : "s"}`;
  return [
    {
      label: "Seed",
      value: race
        ? "not shown in Race Mode"
        : (seed.seed ?? "not an alttpr.com seed"),
    },
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
  return withCost(shown.map(words).join(" - "), id);
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
 * @param genericKeys - Whether a small key opens any dungeon (retro): no key
 * count is then listed, since a dungeon's would say where a key was taken
 */
export const describeReading = (
  reading: AutotrackReading,
  wildKeys = false,
  genericKeys = false,
): Readout => {
  const { beyond, counts, unsettled } = reading.items;
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
    const own = DUNGEON_ITEM.exec(id);
    // Generic keys belong to no dungeon, and the one byte that rises is
    // Tower of Hera's basement cage's: never listed
    if (genericKeys && own?.[1] === "key") continue;
    offBoard(id, count);
    if (count === 0 || EVENTS.has(id)) continue;
    if (own?.[1] === "key") {
      // The base patch's count of keys found, which no door spends; a count
      // above the dungeon's keys is a double count the decoder does not
      // know, named so it is noticed
      const keys = `${count} small key${count > 1 ? "s" : ""} found`;
      const over = beyond[id];
      add(
        byDungeon,
        own[2] as DungeonCode,
        over === undefined
          ? keys
          : `${keys} (the game counts ${over}, more than the dungeon holds)`,
      );
    } else if (own) {
      add(byDungeon, own[2] as DungeonCode, DUNGEON_ITEM_NAMES[own[1]]);
    } else if (PRIZES[id]) prizes.push(PRIZES[id]);
    else items.push(itemName(id, count));
  }
  // Race Mode counts the crystals, never names them (v2.0: not which is a
  // 5/6 crystal)
  const { held } = reading;
  if (typeof held !== "string" && unsettled.crystal1 === "race-mode") {
    if (held.crystal > 0) prizes.push(`Crystals ×${held.crystal}`);
    withheld.set(CRYSTAL_NUMBERS, "race-mode");
  }
  let prizesUnread: Unsettled | null = null;
  for (const [id, why] of Object.entries(unsettled) as [ItemId, Unsettled][]) {
    if (EVENTS.has(id)) continue;
    if (CRYSTAL.test(id) && withheld.has(CRYSTAL_NUMBERS)) continue;
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
  // Race Mode reads every check but Zelda's rescue (v2.0 forbids telling it)
  const raceChecks = reading.unsettled.filter(([, w]) => w === "race-mode");
  if (raceChecks.some(([id]) => id === ZELDA)) {
    withheld.set("Zelda's rescue", "race-mode");
  }
  const otherRaceChecks = raceChecks.filter(([id]) => id !== ZELDA).length;
  if (otherRaceChecks > 0) {
    withheld.set(`Checked locations (${otherRaceChecks})`, "race-mode");
  }
  const unread = reading.unsettled.filter(([, w]) => w === "not-read").length;
  if (unread > 0) withheld.set(`Checked locations (${unread})`, "not-read");

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
      // The race rules forbid telling whether Zelda was rescued in a
      // Standard seed: Race Mode never says it, whatever the seed's world
      ...(reading.race ? [] : [{ label: "Zelda rescued", value: rescueZelda }]),
      { label: "Triforce reached", value: goal },
    ],
    seed: describeSeed(reading.seed, reading.race),
    shownMedallions: describeMedallions(reading.medallions),
    shownMedallionsUnread:
      typeof reading.medallions === "string" ? reading.medallions : null,
    shownPrizes: describeShown(reading.prizes),
    shownPrizesUnread:
      typeof reading.prizes === "string" ? reading.prizes : null,
    untracked: [...untracked],
    withheld: [...withheld].map(([label, why]) => ({ label, why })),
  };
};

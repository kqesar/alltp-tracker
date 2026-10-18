/**
 * Run-type presets for the ALttP Randomizer.
 *
 * A preset is a named bundle of settings. The tracker reacts to the settings
 * it can model today (notably `dungeonItems`, which drives the key cells and
 * the dungeon counters). Settings that change the accessibility *logic*
 * (mode = inverted/retro, entranceShuffle = crossed, ...) are stored and shown,
 * but the per-mode logic is implemented in later iterations — `logicSupported`
 * flags whether the tracker's accessibility logic fully models the preset.
 *
 * A run's settings need not be its preset's own: autotracking reads a seed's
 * from its ROM (autotrack/seed.ts) and switches to the run type that names
 * them best, under the seed's exact crystals and swords.
 */

type RunMode = "open" | "standard" | "inverted" | "retro";

type RunGoal =
  | "ganon"
  | "fast-ganon"
  | "all-dungeons"
  | "pedestal"
  | "triforce-hunt";

type EntranceShuffle =
  | "none"
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity";

/**
 * alttpr.com's dungeon items (config/alttp.php:185-190): which of a
 * dungeon's own items may lie outside it. Each level lets out the ones below
 * it too (World.php:111-129): maps and compasses (mc), then small keys
 * (mcs), then big keys (full, keysanity).
 */
export type DungeonItems = "standard" | "mc" | "mcs" | "full";

/** alttpr.com's item placement (config/alttp.php:181-184). */
type ItemPlacement = "advanced" | "basic";

/** alttpr.com's accessibility (config/alttp.php:191-195). */
type Accessibility = "items" | "locations" | "none";

/**
 * alttpr.com's item pool (config/alttp.php:266-271), and the superexpert one
 * the randomizer also builds (World.php:171-214).
 */
type ItemPool = "normal" | "hard" | "expert" | "superexpert" | "crowd_control";

/** alttpr.com's item functionality (config/alttp.php:272-276, World.php:216). */
type ItemFunctionality = "normal" | "hard" | "expert" | "superexpert";

export type RunSettings = {
  mode: RunMode;
  goal: RunGoal;
  /** The dungeon items that may lie outside their dungeons */
  dungeonItems: DungeonItems;
  entranceShuffle: EntranceShuffle;
  /** No sword in the item pool: alttpr.com's weapons "swordless" */
  swordless: boolean;
  /** The crystals that open Ganon's Tower, 0 to 7 */
  crystalsTower: number;
  /** The crystals Ganon asks for, 0 to 7 */
  crystalsGanon: number;
  /** Basic placement asks for better bows and swords, Advanced for none */
  itemPlacement: ItemPlacement;
  /** What the seed guarantees can be reached */
  accessibility: Accessibility;
  /** Fewer shields (and so no mirror shield) beyond the normal pool */
  itemPool: ItemPool;
  /** Beyond normal: fairies cannot be caught, a bottle refills less magic */
  itemFunctionality: ItemFunctionality;
};

type Preset = {
  id: string;
  name: string;
  description: string;
  settings: RunSettings;
  /** True when the tracker's accessibility logic fully models this preset. */
  logicSupported: boolean;
};

const baseSettings: RunSettings = {
  accessibility: "items",
  crystalsGanon: 7,
  crystalsTower: 7,
  dungeonItems: "standard",
  entranceShuffle: "none",
  goal: "ganon",
  itemFunctionality: "normal",
  itemPlacement: "advanced",
  itemPool: "normal",
  mode: "open",
  swordless: false,
};

export const presets: Preset[] = [
  {
    description: "The default weekly: open world, defeat Ganon.",
    id: "open",
    logicSupported: true,
    name: "Open",
    settings: { ...baseSettings, mode: "open" },
  },
  {
    description: "Begins with the Hyrule Castle escape before opening up.",
    id: "standard",
    logicSupported: true,
    name: "Standard",
    settings: { ...baseSettings, mode: "standard" },
  },
  {
    description: "Keys, maps and compasses are shuffled into the world.",
    id: "keysanity",
    logicSupported: true,
    name: "Keysanity",
    settings: { ...baseSettings, dungeonItems: "full" },
  },
  {
    description: "All dungeon bosses must be defeated before Ganon.",
    id: "all-dungeons",
    logicSupported: true,
    name: "All Dungeons",
    settings: { ...baseSettings, goal: "all-dungeons" },
  },
  {
    // alttpr.com's weapons "swordless" (vt app/Rom.php:2065-2073)
    description:
      "No swords: medallions work on their pads, the hammer reads tablets and hurts Ganon.",
    id: "swordless",
    logicSupported: true,
    name: "Swordless",
    settings: { ...baseSettings, swordless: true },
  },
  {
    description: "Collect the required Triforce pieces to win.",
    id: "triforce-hunt",
    logicSupported: true,
    name: "Triforce Hunt",
    settings: { ...baseSettings, goal: "triforce-hunt" },
  },
  {
    description:
      "Link starts in the Dark World; the mirror is inverted. (Logic support coming soon.)",
    id: "inverted",
    logicSupported: false,
    name: "Inverted",
    settings: { ...baseSettings, mode: "inverted" },
  },
  {
    description:
      "Bow uses arrows, take-any caves, rupee bow. (Logic support coming soon.)",
    id: "retro",
    logicSupported: false,
    name: "Retro",
    settings: { ...baseSettings, mode: "retro" },
  },
  {
    description:
      "Crossworld entrance rando + keysanity. (Logic support coming soon.)",
    id: "crosskeys",
    logicSupported: false,
    name: "Crosskeys",
    settings: {
      ...baseSettings,
      dungeonItems: "full",
      entranceShuffle: "crossed",
    },
  },
  {
    description:
      "Weighted/mystery community settings — rules vary per seed. (Logic support coming soon.)",
    id: "ambrosia",
    logicSupported: false,
    name: "Ambrosia",
    settings: { ...baseSettings },
  },
];

/** The preset selected by default. */
export const DEFAULT_PRESET_ID = "open";

export const getPreset = (id: string): Preset =>
  presets.find((preset) => preset.id === id) ??
  (presets.find((preset) => preset.id === DEFAULT_PRESET_ID) as Preset);

/** Human-readable labels for run settings. */
export const MODE_LABELS: Record<RunMode, string> = {
  inverted: "Inverted",
  open: "Open",
  retro: "Retro",
  standard: "Standard",
};

export const GOAL_LABELS: Record<RunGoal, string> = {
  "all-dungeons": "All Dungeons",
  "fast-ganon": "Fast Ganon",
  ganon: "Defeat Ganon",
  pedestal: "Pedestal",
  "triforce-hunt": "Triforce Hunt",
};

export const DUNGEON_ITEM_LABELS: Record<DungeonItems, string> = {
  full: "Full Shuffle",
  mc: "MC Shuffle",
  mcs: "MCS Shuffle",
  standard: "Standard",
};

/** What a run's dungeon items let out of their dungeons (World.php:111-129). */
export const wildItems = ({
  dungeonItems,
}: Pick<RunSettings, "dungeonItems">) => ({
  /** Big keys: full shuffle only. */
  bigKeys: dungeonItems === "full",
  /** Small keys: mcs and full. */
  keys: dungeonItems === "mcs" || dungeonItems === "full",
  /** Maps and compasses, which always go together: every level but standard. */
  mapsAndCompasses: dungeonItems !== "standard",
});

export const PLACEMENT_LABELS: Record<ItemPlacement, string> = {
  advanced: "Advanced",
  basic: "Basic",
};

export const ACCESSIBILITY_LABELS: Record<Accessibility, string> = {
  items: "100% Inventory",
  locations: "100% Locations",
  none: "Not Guaranteed",
};

export const POOL_LABELS: Record<ItemPool, string> = {
  crowd_control: "Crowd Control",
  expert: "Expert",
  hard: "Hard",
  normal: "Normal",
  superexpert: "Super Expert",
};

export const FUNCTIONALITY_LABELS: Record<ItemFunctionality, string> = {
  expert: "Expert",
  hard: "Hard",
  normal: "Normal",
  superexpert: "Super Expert",
};

export const ENTRANCE_LABELS: Record<EntranceShuffle, string> = {
  crossed: "Crossworld",
  full: "Full",
  insanity: "Insanity",
  none: "None",
  restricted: "Restricted",
  simple: "Simple",
};

/** A crystal count in words: "1 crystal", "7 crystals". */
const crystals = (count: number) => `${count} crystal${count === 1 ? "" : "s"}`;

/**
 * The settings a player may change in a run already going: none moves a
 * dungeon counter, so the run's progress stands (the store's
 * `updateSettings`). The rest name a run type, which a new run changes.
 */
export type TunableSetting =
  | "crystalsTower"
  | "crystalsGanon"
  | "itemPlacement"
  | "itemPool"
  | "itemFunctionality"
  | "accessibility";

/** Options in the order alttpr.com lists them, each with its words. */
const ordered = <T extends string>(
  order: readonly T[],
  labels: Readonly<Record<T, string>>,
) => order.map((value) => [value, labels[value]] as const);

const CRYSTAL_COUNTS = Array.from(
  { length: 8 },
  (_, count) => [count, crystals(count)] as const,
);

/** Each tunable setting's options, as [value, words]. */
export const TUNING = {
  accessibility: ordered(["items", "locations", "none"], ACCESSIBILITY_LABELS),
  crystalsGanon: CRYSTAL_COUNTS,
  crystalsTower: CRYSTAL_COUNTS,
  itemFunctionality: ordered(
    ["normal", "hard", "expert", "superexpert"],
    FUNCTIONALITY_LABELS,
  ),
  itemPlacement: ordered(["advanced", "basic"], PLACEMENT_LABELS),
  itemPool: ordered(
    ["normal", "hard", "expert", "superexpert", "crowd_control"],
    POOL_LABELS,
  ),
} as const satisfies {
  readonly [K in TunableSetting]: readonly (readonly [
    RunSettings[K],
    string,
  ])[];
};

/** One row of a run's summary: its words, and the setting when tunable. */
export type SettingRow = {
  readonly label: string;
  readonly value: string;
  readonly setting?: TunableSetting;
};

/** A labeled summary of a run's settings, for display. */
export const describeSettings = (settings: RunSettings): SettingRow[] => [
  { label: "Mode", value: MODE_LABELS[settings.mode] },
  { label: "Goal", value: GOAL_LABELS[settings.goal] },
  { label: "Dungeon items", value: DUNGEON_ITEM_LABELS[settings.dungeonItems] },
  { label: "Swordless", value: settings.swordless ? "On" : "Off" },
  {
    label: "Ganon's Tower",
    setting: "crystalsTower",
    value: crystals(settings.crystalsTower),
  },
  {
    label: "Ganon",
    setting: "crystalsGanon",
    value: crystals(settings.crystalsGanon),
  },
  {
    label: "Item placement",
    setting: "itemPlacement",
    value: PLACEMENT_LABELS[settings.itemPlacement],
  },
  {
    label: "Item pool",
    setting: "itemPool",
    value: POOL_LABELS[settings.itemPool],
  },
  {
    label: "Item functionality",
    setting: "itemFunctionality",
    value: FUNCTIONALITY_LABELS[settings.itemFunctionality],
  },
  {
    label: "Accessibility",
    setting: "accessibility",
    value: ACCESSIBILITY_LABELS[settings.accessibility],
  },
  { label: "Entrances", value: ENTRANCE_LABELS[settings.entranceShuffle] },
];

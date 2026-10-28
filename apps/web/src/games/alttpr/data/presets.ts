/**
 * Run-type presets for the ALttP Randomizer.
 *
 * A preset is a named bundle of settings. The tracker reacts to the settings
 * it can model today (notably `dungeonItems`, which drives the key cells and
 * the dungeon counters). Settings that change the accessibility *logic* the
 * pack does not model yet (an entrance shuffle other than Crosskeys', ...)
 * are stored and shown, and `logicModelled` says whether a run's are: when
 * they are not, the map shows every check as maybe rather than the Open
 * logic.
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
 * alttpr.com's "Glitches Required" beyond None (config/alttp.php:174-180):
 * the glitched logics a seed may be generated for. The pack ports
 * NoGlitches alone (`logicModelled`), so a run of any of these shows every
 * check as maybe. The six tricks of the Tricks dialog are no logic of
 * alttpr.com's: Overworld Glitches turns four of them on, but with boots
 * clips, mirror clips and super speed besides (config/logic.php:5-13),
 * whose branches of the region rules the pack folds away, and upstream's
 * tests/OverworldGlitches hold them; the Minor Glitches logic left in VT8.25
 * (resources/views/updates.blade.php:965).
 */
export type Glitches =
  | "overworld_glitches"
  | "hybrid_major_glitches"
  | "major_glitches"
  | "no_logic";

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

/**
 * The settings a Mystery run hides until the player finds them: those the
 * pack can leave unknown (packs/alttpr, settingsFromUpstream's UNKNOWN). The
 * world shows on the first screen, and the dungeon items are assumed until
 * set: the key model and the counters rest on them.
 */
export const HIDEABLE = [
  "goal",
  "swordless",
  "crystalsTower",
  "crystalsGanon",
  "itemPlacement",
  "itemPool",
  "itemFunctionality",
  "accessibility",
] as const;

export type HiddenSetting = (typeof HIDEABLE)[number];

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
  /**
   * The glitched logic the seed was generated for; absent for alttpr.com's
   * "None", the NoGlitches logic of every preset, which the pack ports.
   */
  glitches?: Glitches;
  /**
   * The settings not known yet, a Mystery run's: their values above only
   * stand in, and the logic reads them as unknown. Absent when all are known.
   */
  hidden?: readonly HiddenSetting[];
};

type Preset = {
  id: string;
  name: string;
  description: string;
  settings: RunSettings;
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
    name: "Open",
    settings: { ...baseSettings, mode: "open" },
  },
  {
    description: "Begins with the Hyrule Castle escape before opening up.",
    id: "standard",
    name: "Standard",
    settings: { ...baseSettings, mode: "standard" },
  },
  {
    description: "Keys, maps and compasses are shuffled into the world.",
    id: "keysanity",
    name: "Keysanity",
    settings: { ...baseSettings, dungeonItems: "full" },
  },
  {
    description: "All dungeon bosses must be defeated before Ganon.",
    id: "all-dungeons",
    name: "All Dungeons",
    settings: { ...baseSettings, goal: "all-dungeons" },
  },
  {
    // alttpr.com's weapons "swordless" (vt app/Rom.php:2065-2073)
    description:
      "No swords: medallions work on their pads, the hammer reads tablets and hurts Ganon.",
    id: "swordless",
    name: "Swordless",
    settings: { ...baseSettings, swordless: true },
  },
  {
    description: "Collect the required Triforce pieces to win.",
    id: "triforce-hunt",
    name: "Triforce Hunt",
    settings: { ...baseSettings, goal: "triforce-hunt" },
  },
  {
    description: "Link starts in the Dark World; the mirror is inverted.",
    id: "inverted",
    name: "Inverted",
    settings: { ...baseSettings, mode: "inverted" },
  },
  {
    description:
      "The bow shoots rupees and a key opens any dungeon: arrows and keys are bought in shops.",
    id: "retro",
    name: "Retro",
    settings: { ...baseSettings, mode: "retro" },
  },
  {
    description: "Crossworld entrance rando + keysanity.",
    id: "crosskeys",
    name: "Crosskeys",
    settings: {
      ...baseSettings,
      dungeonItems: "full",
      entranceShuffle: "crossed",
    },
  },
  {
    description:
      "Settings hidden until you find them: set each one as you learn it, the run kept.",
    id: "mystery",
    name: "Mystery",
    settings: { ...baseSettings, hidden: HIDEABLE },
  },
];

/**
 * Whether a run's entrances are shuffled as the pack's port of the entrance
 * randomizer models them (packs/alttpr/src/er-world.ts): alttpr.com's
 * crossed shuffle, in the Open or Standard world, every dungeon item wild.
 * vt hands the randomizer --keysanity for `full` dungeon items alone
 * (app/EntranceRandomizer.php:69-71); under any other, the randomizer keeps
 * the keys in their dungeons, which the tracker does not track.
 */
export const crossedLogic = (settings: RunSettings): boolean =>
  settings.entranceShuffle === "crossed" &&
  (settings.mode === "open" || settings.mode === "standard") &&
  settings.dungeonItems === "full";

/**
 * Whether the entrance assistant knows a run's shuffled entrances
 * (`logic/entrances.ts`, `poolOf`): those of the Open or Standard world.
 * Inverted's crossed shuffle runs tables of its own, not ported yet.
 */
export const entrancesKnown = (settings: RunSettings): boolean =>
  settings.entranceShuffle !== "none" && settings.mode !== "inverted";

/**
 * Whether the pack models a run's logic: vt's NoGlitches without shuffled
 * entrances, the entrance randomizer's for a crossed shuffle it models
 * (crossedLogic). No glitched logic (`Glitches`).
 */
export const logicModelled = (settings: RunSettings): boolean =>
  settings.glitches === undefined &&
  (settings.entranceShuffle === "none" || crossedLogic(settings));

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

/** alttpr.com's "Glitches Required", None included. */
export const GLITCHES_LABELS: Record<Glitches | "none", string> = {
  hybrid_major_glitches: "Hybrid Major Glitches",
  major_glitches: "Major Glitches",
  no_logic: "No Logic",
  none: "None",
  overworld_glitches: "Overworld Glitches",
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
 * The settings a player may change in a run already going, its progress
 * kept (the store's `updateSettings`): what a Mystery run lets them
 * discover, and its dungeon items, whose counters keep the items found. The
 * world names a run type, which a new run changes.
 */
export type TunableSetting = HiddenSetting | "dungeonItems";

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
  dungeonItems: ordered(["standard", "mc", "mcs", "full"], DUNGEON_ITEM_LABELS),
  // Triforce Hunt is a run type of its own: the pack has no pieces
  goal: ordered(
    ["ganon", "fast-ganon", "all-dungeons", "pedestal"],
    GOAL_LABELS,
  ),
  itemFunctionality: ordered(
    ["normal", "hard", "expert", "superexpert"],
    FUNCTIONALITY_LABELS,
  ),
  itemPlacement: ordered(["advanced", "basic"], PLACEMENT_LABELS),
  itemPool: ordered(
    ["normal", "hard", "expert", "superexpert", "crowd_control"],
    POOL_LABELS,
  ),
  swordless: [
    [false, "With swords"],
    [true, "Swordless"],
  ],
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

/** Whether a run's setting is one it has not discovered yet. */
export const isHidden = (settings: RunSettings, setting: TunableSetting) =>
  (settings.hidden as readonly TunableSetting[] | undefined)?.includes(
    setting,
  ) === true;

/** A labeled summary of a run's settings, for display: "?" for a hidden one. */
export const describeSettings = (settings: RunSettings): SettingRow[] => {
  const row = (
    label: string,
    setting: TunableSetting,
    value: string,
  ): SettingRow => ({
    label,
    setting,
    value: isHidden(settings, setting) ? "?" : value,
  });
  return [
    { label: "Mode", value: MODE_LABELS[settings.mode] },
    row("Goal", "goal", GOAL_LABELS[settings.goal]),
    row(
      "Dungeon items",
      "dungeonItems",
      DUNGEON_ITEM_LABELS[settings.dungeonItems],
    ),
    row(
      "Swords",
      "swordless",
      settings.swordless ? "Swordless" : "With swords",
    ),
    row("Ganon's Tower", "crystalsTower", crystals(settings.crystalsTower)),
    row("Ganon", "crystalsGanon", crystals(settings.crystalsGanon)),
    row(
      "Item placement",
      "itemPlacement",
      PLACEMENT_LABELS[settings.itemPlacement],
    ),
    row("Item pool", "itemPool", POOL_LABELS[settings.itemPool]),
    row(
      "Item functionality",
      "itemFunctionality",
      FUNCTIONALITY_LABELS[settings.itemFunctionality],
    ),
    row(
      "Accessibility",
      "accessibility",
      ACCESSIBILITY_LABELS[settings.accessibility],
    ),
    { label: "Entrances", value: ENTRANCE_LABELS[settings.entranceShuffle] },
    { label: "Glitches", value: GLITCHES_LABELS[settings.glitches ?? "none"] },
  ];
};

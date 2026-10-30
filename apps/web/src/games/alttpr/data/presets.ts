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

import {
  DOOR_SETTING_LABELS,
  type DoorRunSettings,
  type DoorSetting,
  type DoorSettings,
  doorEntranceText,
  doorOf,
  doorReasons,
  doorRows,
  doorShuffleOf,
  doorValueText,
  isDoorRun,
} from "@/games/alttpr/data/doorRando";

type RunMode = "open" | "standard" | "inverted" | "retro";

type RunGoal =
  | "ganon"
  | "fast-ganon"
  | "all-dungeons"
  | "pedestal"
  | "triforce-hunt"
  | "ganonhunt"
  | "completionist";

/**
 * alttpr.com's weapons beside randomized and swordless (config/alttp.php:
 * 260-265): assured starts Link with Uncle's sword (Randomizer.php:256-260),
 * vanilla puts the swords at Uncle, the Pyramid Fairy, the Blacksmith and
 * the Pedestal (241-252). Absent is randomized; a swordless run has none.
 */
export type Swords = "assured" | "vanilla";

/**
 * alttpr.com's enemizer enemy health beside the default (config/alttp.php:
 * 282-287): the escape's kill rules count bombs and the Cane of Byrna only
 * at default health (ItemCollection.php:567-591). Absent is default.
 */
export type EnemyHealth = "easy" | "hard" | "expert";

type EntranceShuffle =
  | "none"
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity";

/**
 * alttpr.com's "Glitches Required" beyond None (config/alttp.php:174-180):
 * the glitched logics a seed may be generated for, set by a seed's import,
 * autotracking or by hand (`TUNING`). The pack reads each with its logic's
 * glitch flags (config/logic.php) and the boots a glitched world starts
 * with; No Logic with those the player plays it with (`playGlitches`). The
 * six tricks of the Tricks dialog are no logic of alttpr.com's: Overworld
 * Glitches turns four of them on, with boots clips, mirror clips and super
 * speed besides (config/logic.php:5-13); the Minor Glitches logic left in
 * VT8.25 (resources/views/updates.blade.php:965).
 */
export type Glitches =
  | "overworld_glitches"
  | "hybrid_major_glitches"
  | "major_glitches"
  | "no_logic";

/**
 * The glitches a No Logic seed is played with, which the map reads it
 * with: a glitched logic's, or none.
 */
export type PlayGlitches = Exclude<Glitches, "no_logic">;

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
 * alttpr.com's boss shuffle, the enemizer's (config/alttp.php:241-246;
 * Randomizer.php:396-447): none, each boss once (simple), each once and
 * three more (full), any (random).
 */
export type BossShuffle = "none" | "simple" | "full" | "random";

/**
 * The settings a Mystery run hides until the player finds them: those the
 * pack can leave unknown (packs/alttpr, settingsFromUpstream's UNKNOWN), and
 * the glitches and the entrance shuffle, which alttpr.com's own weighted
 * seeds roll (vt config/alttp.php:296-302 and 355-362, routes/console.php:
 * 40-66): hidden glitches read as what every logic agrees on
 * (`logic/settings.ts`, `glitchBounds`), a hidden entrance shuffle as every
 * check maybe until it is set (`unmodelledReasons`). The world shows on the
 * first screen, and the dungeon items are assumed until set: the key model
 * and the counters rest on them.
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
  "bossShuffle",
  "glitches",
  "entranceShuffle",
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
   * In a No Logic run, the glitches the player plays it with: the map shows
   * what they reach, the seed promising no route. Absent is none, and in
   * any other run.
   */
  playGlitches?: PlayGlitches;
  /**
   * The bosses shuffled between the dungeons; absent, as in every preset,
   * is "none" (`bossShuffleOf`).
   */
  bossShuffle?: BossShuffle;
  /** Where the swords are, a run with swords: absent is randomized. */
  swords?: Swords;
  /** The enemizer's enemy health: absent is default. */
  enemyHealth?: EnemyHealth;
  /**
   * The settings not known yet, a Mystery run's: their values above only
   * stand in, and the logic reads them as unknown. Absent when all are known.
   */
  hidden?: readonly HiddenSetting[];
} & DoorRunSettings;

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
    description:
      "Collect the Triforce pieces asked for, then defeat Ganon through the pyramid.",
    id: "ganonhunt",
    name: "Ganonhunt",
    settings: { ...baseSettings, goal: "ganonhunt" },
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
  {
    // aerinon's Door Randomizer with its doors vanilla: Hyrule Town Hall's
    // and SahasrahBot's seeds for most races of 2026 (the DR study)
    description:
      "A Door Randomizer seed, doors vanilla: key drops, pots, enemy drops and shop items as its settings shuffle them.",
    id: "door-randomizer",
    name: "Door Randomizer",
    settings: { ...baseSettings, randomizer: "dr" },
  },
  {
    // Crosskeys rolled on the Door Randomizer (Crosskeys 2026, Hyrule Town
    // Hall): crossed entrances, every dungeon item wild, doors vanilla.
    // Link's House and the Tavern's back are left unset: race seeds differ
    // (avianart's Crosskeys metas of 2026 shuffle neither on 1.5.7 and
    // 1.5.8, both on some 1.5.6 ones), so each may be moved and leads
    // nowhere until noted, never somewhere it may not
    description:
      "Crosskeys on the Door Randomizer: Crossworld entrances, keysanity, doors vanilla.",
    id: "door-crosskeys",
    name: "DR Crosskeys",
    settings: {
      ...baseSettings,
      dungeonItems: "full",
      entranceShuffle: "crossed",
      randomizer: "dr",
    },
  },
];

/**
 * The entrance shuffles the pack ports (packs/alttpr/src/entrances.ts,
 * `ErShuffle`): every one alttpr.com sends to the entrance randomizer
 * (--shuffle, app/EntranceRandomizer.php) but Insanity, which parts a door
 * from its way out.
 */
export const PORTED_SHUFFLES = [
  "simple",
  "restricted",
  "full",
  "crossed",
] as const satisfies readonly EntranceShuffle[];

/** A run's entrance shuffle when the pack ports it, else undefined. */
export const portedShuffleOf = (
  settings: RunSettings,
): (typeof PORTED_SHUFFLES)[number] | undefined =>
  PORTED_SHUFFLES.find((shuffle) => shuffle === settings.entranceShuffle);

/**
 * Whether a run's entrances are shuffled as the pack's port of the entrance
 * randomizer models them (packs/alttpr/src/er-world.ts): alttpr.com's
 * simple, restricted, full or crossed shuffle (`PORTED_SHUFFLES`), in the
 * Open, Retro (sent as --mode open --retro, app/EntranceRandomizer.php:
 * 79-82) or Standard world, whatever its dungeon items. The randomizer's
 * rules never ask which shuffle made a seed (Rules.py), so one world reads
 * them all, the entrances noted telling them apart. vt hands the randomizer
 * --keysanity for `full` dungeon items alone (app/EntranceRandomizer.php:
 * 69-71); under any other, mc and mcs included, the randomizer keeps every
 * key, map and compass in its dungeon, and the pack's key model of that
 * world reads the keys the tracker does not track (packs/alttpr/src/
 * er-keys.ts). Its boss slots read the boss shuffle as vt's world does, set
 * or hidden. The Glitches setting changes nothing: such a seed is filled
 * as NoGlitches, without the boots, whatever it names (`entranceRandomized`).
 * Never a Door Randomizer seed: DR shuffles entrances with its own pools,
 * which its own world reads (`doorLogic`).
 */
export const crossedLogic = (settings: RunSettings): boolean =>
  portedShuffleOf(settings) !== undefined &&
  !isHidden(settings, "entranceShuffle") &&
  settings.mode !== "inverted" &&
  !isDoorRun(settings);

/**
 * Whether a run takes the Door Randomizer's own world (the pack's
 * door-world, loaded on demand by `useDoorLogic`): a seed of DR itself (not
 * its Overworld fork, whose rules differ), its doors vanilla, its entrances
 * vanilla or of a shuffle DR's pools hold (`doorShuffleOf`: every one but
 * OWR's District), nothing the port of DR's world leaves out
 * (`doorReasons`), no glitched logic, its bosses in place (DR's world
 * reads each dungeon's own) and every setting known (a Mystery run's are
 * not).
 */
export const doorLogic = (settings: RunSettings): boolean =>
  settings.randomizer === "dr" &&
  !isHidden(settings, "entranceShuffle") &&
  ((settings.entranceShuffle === "none" &&
    settings.doorEntrances === undefined) ||
    doorShuffleOf(settings) !== undefined) &&
  settings.glitches === undefined &&
  !bossesMayMove(settings) &&
  (settings.hidden ?? []).length === 0 &&
  doorReasons(settings, false).length === 0;

/** A run's boss shuffle: "none" when its settings name none. */
export const bossShuffleOf = (settings: RunSettings): BossShuffle =>
  settings.bossShuffle ?? "none";

/** Whether a run's bosses may be shuffled: so set, or not known yet. */
export const bossesMayMove = (settings: RunSettings): boolean =>
  isHidden(settings, "bossShuffle") || bossShuffleOf(settings) !== "none";

/**
 * Whether the entrance assistant knows a run's shuffled entrances
 * (`logic/entrances.ts`, `poolOf`): those of a shuffle the pack ports
 * (`PORTED_SHUFFLES`) in the Open world (Retro's too) or the Standard one
 * (packs/alttpr, `entrancePool`); for a Door Randomizer seed, any shuffle
 * of DR's own pools (`doorShuffleOf`, the pack's `drEntrancePool`), in any
 * world. alttpr.com's Insanity and Inverted world, which run tables of
 * their own, are not modelled yet.
 */
export const entrancesKnown = (settings: RunSettings): boolean =>
  !isHidden(settings, "entranceShuffle") &&
  (isDoorRun(settings)
    ? doorShuffleOf(settings) !== undefined
    : portedShuffleOf(settings) !== undefined && settings.mode !== "inverted");

/**
 * Why the pack does not model a run's logic, one phrase per cause: an
 * entrance shuffle the pack does not port (Insanity) and the Inverted
 * world's shuffled entrances; for a Door Randomizer seed, what its port
 * leaves out (`doorReasons`), its glitched logics (the pack ports
 * alttpr.com's, not DR's), and what else keeps it out of DR's own world
 * (`doorBorrowed`), its entrances vanilla or shuffled by DR's pools. The pack ports vt's logics without shuffled entrances
 * and the entrance randomizer's NoGlitches for `crossedLogic`, whatever an
 * alttpr.com run's Glitches. Empty when the run is modelled. The one place
 * the cause is told, for the note over the map.
 */
export const unmodelledReasons = (settings: RunSettings): string[] => {
  const reasons: string[] = [];
  // A Door Randomizer seed's own (data/doorRando.ts); DR's world counts
  // the drops' keys, which alttpr.com's v31 borrowed elsewhere does not
  reasons.push(
    ...doorReasons(settings, wildItems(settings).keys && !doorLogic(settings)),
  );
  // DR's own glitched logics: the pack ports alttpr.com's, not DR's
  if (isDoorRun(settings) && settings.glitches !== undefined)
    reasons.push(`the Door Randomizer's ${GLITCHES_LABELS[settings.glitches]}`);
  const { entranceShuffle: shuffle, mode } = settings;
  // Not known yet: any shuffle, or none (`LogicNote` says to set it)
  if (isHidden(settings, "entranceShuffle")) return [HIDDEN_ENTRANCES];
  // DR's own pools hold its every shuffle but OWR's District (named by
  // `doorReasons`)
  if (shuffle === "none" || isDoorRun(settings)) {
    if (reasons.length === 0) reasons.push(...doorBorrowed(settings));
    return reasons;
  }
  // Glitches are no cause: alttpr.com hands any shuffled seed to the
  // entrance randomizer as NoGlitches (`entranceRandomized`)
  if (portedShuffleOf(settings) === undefined)
    reasons.push(`the ${ENTRANCE_LABELS[shuffle]} entrance shuffle`);
  if (mode === "inverted")
    reasons.push(`shuffled entrances in the ${MODE_LABELS[mode]} world`);
  return reasons;
};

/**
 * Why a Door Randomizer run that DR's own world does not hold is not
 * modelled: alttpr.com's v31 is no stand-in, its
 * rules differing from DR's where DR asks more (an enemy room's kills,
 * Ganons Tower's Tile Room's powder, DR's key analysis over DR's own fill:
 * Rules.py:909-, the pack's README). Its Overworld fork, whose rules are
 * its own; a boss shuffle, whose slots DR's world reads as their own
 * bosses; a Mystery run while any of its settings is hidden, which DR's
 * world needs all of (the owner's decision of 2026-10-30: v31 is no
 * longer read for it, between two logics or otherwise).
 */
const doorBorrowed = (settings: RunSettings): string[] => {
  if (!isDoorRun(settings) || doorLogic(settings)) return [];
  if (settings.randomizer === "owr")
    return ["the Overworld Randomizer's own rules"];
  const reasons: string[] = [];
  if (!isHidden(settings, "bossShuffle") && bossShuffleOf(settings) !== "none")
    reasons.push("shuffled bosses in a Door Randomizer seed");
  if ((settings.hidden ?? []).length > 0) reasons.push(HIDDEN_DOOR_SETTINGS);
  return reasons;
};

/**
 * The cause `unmodelledReasons` gives while a Door Randomizer run's
 * settings are not all known (a Mystery seed's): DR's world reads each.
 */
export const HIDDEN_DOOR_SETTINGS =
  "a Door Randomizer seed with hidden settings (set them in Mode)";

/**
 * The cause `unmodelledReasons` gives while a Mystery run's entrance
 * shuffle is not known yet: no logic can be told before it is set.
 */
export const HIDDEN_ENTRANCES = "entrances not known yet";

/**
 * Whether a run's seed was filled by the entrance randomizer: its entrance
 * shuffle known and not none. alttpr.com hands such a seed to it
 * (app/Http/Controllers/RandomizerController.php:172-176) as `--logic
 * noglitches` whatever its Glitches: app/EntranceRandomizer.php:84-91 maps
 * only `no_logic` to `nologic`, a name the world never holds (the
 * controller turns it into `NoLogic`, :110-116), and the boots a glitched
 * or No Logic world starts with come from Randomizer.php:122-131, which
 * such a seed never runs. Its logic is the entrance randomizer's
 * NoGlitches, without the boots (`logic/settings.ts`, `packSettings`).
 */
export const entranceRandomized = (settings: RunSettings): boolean =>
  !isHidden(settings, "entranceShuffle") && settings.entranceShuffle !== "none";

/**
 * Whether a run's entrances are shuffled: by alttpr.com's shuffle, or in a
 * Door Randomizer run by one of DR's own (`doorEntrances`), which leaves
 * alttpr.com's at none. What shows the Entrances tab and the map's doors.
 */
export const entrancesShuffled = (settings: RunSettings): boolean =>
  settings.entranceShuffle !== "none" ||
  (isDoorRun(settings) && settings.doorEntrances !== undefined);

/**
 * Whether a run's seed has No Logic: the map shows what the glitches the
 * player plays it with reach, never what is in logic. False while a
 * Mystery run's glitches are not known, and behind shuffled entrances,
 * whose seed is filled with NoGlitches' rules (`entranceRandomized`).
 */
export const noLogicRun = (settings: RunSettings): boolean =>
  !isHidden(settings, "glitches") &&
  settings.glitches === "no_logic" &&
  !entranceRandomized(settings);

/** Whether the pack models a run's logic (`unmodelledReasons`). */
export const logicModelled = (settings: RunSettings): boolean =>
  unmodelledReasons(settings).length === 0;

/**
 * The optional fields whose type can say what their absence means, which
 * written out is no change (a preset leaves the boss shuffle out).
 */
const ABSENT_MEANS: Readonly<Record<string, unknown>> = { bossShuffle: "none" };

/**
 * Whether two runs have the same settings: every field alike, the settings
 * not discovered in any order. A field left out, one set to undefined and
 * one written as the value its absence means are alike.
 */
export const sameSettings = (a: RunSettings, b: RunSettings): boolean => {
  const normal = (settings: RunSettings) =>
    JSON.stringify(
      Object.entries(settings)
        .filter(([, value]) => value !== undefined)
        .filter(([key, value]) => ABSENT_MEANS[key] !== value)
        .map(([key, value]): [string, unknown] => [
          key,
          key === "hidden" ? [...(value as string[])].sort() : value,
        ])
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return normal(a) === normal(b);
};

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
  completionist: "Completionist",
  "fast-ganon": "Fast Ganon",
  ganon: "Defeat Ganon",
  ganonhunt: "Ganonhunt",
  pedestal: "Pedestal",
  "triforce-hunt": "Triforce Hunt",
};

/** alttpr.com's weapons, but swordless, which the Swords row says. */
export const SWORDS_LABELS: Record<Swords | "randomized", string> = {
  assured: "Assured",
  randomized: "Randomized",
  vanilla: "Vanilla",
};

/** alttpr.com's enemy health (config/alttp.php:282-287). */
export const ENEMY_HEALTH_LABELS: Record<EnemyHealth | "default", string> = {
  default: "Default",
  easy: "Easy",
  expert: "Expert",
  hard: "Hard",
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

/**
 * The same in the summary's selects, after their row's "Glitches" or
 * "Played with": the full names would not fit their width on a phone.
 */
const GLITCHES_SHORT: Record<Glitches | "none", string> = {
  hybrid_major_glitches: "Hybrid Major",
  major_glitches: "Major",
  no_logic: "No Logic",
  none: "None",
  overworld_glitches: "Overworld",
};

/** alttpr.com's boss shuffle options (config/alttp.php:241-246). */
export const BOSS_SHUFFLE_LABELS: Record<BossShuffle, string> = {
  full: "Full",
  none: "None",
  random: "Random",
  simple: "Simple",
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
 * discover (its entrance shuffle included), its dungeon items, whose
 * counters keep the items found, and the glitches the seed was generated
 * for, which neither the ROM tells apart nor a race reads. The world names
 * a run type, which a new run changes.
 */
export type TunableSetting =
  | HiddenSetting
  | "dungeonItems"
  | "glitches"
  | "playGlitches"
  | "swords"
  | "enemyHealth";

/**
 * The value a tunable setting's option sets: the run's own, but for the
 * glitches, whose None is a value here and their absence in a run.
 */
export type TuningValue<K extends TunableSetting> = K extends "glitches"
  ? Glitches | "none"
  : K extends "playGlitches"
    ? PlayGlitches | "none"
    : K extends "swords"
      ? Swords | "randomized"
      : K extends "enemyHealth"
        ? EnemyHealth | "default"
        : RunSettings[K];

/** A change of tunable settings, as `updateSettings` takes it. */
export type SettingsChange = { [K in TunableSetting]?: TuningValue<K> };

/** A run's glitches: "none" when its settings name none. */
export const glitchesOf = (settings: RunSettings): Glitches | "none" =>
  settings.glitches ?? "none";

/** The glitches a No Logic run is played with: "none" when it names none. */
export const playGlitchesOf = (settings: RunSettings): PlayGlitches | "none" =>
  settings.playGlitches ?? "none";

/** Where a run's swords are: "randomized" when its settings name none. */
export const swordsOf = (settings: RunSettings): Swords | "randomized" =>
  settings.swords ?? "randomized";

/** A run's enemy health: "default" when its settings name none. */
export const enemyHealthOf = (settings: RunSettings): EnemyHealth | "default" =>
  settings.enemyHealth ?? "default";

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
  bossShuffle: ordered<BossShuffle>(
    ["none", "simple", "full", "random"],
    BOSS_SHUFFLE_LABELS,
  ),
  crystalsGanon: CRYSTAL_COUNTS,
  crystalsTower: CRYSTAL_COUNTS,
  dungeonItems: ordered(["standard", "mc", "mcs", "full"], DUNGEON_ITEM_LABELS),
  enemyHealth: ordered<EnemyHealth | "default">(
    ["default", "easy", "hard", "expert"],
    ENEMY_HEALTH_LABELS,
  ),
  entranceShuffle: ordered<EntranceShuffle>(
    ["none", "simple", "restricted", "full", "crossed", "insanity"],
    ENTRANCE_LABELS,
  ),
  glitches: ordered<Glitches | "none">(
    [
      "none",
      "overworld_glitches",
      "hybrid_major_glitches",
      "major_glitches",
      "no_logic",
    ],
    GLITCHES_SHORT,
  ),
  // The hunts are run types of their own: their pieces' cell and count
  goal: ordered(
    ["ganon", "fast-ganon", "all-dungeons", "pedestal", "completionist"],
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
  playGlitches: ordered<PlayGlitches | "none">(
    ["none", "overworld_glitches", "hybrid_major_glitches", "major_glitches"],
    GLITCHES_SHORT,
  ),
  swordless: [
    [false, "With swords"],
    [true, "Swordless"],
  ],
  swords: ordered<Swords | "randomized">(
    ["randomized", "assured", "vanilla"],
    SWORDS_LABELS,
  ),
} as const satisfies {
  readonly [K in TunableSetting]: readonly (readonly [
    TuningValue<K>,
    string,
  ])[];
};

/** One row of a run's summary: its words, and the setting when tunable. */
export type SettingRow = {
  readonly label: string;
  readonly value: string;
  readonly setting?: TunableSetting;
  /** A Door Randomizer setting, which its own select changes. */
  readonly doorSetting?: DoorSetting;
  /**
   * A Door Randomizer run's entrance shuffle, which a select of DR's own
   * shuffles changes (`doorEntranceModes`): alttpr.com's or DR's own.
   */
  readonly doorEntrances?: true;
};

/** Whether a run's setting is one it has not discovered yet. */
export const isHidden = (settings: RunSettings, setting: TunableSetting) =>
  (settings.hidden as readonly TunableSetting[] | undefined)?.includes(
    setting,
  ) === true;

/**
 * A tunable setting's value as its options name it: a boss shuffle, the
 * glitches or those a No Logic run is played with left out read "none".
 */
export const tunedOf = <K extends TunableSetting>(
  settings: RunSettings,
  setting: K,
): TuningValue<K> => {
  const value =
    setting === "bossShuffle"
      ? bossShuffleOf(settings)
      : setting === "glitches"
        ? glitchesOf(settings)
        : setting === "playGlitches"
          ? playGlitchesOf(settings)
          : setting === "swords"
            ? swordsOf(settings)
            : setting === "enemyHealth"
              ? enemyHealthOf(settings)
              : settings[setting];
  return value as TuningValue<K>;
};

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
    // Where the swords are, once a run is known to have them
    ...(settings.swordless || isHidden(settings, "swordless")
      ? []
      : [row("Sword placement", "swords", SWORDS_LABELS[swordsOf(settings)])]),
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
    row(
      "Boss shuffle",
      "bossShuffle",
      BOSS_SHUFFLE_LABELS[bossShuffleOf(settings)],
    ),
    row(
      "Enemy health",
      "enemyHealth",
      ENEMY_HEALTH_LABELS[enemyHealthOf(settings)],
    ),
    // A DR run's are DR's own shuffles, by DR's names
    isDoorRun(settings)
      ? {
          doorEntrances: true,
          label: "Entrances",
          value: isHidden(settings, "entranceShuffle")
            ? "?"
            : doorEntranceText(settings),
        }
      : row(
          "Entrances",
          "entranceShuffle",
          ENTRANCE_LABELS[settings.entranceShuffle],
        ),
    row("Glitches", "glitches", GLITCHES_LABELS[glitchesOf(settings)]),
    ...(noLogicRun(settings)
      ? [
          row(
            "Played with",
            "playGlitches",
            GLITCHES_LABELS[playGlitchesOf(settings)],
          ),
        ]
      : []),
    ...(isDoorRun(settings)
      ? [
          {
            label: DOOR_SETTING_LABELS.randomizer,
            value: doorValueText("randomizer", settings.randomizer),
          },
        ]
      : []),
    ...doorRows(settings).map((doorSetting) => ({
      doorSetting,
      label: DOOR_SETTING_LABELS[doorSetting],
      value: doorValueText(
        doorSetting,
        (doorOf(settings) as DoorSettings)[doorSetting],
      ),
    })),
  ];
};

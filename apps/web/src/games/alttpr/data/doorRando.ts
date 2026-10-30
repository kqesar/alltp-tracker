/**
 * A Door Randomizer run's own settings: what aerinon's Door Randomizer (DR,
 * 1.5.8, the pack's upstream.json) and its Overworld fork (OWR) add to a
 * seed beyond alttpr.com's, as flat fields of the run's settings (a shared
 * link packs each as `key:value`). All are absent from an alttpr.com run;
 * in a DR run an absent field is its default (vanilla doors, nothing more
 * shuffled), DR's own (resources/app/cli/args.json).
 *
 * The tracker reads the vanilla-door part of DR: its key drops, pots, enemy
 * drops and shop items are locations (the pack's door-rando/locations.ts),
 * and a DR run with vanilla doors is solved in the pack's port of DR's own
 * world (`doorLogic` in presets.ts), on its entrances as noted where DR
 * shuffled them (`doorShuffleOf`, the pack's DR entrance pools). What it
 * does not model yet (door shuffle, the overworld shuffles, enemy shuffle)
 * is named by `doorReasons`, and what a run's logic rests on by `doorNotes`.
 */

import {
  BONK_DROP_IDS,
  DOOR_RANDOMIZER_VERSION,
  DR_LOCATIONS,
  type DrLocation,
  type DrLocationSet,
  type DrModes,
  type DropShuffle,
  type DrPoolSettings,
  type DrShuffle,
  type DungeonId,
  doorSwitches,
  drKeysAdded,
  drLocationsOf,
  NO_SCREEN,
  OVERWORLD_RANDOMIZER_VERSION,
  type OwrFlipGroup,
  type OwrShuffle,
  owrFlipGroups,
  type PotteryMode,
  type SeedSetting,
  type SeedSettingsReading,
  type TakeAny,
} from "@alltp/pack-alttpr";
import type { OwrNotes } from "@alltp/pack-alttpr/door-world";
import type { OverworldNotes } from "@/games/alttpr/stores/persistence";

/** Which of DR's generators wrote the seed: DR itself, or its Overworld fork. */
export type Randomizer = "dr" | "owr";

/** DR's door shuffle (`--doorShuffle`). */
export type DoorShuffle = "vanilla" | "basic" | "partitioned" | "crossed";

/**
 * A door shuffle's intensity (`--intensity`, args.json): 1 its doors and
 * stairs, 2 its open edges too, 3 its lobbies too.
 */
export type DoorIntensity = "1" | "2" | "3";

/**
 * DR's key logic (`--key_logic_algorithm`, args.json:209-216 at 1.5.8):
 * dangerous, partial, strict, and the `static` 1.5.7 added, which some
 * race seeds of 2026 ran on (from DR's unstable 1.5.6 builds).
 */
export type DoorKeyLogic = "partial" | "strict" | "dangerous" | "static";

/** DR's enemy shuffle (`--shuffleenemies`). */
export type EnemyShuffle = "none" | "shuffled";

/**
 * DR's entrance shuffles alttpr.com does not have (`--shuffle`, its
 * EntranceShuffle2): the others are the run's `entranceShuffle`.
 */
export type DoorEntrances =
  | "lite"
  | "lean"
  | "swapped"
  | "district"
  | "dungeonssimple"
  | "dungeonsfull";

/** OWR's overworld layout (`--ow_layout`). */
export type OverworldLayout = "vanilla" | "grid" | "wild";

/** OWR's crossed overworld (`--ow_crossed`). */
export type OverworldCrossed = "none" | "grouped" | "polar" | "unrestricted";

/** OWR's flute spots (`--ow_fluteshuffle`). */
export type FluteShuffle = "vanilla" | "balanced" | "random";

/**
 * OWR's prize shuffle (`--prizeshuffle`, 0.8.0.2's args.json): each
 * dungeon's pendant or crystal an item placed in the dungeon, near it or
 * anywhere (ItemList.py:786).
 */
export type PrizeShuffle = "none" | "dungeon" | "nearby" | "wild";

/**
 * DR's restricted boss items (`--restrict_boss_items`, args.json): any but
 * none puts each prize, boss and Agahnim 2 behind its dungeon's map and
 * compass (Rules.py:809-825).
 */
export type RestrictBossItems = "none" | "mapcompass" | "dungeon";

/**
 * DR's pyramid hole (`--openpyramid`, args.json): `auto` opens it for the
 * crystals, trinity and ganonhunt goals with vanilla or dungeon entrances
 * alone (is_pyramid_open, BaseClasses.py:299-311).
 */
export type OpenPyramid = "auto" | "yes" | "no";

/**
 * The DR release a seed was built by, as far as its logic goes: 1.5.7 asks
 * less than 1.5.6 in one place (the Inverted world's save point leads out,
 * EntranceShuffle2.py:171-176 at 1.5.8), so the tracker grants it only to a
 * seed known to be 1.5.7's or later. "1.5.6" stands for an older release
 * or one not known; a newer release than 1.5.8 reads as 1.5.8.
 */
export type DoorVersion = "1.5.6" | "1.5.7" | "1.5.8";

/** The settings a DR run adds, each absent from an alttpr.com run. */
export type DoorRunSettings = {
  /** DR's generator; absent for an alttpr.com seed. */
  randomizer?: Randomizer;
  /** The DR release that built the seed, from the seed; absent: not known. */
  doorVersion?: DoorVersion;
  doorShuffle?: DoorShuffle;
  keyLogic?: DoorKeyLogic;
  dropShuffle?: DropShuffle;
  pottery?: PotteryMode;
  shopsanity?: boolean;
  takeAny?: TakeAny;
  enemyShuffle?: EnemyShuffle;
  doorEntrances?: DoorEntrances;
  owLayout?: OverworldLayout;
  owCrossed?: OverworldCrossed;
  owMixed?: boolean;
  owWhirlpool?: boolean;
  owFluteShuffle?: FluteShuffle;
  bonkDrops?: boolean;
  /**
   * OWR's prize shuffle and its followers shuffled (`--shuffle_followers`:
   * each follower's quest a location, ItemList.py:1740-1745), which its
   * rules read. A spoiler's meta names them; the ROM tells the followers
   * and a prize shuffle out of the dungeons, never none from dungeon
   * (seed-settings.ts). Unset, each is not known (`DOOR_UNSET`): a cause
   * of `doorReasons` until the player sets it, never none by assumption.
   */
  prizeShuffle?: PrizeShuffle;
  shuffleFollowers?: boolean;
  /**
   * Whether OWR places a kind of dungeon item nearby (`keyshuffle`,
   * `bigkeyshuffle`, `mapshuffle` or `compassshuffle` "nearby", args.json:
   * in a dungeon near its own), a placement the fork's world does not
   * read: a cause of `doorReasons`. A spoiler's meta names it, the ROM's
   * FreeItemText tells it (Rom.py:1431); absent is none, the fork's
   * default, the kinds then read as dungeon items do.
   */
  nearbyItems?: boolean;
  /**
   * Whether OWR's customizer sets a goal (`custom_goals`: GT's entry,
   * Ganon, the pedestal or Murahdahla), whose rule the fork's world does
   * not read (Rules.py:71-73, :368-370, :536-538). A spoiler's meta names
   * it; a ROM's goal tables are not read (seed-settings.ts). Unset, it is
   * not known (`DOOR_UNSET`), a cause of `doorReasons` for an OWR run.
   */
  customGoals?: boolean;
  /**
   * The bomb bag (`--bombbag`: bombs need the +10 upgrade, can_use_bombs,
   * BaseClasses.py:1208-1209): a spoiler's meta names it, the ROM's item
   * substitutions tell it (seed-settings.ts). Unset, it is not known
   * (`DOOR_UNSET`), and DR's world reads it on (`drSettingsOf`): with the
   * +10 upgrade unknown (the pack's `bombUpgrade` count, no cell records
   * it), a check that wants bombs is maybe, never in logic by a guess of
   * off, and nothing else moves (can_use_bombs is the only rule that reads
   * the bag, dr:BaseClasses.py:1209, owr:BaseClasses.py:1367).
   *
   * The settings DR's rules read that no ROM table states: the legacy pot
   * shuffle (`--shufflepots`: Mire's spikes' key pot may move onto the
   * spikes, Rules.py:530-533), the boss items and the pyramid hole. A
   * spoiler's meta names them; a run read from its ROM alone holds DR's
   * defaults until the player sets them.
   */
  bombBag?: boolean;
  potShuffle?: boolean;
  restrictBossItems?: RestrictBossItems;
  openPyramid?: OpenPyramid;
  /**
   * Whether the entrance shuffle moves Link's House (`--shufflelinks`,
   * EntranceShuffle2.py:555) and the Tavern's back door (`--shuffletavern`,
   * :211): a spoiler's meta names them, no ROM table does. Unset, each
   * reads as "may be moved" (`DOOR_UNSET`): the logic waits for the
   * player's note, never assumes the door vanilla.
   */
  shuffleLinks?: boolean;
  shuffleTavern?: boolean;
  /**
   * A door shuffle's intensity (`--intensity`) and its decoupled doors
   * (`--decoupledoors`): a spoiler's meta names them, no ROM table read
   * does. The intensity unset reads as 3, everything shuffled
   * (`DOOR_UNSET`): a portal's lobby then waits for the player's note.
   */
  doorIntensity?: DoorIntensity;
  decoupledDoors?: boolean;
};

/** A DR setting's key. */
export type DoorSetting = keyof DoorRunSettings;

/**
 * The DR settings a run may leave unset, which no default stands for: what
 * a ROM may not state and a guess would make unsound. Unset, the entrance
 * shuffle may have moved the door (`doorPoolSettingsOf`), every lobby may
 * move, and the bomb bag and OWR's prize and follower shuffles and custom
 * goals are causes of `doorReasons`.
 */
export const DOOR_UNSET = [
  "shuffleLinks",
  "shuffleTavern",
  "doorIntensity",
  "prizeShuffle",
  "shuffleFollowers",
  "bombBag",
  "customGoals",
] as const;

/** A DR setting a run may leave unset. */
export type DoorUnsetSetting = (typeof DOOR_UNSET)[number];

/** What a DR run's settings are, every default filled in. */
export type DoorSettings = Required<
  Omit<DoorRunSettings, "doorEntrances" | DoorUnsetSetting>
> &
  Pick<DoorRunSettings, "doorEntrances" | DoorUnsetSetting>;

/** DR's defaults (args.json): what an absent field of a DR run means. */
export const DOOR_DEFAULTS: Omit<DoorSettings, "randomizer"> = {
  bonkDrops: false,
  decoupledDoors: false,
  doorShuffle: "vanilla",
  doorVersion: "1.5.6",
  dropShuffle: "none",
  enemyShuffle: "none",
  keyLogic: "partial",
  nearbyItems: false,
  openPyramid: "auto",
  owCrossed: "none",
  owFluteShuffle: "vanilla",
  owLayout: "vanilla",
  owMixed: false,
  owWhirlpool: false,
  potShuffle: false,
  pottery: "none",
  restrictBossItems: "none",
  shopsanity: false,
  takeAny: "none",
};

/** Whether a run is a Door Randomizer seed's. */
export const isDoorRun = (settings: DoorRunSettings): boolean =>
  settings.randomizer !== undefined;

/**
 * Whether a run is known to have DR's bomb bag on: its bombs start at none
 * and the bombs cell then tells the bag found (BAG_BOMBS). Not known is no.
 */
export const isBagRun = (settings: DoorRunSettings): boolean =>
  isDoorRun(settings) && settings.bombBag === true;

/** A DR run's settings with its defaults; null for an alttpr.com run. */
export const doorOf = (settings: DoorRunSettings): DoorSettings | null =>
  settings.randomizer === undefined
    ? null
    : ({
        ...DOOR_DEFAULTS,
        ...settings,
        randomizer: settings.randomizer,
      } as DoorSettings);

/** Each DR setting's options, in args.json's order, with their words. */
export const DOOR_OPTIONS = {
  bombBag: [
    [false, "Off"],
    [true, "On"],
  ],
  bonkDrops: [
    [false, "Off"],
    [true, "Shuffled"],
  ],
  customGoals: [
    [false, "None"],
    [true, "Set"],
  ],
  decoupledDoors: [
    [false, "Off"],
    [true, "On"],
  ],
  doorEntrances: [
    ["lite", "Lite"],
    ["lean", "Lean"],
    ["swapped", "Swapped"],
    ["district", "District"],
    ["dungeonssimple", "Dungeons + Simple"],
    ["dungeonsfull", "Dungeons + Full"],
  ],
  doorIntensity: [
    ["1", "1: doors and stairs"],
    ["2", "2: open edges too"],
    ["3", "3: lobbies too"],
  ],
  doorShuffle: [
    ["vanilla", "Vanilla"],
    ["basic", "Basic"],
    ["partitioned", "Partitioned"],
    ["crossed", "Crossed"],
  ],
  doorVersion: [
    ["1.5.6", "1.5.6 or older"],
    ["1.5.7", "1.5.7"],
    ["1.5.8", "1.5.8"],
  ],
  dropShuffle: [
    ["none", "None"],
    ["keys", "Keys"],
    ["underworld", "Underworld"],
  ],
  enemyShuffle: [
    ["none", "None"],
    ["shuffled", "Shuffled"],
  ],
  keyLogic: [
    ["dangerous", "Dangerous"],
    ["partial", "Partial"],
    ["strict", "Strict"],
    ["static", "Static"],
  ],
  nearbyItems: [
    [false, "Off"],
    [true, "Nearby"],
  ],
  openPyramid: [
    ["auto", "Auto"],
    ["yes", "Open"],
    ["no", "Closed"],
  ],
  owCrossed: [
    ["none", "None"],
    ["grouped", "Grouped"],
    ["polar", "Polar"],
    ["unrestricted", "Unrestricted"],
  ],
  owFluteShuffle: [
    ["vanilla", "Vanilla"],
    ["balanced", "Balanced"],
    ["random", "Random"],
  ],
  owLayout: [
    ["vanilla", "Vanilla"],
    ["grid", "Grid"],
    ["wild", "Wild"],
  ],
  owMixed: [
    [false, "Off"],
    [true, "Mixed"],
  ],
  owWhirlpool: [
    [false, "Vanilla"],
    [true, "Shuffled"],
  ],
  potShuffle: [
    [false, "Off"],
    [true, "On"],
  ],
  pottery: [
    ["none", "None"],
    ["keys", "Key pots"],
    ["cave", "Cave pots"],
    ["cavekeys", "Cave and key pots"],
    ["dungeon", "Dungeon pots"],
    ["reduced", "Reduced"],
    ["clustered", "Clustered"],
    ["nonempty", "Non-empty pots"],
    ["lottery", "Lottery"],
  ],
  prizeShuffle: [
    ["none", "None"],
    ["dungeon", "In their dungeon"],
    ["nearby", "Nearby"],
    ["wild", "Anywhere"],
  ],
  randomizer: [
    ["dr", "Door Randomizer"],
    ["owr", "Overworld Randomizer"],
  ],
  restrictBossItems: [
    ["none", "None"],
    ["mapcompass", "Map and compass"],
    ["dungeon", "Dungeon items"],
  ],
  shopsanity: [
    [false, "Off"],
    [true, "On"],
  ],
  shuffleFollowers: [
    [false, "Off"],
    [true, "Shuffled"],
  ],
  shuffleLinks: [
    [false, "Off"],
    [true, "Shuffled"],
  ],
  shuffleTavern: [
    [false, "Off"],
    [true, "Shuffled"],
  ],
  takeAny: [
    ["none", "None"],
    ["random", "Random"],
    ["fixed", "Fixed"],
  ],
} as const satisfies {
  readonly [K in DoorSetting]-?: readonly (readonly [
    NonNullable<DoorRunSettings[K]>,
    string,
  ])[];
};

/** Each DR setting's label in the run's summary. */
export const DOOR_SETTING_LABELS: Readonly<Record<DoorSetting, string>> = {
  bombBag: "Bomb bag",
  bonkDrops: "Bonk drops",
  customGoals: "Custom goals",
  decoupledDoors: "Decoupled doors",
  doorEntrances: "DR entrances",
  doorIntensity: "Door intensity",
  doorShuffle: "Door shuffle",
  doorVersion: "DR version",
  dropShuffle: "Enemy drops",
  enemyShuffle: "Enemies",
  keyLogic: "Key logic",
  nearbyItems: "Nearby dungeon items",
  openPyramid: "Pyramid hole",
  owCrossed: "Crossed overworld",
  owFluteShuffle: "Flute spots",
  owLayout: "Overworld layout",
  owMixed: "Mixed overworld",
  owWhirlpool: "Whirlpools",
  potShuffle: "Pot shuffle",
  pottery: "Pottery",
  prizeShuffle: "Prizes",
  randomizer: "Randomizer",
  restrictBossItems: "Boss items",
  shopsanity: "Shopsanity",
  shuffleFollowers: "Followers",
  shuffleLinks: "Link's House",
  shuffleTavern: "Back of Tavern",
  takeAny: "Take-any caves",
};

/** The DR settings the summary shows, in DR's order; OWR's in an OWR run. */
const DR_ROWS = [
  "doorVersion",
  "doorShuffle",
  "keyLogic",
  "dropShuffle",
  "pottery",
  "potShuffle",
  "shopsanity",
  "takeAny",
  "enemyShuffle",
  "bombBag",
  "restrictBossItems",
  "openPyramid",
] as const satisfies readonly DoorSetting[];
const OWR_ROWS = [
  "owLayout",
  "owCrossed",
  "owMixed",
  "owWhirlpool",
  "owFluteShuffle",
  "bonkDrops",
  "prizeShuffle",
  "nearbyItems",
  "shuffleFollowers",
  "customGoals",
] as const satisfies readonly DoorSetting[];

/** The door shuffle's own settings, shown while doors are shuffled. */
const DOOR_SHUFFLE_ROWS = [
  "doorIntensity",
  "decoupledDoors",
] as const satisfies readonly DoorSetting[];

/** The entrance shuffle's own settings, shown while entrances are shuffled. */
const ENTRANCE_ROWS = [
  "shuffleLinks",
  "shuffleTavern",
] as const satisfies readonly DoorSetting[];

/** The DR settings a run's summary shows, as selects: none outside DR. */
export const doorRows = (
  settings: DoorRunSettings & { entranceShuffle?: string },
): readonly DoorSetting[] => {
  if (settings.randomizer === undefined) return [];
  const entrances =
    settings.doorEntrances !== undefined ||
    (settings.entranceShuffle !== undefined &&
      settings.entranceShuffle !== "none")
      ? ENTRANCE_ROWS
      : [];
  const doors =
    (settings.doorShuffle ?? "vanilla") === "vanilla" ? [] : DOOR_SHUFFLE_ROWS;
  const rows = [
    ...DR_ROWS.slice(0, 2),
    ...doors,
    ...DR_ROWS.slice(2),
    ...entrances,
  ];
  return settings.randomizer === "owr" ? [...rows, ...OWR_ROWS] : rows;
};

/**
 * A DR run's door shuffle as the pack's DR world takes it (its
 * `DoorShuffleSettings`); undefined with vanilla doors or outside DR. The
 * intensity unset reads as 3 (everything shuffled), the trap mode as the
 * widest (a boss's trap door may open), so the world never assumes a door
 * vanilla that the seed may have moved.
 */
export const doorShuffleSettingsOf = (
  settings: DoorRunSettings,
):
  | {
      readonly shuffle: "basic" | "partitioned" | "crossed";
      readonly intensity: 1 | 2 | 3;
      readonly decoupled: boolean;
      readonly trapMode: "oneway";
    }
  | undefined => {
  const door = doorOf(settings);
  if (door === null || door.doorShuffle === "vanilla") return undefined;
  return {
    decoupled: door.decoupledDoors,
    intensity: Number(door.doorIntensity ?? "3") as 1 | 2 | 3,
    shuffle: door.doorShuffle,
    trapMode: "oneway",
  };
};

/**
 * DR's entrance shuffles as its GUI offers them, in its order
 * (resources/app/gui/randomize/entrando/widgets.json at DR 1.5.8) and its
 * words (lang/en.json `randomizer.entrance.entranceshuffle.*`). Those
 * alttpr.com has too are a run's `entranceShuffle` (vanilla its "none"),
 * the others its `doorEntrances`.
 */
const DR_ENTRANCE_MODES = [
  ["vanilla", "Vanilla"],
  ["simple", "Simple"],
  ["restricted", "Restricted"],
  ["full", "Full"],
  ["lite", "Lite"],
  ["lean", "Lean"],
  ["swapped", "Swapped"],
  ["crossed", "Crossed"],
  ["insanity", "Insanity"],
  ["dungeonsfull", "Dungeons + Full"],
  ["dungeonssimple", "Dungeons + Simple"],
] as const;

/** alttpr.com's entrance shuffles, which DR has too (a run's `entranceShuffle`). */
type SharedEntrances =
  | "none"
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity";

/** A DR entrance shuffle, as DR's `--shuffle` names it. */
export type DoorEntranceMode =
  | (typeof DR_ENTRANCE_MODES)[number][0]
  | "district";

/**
 * The entrance shuffles a DR run's summary offers, DR's own words in DR's
 * order; the Overworld fork's adds District after Lean (its
 * resources/app/cli/args.json and lang/en.json at 0.8.0.0).
 */
export const doorEntranceModes = (
  randomizer: Randomizer,
): readonly (readonly [DoorEntranceMode, string])[] =>
  randomizer === "owr"
    ? [
        ...DR_ENTRANCE_MODES.slice(0, 6),
        ["district", "District"],
        ...DR_ENTRANCE_MODES.slice(6),
      ]
    : DR_ENTRANCE_MODES;

/** A DR run's entrance shuffle, in DR's name: its own, or alttpr.com's. */
export const doorEntranceOf = (
  settings: DoorRunSettings & { entranceShuffle: string },
): DoorEntranceMode =>
  settings.doorEntrances ??
  (settings.entranceShuffle === "none"
    ? "vanilla"
    : (settings.entranceShuffle as DoorEntranceMode));

/** A DR run's entrance shuffle in DR's words. */
export const doorEntranceText = (
  settings: DoorRunSettings & { entranceShuffle: string },
): string => {
  const mode = doorEntranceOf(settings);
  return (
    doorEntranceModes(settings.randomizer ?? "dr").find(
      ([option]) => option === mode,
    )?.[1] ?? mode
  );
};

/**
 * The run settings a DR entrance shuffle sets: alttpr.com's of the same
 * name, its own cleared, or DR's own with alttpr.com's at none, so a run
 * never holds two.
 */
export const doorEntranceChange = (
  mode: DoorEntranceMode,
): {
  readonly entranceShuffle: SharedEntrances;
  readonly doorEntrances: DoorEntrances | undefined;
} =>
  DR_SHUFFLES.includes(mode) || mode === "vanilla"
    ? {
        doorEntrances: undefined,
        entranceShuffle:
          mode === "vanilla" ? "none" : (mode as SharedEntrances),
      }
    : { doorEntrances: mode as DoorEntrances, entranceShuffle: "none" };

/** alttpr.com's entrance shuffles DR has too, by the same name. */
const DR_SHUFFLES: readonly string[] = [
  "simple",
  "restricted",
  "full",
  "crossed",
  "insanity",
];

/**
 * A DR run's entrance shuffle as the pack's pools name it: DR's own
 * (`doorEntrances`) or alttpr.com's of the same name, read by DR's pools;
 * for an OWR run, the fork's own District and Swapped (`doorEntrances`,
 * the pack's `owrEntrancePool`). Undefined for vanilla entrances, an
 * alttpr.com run and an OWR run's other shuffles, whose pools the fork
 * builds its own way.
 */
export const doorShuffleOf = (
  settings: DoorRunSettings & { entranceShuffle?: string },
): DrShuffle | OwrShuffle | undefined => {
  if (settings.randomizer === undefined) return undefined;
  if (settings.randomizer === "owr")
    return settings.doorEntrances === "district" ||
      settings.doorEntrances === "swapped"
      ? settings.doorEntrances
      : undefined;
  if (settings.doorEntrances !== undefined)
    return settings.doorEntrances === "district"
      ? undefined
      : settings.doorEntrances;
  const shuffle = settings.entranceShuffle;
  return shuffle !== undefined && DR_SHUFFLES.includes(shuffle)
    ? (shuffle as DrShuffle)
    : undefined;
};

/**
 * What of a DR run its entrance pool reads (the pack's `drShuffled`): the
 * world, Link's House and the Tavern's back, and the settings lite's and
 * lean's kept caves read.
 */
export const doorPoolSettingsOf = (
  settings: DoorRunSettings & { mode?: string },
): DrPoolSettings => {
  const door = doorOf(settings) ?? { ...DOOR_DEFAULTS };
  return {
    dropShuffle: door.dropShuffle,
    enemyShuffle: door.enemyShuffle !== "none",
    mode:
      settings.mode === "inverted"
        ? "inverted"
        : settings.mode === "standard"
          ? "standard"
          : "open",
    pottery: door.pottery,
    shopsanity: door.shopsanity,
    // Unset: the shuffle may have moved them, so each waits for a note
    shuffleLinks: door.shuffleLinks ?? true,
    shuffleTavern: door.shuffleTavern ?? true,
  };
};

/** The words of a DR setting left unset (`DOOR_UNSET`). */
export const DOOR_UNSET_TEXT = "Not known";

/** A DR setting's value in words. */
export const doorValueText = <K extends DoorSetting>(
  setting: K,
  value: DoorRunSettings[K],
): string =>
  value === undefined
    ? DOOR_UNSET_TEXT
    : ((DOOR_OPTIONS[setting] as readonly (readonly [unknown, string])[]).find(
        ([option]) => option === value,
      )?.[1] ?? String(value));

/**
 * Whether a saved value is DR settings this version knows: each field
 * absent or one of its options, and none without a generator.
 */
export const isDoorSettings = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(DOOR_OPTIONS) as DoorSetting[];
  const present = keys.filter((key) => value[key] !== undefined);
  if (present.length > 0 && value.randomizer === undefined) return false;
  // District is the Overworld fork's alone (OWR's EntranceShuffle2.py)
  if (value.doorEntrances === "district" && value.randomizer !== "owr")
    return false;
  return present.every((key) =>
    (DOOR_OPTIONS[key] as readonly (readonly [unknown, string])[]).some(
      ([option]) => option === value[key],
    ),
  );
};

/** Whether the run's key drops are shuffled: its drops' or its key pots'. */
const keyDropsShuffled = (door: DoorSettings) =>
  door.dropShuffle !== "none" ||
  (door.pottery !== "none" && door.pottery !== "cave");

/**
 * Why the tracker does not model a DR run's logic yet, one phrase per
 * cause, the step of the Door Randomizer's port each waits for; empty for
 * an alttpr.com run or a DR one whose logic it borrows (`doorNotes`).
 * @param keysWild - Whether the run's small keys leave their dungeons
 */
export const doorReasons = (
  settings: DoorRunSettings,
  keysWild: boolean,
): string[] => {
  const door = doorOf(settings);
  if (door === null) return [];
  const reasons: string[] = [];
  // vt's rules leave out the doors a vanilla drop key opens: with keys out
  // of their dungeons, the key model would count too few keys
  if (keyDropsShuffled(door) && keysWild) {
    reasons.push("shuffled key drops with keys outside their dungeons");
  }
  if (door.enemyShuffle !== "none") reasons.push("shuffled enemies");
  // DR refuses its static key logic with key drops or key pots shuffled
  // (static_logic_supported, StaticKeyLogic.py:80-84): no such seed is
  // rolled, so no reading of its logic holds
  if (door.keyLogic === "static" && keyDropsShuffled(door))
    reasons.push("DR's static key logic with shuffled key drops");
  if (door.owLayout !== "vanilla") {
    reasons.push(
      `the ${doorValueText("owLayout", door.owLayout)} overworld layout`,
    );
  }
  // An OWR run's crossed edges are linked as noted (`owrNotesOf`), Polar's
  // none without Mixed; DR itself crosses none
  if (door.owCrossed !== "none" && door.randomizer !== "owr")
    reasons.push("a crossed overworld");
  // An OWR run's flips are linked as noted (`owrNotesOf`); DR has none
  if (door.owMixed && door.randomizer !== "owr")
    reasons.push("a mixed overworld");
  // Shuffled whirlpools and moved flute spots: an OWR run's world links
  // them as noted (`owrNotesOf`); DR itself has neither
  if (door.randomizer !== "owr") {
    if (door.owWhirlpool) reasons.push("shuffled whirlpools");
    if (door.owFluteShuffle !== "vanilla") reasons.push("shuffled flute spots");
  }
  // A prize an item placed elsewhere, a follower's quest a location: the
  // fork's world reads neither (ItemList.py:786, :1740-1745); not known,
  // either may be (DR itself has neither)
  if (door.randomizer === "owr") {
    if (door.prizeShuffle === undefined) reasons.push(PRIZES_NOT_KNOWN);
    else if (door.prizeShuffle !== "none")
      reasons.push("shuffled dungeon prizes");
    if (door.shuffleFollowers === undefined) reasons.push(FOLLOWERS_NOT_KNOWN);
    else if (door.shuffleFollowers) reasons.push("shuffled followers");
    // Keys or items in a dungeon near their own: the fork's fill, which
    // its world does not read (args.json `keyshuffle` … "nearby")
    if (door.nearbyItems) reasons.push("dungeon items placed nearby");
    // A customizer goal replaces GT's entry, Ganon's, the pedestal's or
    // Murahdahla's rule (Rules.py:71-73, :93-95, :368-370, :536-538)
    if (door.customGoals === undefined) reasons.push(GOALS_NOT_KNOWN);
    else if (door.customGoals) reasons.push("the customizer's goals");
  }
  return reasons;
};

/** The cause `doorReasons` gives while an OWR run's prize shuffle is unset. */
export const PRIZES_NOT_KNOWN =
  "the prize shuffle not known yet (set it in Mode)";

/** The cause `doorReasons` gives while an OWR run's custom goals are unset. */
export const GOALS_NOT_KNOWN =
  "the custom goals not known yet (set them in Mode)";

/** The cause `doorReasons` gives while an OWR run's followers are unset. */
export const FOLLOWERS_NOT_KNOWN =
  "the follower shuffle not known yet (set it in Mode)";

/**
 * What a DR run's logic rests on, when the tracker models it: DR's own
 * world (doorLogic) and its key logic's reading (the notes its shuffled
 * entrances rest on are LogicNote's, as any run's). Any other DR run is not
 * modelled (`unmodelledReasons`): alttpr.com's v31 is no stand-in, asking
 * less than DR in places.
 */
export const doorNotes = (settings: DoorRunSettings): string[] => {
  const door = doorOf(settings);
  if (door === null) return [];
  return [
    door.randomizer === "owr"
      ? `Overworld Randomizer seed: the logic is the fork's own (${OVERWORLD_RANDOMIZER_VERSION}, on DR 1.5.7).`
      : `Door Randomizer seed: the logic is DR's own (${DOOR_RANDOMIZER_VERSION}).`,
    ...(door.doorShuffle === "vanilla"
      ? []
      : [
          "Its doors are shuffled: the logic follows the doors you note in the Doors tab, a door not noted leads nowhere, and a key door asks every key of its dungeon.",
        ]),
    ...(door.keyLogic === "dangerous"
      ? [
          "Its dangerous key logic: a key door is in logic once the keys of its worst case are found.",
        ]
      : []),
    ...(door.keyLogic === "static"
      ? [
          "Its static key logic: each key door asks the entrance randomizer's number of keys, those from chests.",
        ]
      : []),
  ];
};

/** Whether a run shuffles the Overworld Randomizer's bonk drops. */
export const bonkDropsOf = (settings: DoorRunSettings): boolean => {
  const door = doorOf(settings);
  return door?.randomizer === "owr" && door.bonkDrops;
};

/** What decides a DR run's locations, as the pack takes it. */
export const doorModesOf = (
  settings: DoorRunSettings & { bossShuffle?: string },
): DrModes | null => {
  const door = doorOf(settings);
  if (door === null) return null;
  return {
    ...(bonkDropsOf(settings) ? { bonkDrops: true } : {}),
    bossShuffle:
      settings.bossShuffle !== undefined && settings.bossShuffle !== "none",
    dropShuffle: door.dropShuffle,
    enemyShuffle: door.enemyShuffle !== "none",
    potShuffle: door.potShuffle,
    pottery: door.pottery,
    shopsanity: door.shopsanity,
    takeAny: door.takeAny,
  };
};

const NONE: DrLocationSet = {
  locations: [],
  partial: [],
  unflagged: new Set(),
};

const sets = new Map<string, DrLocationSet>();

/**
 * The Overworld Randomizer's bonk drops, once loaded (the pack's `./bonk`
 * entry, hooks/useBonkDrops.ts): only a run that shuffles them downloads
 * their data. Until then such a run lists none of them.
 */
let bonkDrops: readonly DrLocation[] | undefined;

/** Whether the bonk drops are loaded. */
export const bonkDropsLoaded = (): boolean => bonkDrops !== undefined;

/**
 * Takes up the bonk drops (useBonkDrops): every run's DR locations are
 * listed again, a bonk-shuffling one's with them.
 */
export const setBonkDrops = (drops: readonly DrLocation[]): void => {
  bonkDrops = drops;
  sets.clear();
};

/**
 * The bonk drops autotracking may read, once loaded: each but the cave's
 * statue, which no screen's byte flags.
 */
export const readableBonkDrops = (): readonly DrLocation[] =>
  (bonkDrops ?? []).filter(
    (drop) =>
      drop.flag.memory !== "overworld" || drop.flag.screen !== NO_SCREEN,
  );

/**
 * A run's DR locations (the pack's `drLocationsOf`), memoized per modes:
 * none for an alttpr.com run.
 */
export const doorLocationsOf = (
  settings: DoorRunSettings & { bossShuffle?: string },
): DrLocationSet => {
  const modes = doorModesOf(settings);
  if (modes === null) return NONE;
  const key = JSON.stringify(modes);
  let found = sets.get(key);
  if (found === undefined) {
    found = drLocationsOf(modes, bonkDrops);
    sets.set(key, found);
  }
  return found;
};

/**
 * Every DR location's id: the checks a save or a link may hold. The bonk
 * drops' come last, so a link made before them still reads.
 */
export const DOOR_LOCATION_IDS: ReadonlySet<string> = new Set([
  ...DR_LOCATIONS.map((location) => location.id),
  ...BONK_DROP_IDS,
]);

const DOOR_LOCATION: ReadonlyMap<string, DrLocation> = new Map(
  DR_LOCATIONS.map((location) => [location.id, location]),
);

/** A DR location by its id: a bonk drop's once they are loaded. */
export const doorLocationById = (id: string): DrLocation | undefined =>
  DOOR_LOCATION.get(id) ?? bonkDrops?.find((drop) => drop.id === id);

/**
 * What a dungeon's counter adds in a DR run: its DR locations, less the
 * keys they bring that stay in the dungeon (each real key drop gives its
 * dungeon the key it held, Regions.py:1188-1199), which are no items to the
 * player.
 */
export const doorCounterExtra = (
  dungeon: DungeonId,
  settings: DoorRunSettings & { bossShuffle?: string },
  wild: { readonly keys: boolean; readonly bigKeys: boolean },
): number => {
  const { locations } = doorLocationsOf(settings);
  const here = locations.filter((location) => location.dungeon === dungeon);
  if (here.length === 0) return 0;
  const added = drKeysAdded(locations, dungeon);
  return (
    here.length - (wild.keys ? 0 : added.small) - (wild.bigKeys ? 0 : added.big)
  );
};

/**
 * Whether a DR run's world counts a dungeon's small keys held by its
 * enemies or pots on its own: its vanilla key drops the run does not
 * shuffle, which DR's world gains once their place is reached (the pack's
 * `dropKey_` facts). The key cell then counts the keys from chests alone,
 * as DR's HUD does (DungeonCollectedKeys, the base patch's stats.asm:
 * 129-150), or a key marked would count twice.
 */
export const doorDropKeysCounted = (
  dungeon: DungeonId,
  settings: DoorRunSettings & { bossShuffle?: string },
): boolean => {
  if (!isDoorRun(settings)) return false;
  const shuffled = new Set(
    doorLocationsOf(settings).locations.map((location) => location.id),
  );
  return DR_LOCATIONS.some(
    (location) =>
      location.kind === "keyDrop" &&
      location.key === "small" &&
      location.dungeon === dungeon &&
      !shuffled.has(location.id),
  );
};

/** The small keys a dungeon's key drops add to its pool in a DR run. */
export const doorKeysExtra = (
  dungeon: DungeonId,
  settings: DoorRunSettings & { bossShuffle?: string },
): number => drKeysAdded(doorLocationsOf(settings).locations, dungeon).small;

/** Each list's tables, so a run's stay the same set until its list moves. */
const tables = new WeakMap<readonly DrLocation[], ReadonlySet<string>>();

/**
 * The Door Randomizer tables autotracking reads for a run: those its
 * locations lie in (the pack's `doorSwitches`), none outside DR.
 */
export const doorTablesOf = (
  settings: DoorRunSettings & { bossShuffle?: string },
): ReadonlySet<string> => {
  const { locations } = doorLocationsOf(settings);
  let found = tables.get(locations);
  if (found === undefined) {
    found = doorSwitches(locations);
    tables.set(locations, found);
  }
  return found;
};

/** A setting the seed states, or what the run holds. */
const stated = <T>(setting: SeedSetting<T> | undefined, own: T): T =>
  setting?.known ? setting.value : own;

/**
 * A DR run's settings with its defaults left out: what a run type, a save
 * and a link hold of them.
 */
export const withoutDefaults = (door: DoorSettings): DoorRunSettings => {
  const out: Record<string, unknown> = { randomizer: door.randomizer };
  for (const key of Object.keys(DOOR_OPTIONS) as DoorSetting[]) {
    const value = door[key];
    if (key === "randomizer" || value === undefined) continue;
    if (DOOR_DEFAULTS[key as keyof typeof DOOR_DEFAULTS] !== value) {
      out[key] = value;
    }
  }
  return out as DoorRunSettings;
};

/** The pottery modes that count pots beyond the caves (Rom.py:738-740). */
const POTS_BEYOND_CAVES: readonly PotteryMode[] = [
  "keys",
  "cavekeys",
  "dungeon",
  "reduced",
  "clustered",
  "nonempty",
  "lottery",
];

/** `value` when it is one of `of`, else `or`. */
const kept = <T extends string>(value: T, of: readonly T[], or: T): T =>
  of.includes(value) ? value : or;

/**
 * What a seed says of a run's Door Randomizer settings: none for an
 * alttpr.com seed; for a DR seed, the generator (from the title, which Race
 * Mode reads too) and each setting its ROM states (never in a race), the
 * run's own where it does not. Where the ROM tells a kind but not its mode
 * (doors shuffled, pots beyond the caves, take-any caves, a crossed
 * overworld, flute spots moved), the run's mode stands if it is of that
 * kind, else the commonest of it (What I read says the ROM named none).
 * @returns The DR settings to lay, defaults left out; null for a seed whose
 *   randomizer is not known (a header not read)
 */
export const doorFromSeed = (
  seed: SeedSettingsReading,
  run: DoorRunSettings,
): DoorRunSettings | null => {
  const randomizer = seed.randomizer;
  if (randomizer === undefined) return null;
  if (randomizer.kind === "vt") return {};
  // The version DR's ROM writes as text, else its title's digits, else a
  // spoiler's meta (doorMetaReading puts it in both)
  const version = doorVersionOf(
    seed.door?.version.known ? seed.door.version.value : randomizer.version,
  );
  const own: DoorSettings = {
    ...DOOR_DEFAULTS,
    ...run,
    ...(version === undefined ? {} : { doorVersion: version }),
    randomizer: randomizer.overworld ? "owr" : "dr",
  };
  // A spoiler's meta names each (an avianart permalink): taken as named,
  // where it is an option the tracker has
  const exact = seed.doorExact;
  if (exact !== undefined) {
    const option = <K extends DoorSetting>(key: K, value: unknown) =>
      (DOOR_OPTIONS[key] as readonly (readonly [unknown, string])[]).some(
        ([known]) => known === value,
      )
        ? (value as DoorSettings[K])
        : own[key];
    const ow = exact.overworld;
    return withoutDefaults({
      ...own,
      ...(exact.doorEntrances !== undefined &&
      option("doorEntrances", exact.doorEntrances) !== undefined &&
      (exact.doorEntrances !== "district" || own.randomizer === "owr")
        ? { doorEntrances: exact.doorEntrances as DoorEntrances }
        : {}),
      doorShuffle: exact.doorShuffle,
      dropShuffle: exact.dropShuffle,
      enemyShuffle: option("enemyShuffle", exact.enemyShuffle),
      keyLogic:
        exact.keyLogic === undefined
          ? own.keyLogic
          : option("keyLogic", exact.keyLogic),
      pottery: option("pottery", exact.pottery),
      shopsanity: exact.shopsanity,
      takeAny: option("takeAny", exact.takeAny),
      ...(exact.bombBag === undefined ? {} : { bombBag: exact.bombBag }),
      ...(exact.potShuffle === undefined
        ? {}
        : { potShuffle: exact.potShuffle }),
      ...(exact.restrictBossItems === undefined
        ? {}
        : {
            restrictBossItems: option(
              "restrictBossItems",
              exact.restrictBossItems,
            ),
          }),
      ...(exact.openPyramid === undefined
        ? {}
        : { openPyramid: option("openPyramid", exact.openPyramid) }),
      ...(exact.shuffleLinks === undefined
        ? {}
        : { shuffleLinks: exact.shuffleLinks }),
      ...(exact.shuffleTavern === undefined
        ? {}
        : { shuffleTavern: exact.shuffleTavern }),
      ...(exact.doorIntensity === undefined
        ? {}
        : {
            doorIntensity: option("doorIntensity", String(exact.doorIntensity)),
          }),
      ...(exact.decoupledDoors === undefined
        ? {}
        : { decoupledDoors: exact.decoupledDoors }),
      ...(ow === undefined
        ? {}
        : {
            bonkDrops: ow.bonkDrops,
            customGoals: ow.customGoals ?? own.customGoals,
            owCrossed: option("owCrossed", ow.crossed),
            owFluteShuffle: option("owFluteShuffle", ow.fluteShuffle),
            owLayout: option("owLayout", ow.layout),
            owMixed: ow.mixed,
            owWhirlpool: ow.whirlpool,
            prizeShuffle: option("prizeShuffle", ow.prizeShuffle),
            ...(ow.nearbyItems === undefined
              ? {}
              : { nearbyItems: ow.nearbyItems }),
            shuffleFollowers: ow.followers ?? own.shuffleFollowers,
          }),
    });
  }
  const rom = seed.door;
  if (rom === undefined) return withoutDefaults(own);
  const doors = stated(rom.doorShuffle, undefined);
  const pots = stated(rom.pottery, undefined);
  const takeAny = stated(rom.takeAny, undefined);
  const door: DoorSettings = {
    ...own,
    bombBag: stated(rom.bombBag, own.bombBag),
    doorShuffle:
      doors === undefined
        ? own.doorShuffle
        : doors === "shuffled"
          ? kept(own.doorShuffle, ["partitioned", "crossed"], "crossed")
          : doors,
    dropShuffle: stated(rom.dropShuffle, own.dropShuffle),
    pottery:
      pots === undefined
        ? own.pottery
        : pots === "beyond-caves"
          ? kept(own.pottery, POTS_BEYOND_CAVES, "keys")
          : pots,
    shopsanity: stated(rom.shopsanity, own.shopsanity),
    takeAny:
      takeAny === undefined
        ? own.takeAny
        : takeAny
          ? kept(own.takeAny, ["random", "fixed"], "random")
          : "none",
  };
  const ow = rom.overworld;
  if (ow !== undefined && door.randomizer === "owr") {
    const crossed = stated(ow.crossed, undefined);
    const flute = stated(ow.fluteShuffle, undefined);
    door.bonkDrops = stated(ow.bonkDrops, door.bonkDrops);
    door.owLayout = stated(ow.layout, door.owLayout);
    door.owMixed = stated(ow.mixed, door.owMixed);
    door.owWhirlpool = stated(ow.whirlpool, door.owWhirlpool);
    if (crossed !== undefined) {
      door.owCrossed = crossed
        ? kept(door.owCrossed, ["grouped", "unrestricted"], "unrestricted")
        : kept(door.owCrossed, ["polar"], "none");
    }
    if (flute !== undefined) {
      door.owFluteShuffle = flute
        ? kept(door.owFluteShuffle, ["balanced", "random"], "random")
        : "vanilla";
    }
    door.shuffleFollowers = stated(ow.followers, door.shuffleFollowers);
    door.nearbyItems = stated(ow.nearbyItems, door.nearbyItems);
    const prizes = stated(ow.prizeShuffle, undefined);
    // Kept inside the dungeons: none or dungeon, which the run's own tells
    // apart when it is one of them, else not known
    if (prizes !== undefined)
      door.prizeShuffle =
        prizes === "inside"
          ? door.prizeShuffle === "none" || door.prizeShuffle === "dungeon"
            ? door.prizeShuffle
            : undefined
          : prizes;
  }
  return withoutDefaults(door);
};

/**
 * The release a DR version names, as a run keeps it (`DoorVersion`): 1.5.6
 * for 1.5.6 or an older one, 1.5.8 for 1.5.8 or a newer one; undefined
 * when the seed tells none ("1.5.7-u", a ROM title's "1.5.7", a spoiler's
 * meta).
 */
export const doorVersionOf = (
  version: string | null | undefined,
): DoorVersion | undefined => {
  const parts = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? "");
  if (parts === null) return undefined;
  const [major, minor, patch] = parts.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const release = major * 10_000 + minor * 100 + patch;
  return release <= 10_506 ? "1.5.6" : release === 10_507 ? "1.5.7" : "1.5.8";
};

/** Whether two runs hold the same Door Randomizer settings. */
export const sameDoorSettings = (
  a: DoorRunSettings,
  b: DoorRunSettings,
): boolean => {
  const one = doorOf(a);
  const two = doorOf(b);
  if (one === null || two === null) return one === two;
  return (Object.keys(DOOR_OPTIONS) as DoorSetting[]).every(
    (key) => one[key] === two[key],
  );
};

/**
 * The Overworld Randomizer's whirlpools, by its name (default_whirlpool_
 * connections, OverworldShuffle.py:1764-1769): what an overworld note pairs.
 * Its spec holds the list to the pack's data.
 */
export const OWR_WHIRLPOOLS = [
  "C Whirlpool",
  "River Bend Whirlpool",
  "Lake Hylia Whirlpool",
  "Zora Whirlpool",
  "Kakariko Pond Whirlpool",
  "Octoballoon Whirlpool",
  "Qirn Jump Whirlpool",
  "Bomber Corner Whirlpool",
] as const;

/**
 * Each whirlpool's screen (default_whirlpool_connections' owid,
 * OverworldShuffle.py:1764-1769): its spec holds them to the pack's data.
 */
export const OWR_WHIRLPOOL_SCREENS: Readonly<
  Record<(typeof OWR_WHIRLPOOLS)[number], number>
> = {
  "Bomber Corner Whirlpool": 0x7f,
  "C Whirlpool": 0x33,
  "Kakariko Pond Whirlpool": 0x12,
  "Lake Hylia Whirlpool": 0x35,
  "Octoballoon Whirlpool": 0x3f,
  "Qirn Jump Whirlpool": 0x55,
  "River Bend Whirlpool": 0x15,
  "Zora Whirlpool": 0x0f,
};

/**
 * The whirlpools on dark world screens (whirlpool_map's 0x55 and 0x7f,
 * OverworldShuffle.py:370).
 */
export const OWR_DARK_WHIRLPOOLS: ReadonlySet<string> = new Set(
  OWR_WHIRLPOOLS.filter((name) => OWR_WHIRLPOOL_SCREENS[name] >= 0x40),
);

/**
 * The whirlpools a run's whirlpool may lead into. The fork shuffles them in
 * two pools, light world and dark (OverworldShuffle.py:378-391): an
 * overworld not crossed (nor Polar's, but with Mixed's flips) keeps each
 * whirlpool in its own world's, which an Inverted world flips whole. Mixed
 * flips screens one by one and the other crossed shuffles mix the pools,
 * so any of the others then.
 */
export const whirlpoolTargetsOf = (
  name: string,
  settings: DoorRunSettings,
): readonly string[] => {
  const door = doorOf(settings);
  const others = OWR_WHIRLPOOLS.filter((other) => other !== name);
  const apart =
    door !== null &&
    !door.owMixed &&
    (door.owCrossed === "none" || door.owCrossed === "polar");
  if (!apart) return others;
  const dark = OWR_DARK_WHIRLPOOLS.has(name);
  return others.filter((other) => OWR_DARK_WHIRLPOOLS.has(other) === dark);
};

/**
 * Whether Mixed flipped a screen, by its light world id, as the pack's
 * `owrScreensOf` reads the notes: a screen of a group that may flip as
 * its group's notes agree (undefined while none or they disagree), any
 * other never.
 */
const flippedOf = (
  settings: DoorRunSettings & { mode?: string },
  flips: OverworldNotes["flips"],
): ((screen: number) => boolean | undefined) => {
  const flipOf = new Map<number, boolean | undefined>();
  for (const { screens } of flipGroupsOf(settings)) {
    const noted = new Set(
      screens.flatMap((s) => {
        const flip = flips?.[String(s)];
        return flip === undefined ? [] : [flip];
      }),
    );
    const flip = noted.size === 1 ? [...noted][0] : undefined;
    for (const screen of screens) flipOf.set(screen, flip);
  }
  return (screen) => (flipOf.has(screen) ? flipOf.get(screen) : false);
};

/**
 * The whirlpool a run's whirlpool always leads into, where the fork's
 * shuffle leaves it no choice (the pack's `forcedWhirlpoolsOf`,
 * OverworldShuffle.py:370-413): Polar with Mixed links the dark world's
 * two outright (:376-378); an overworld neither crossed but Polar shuffles
 * each world's whirlpools apart, by the world their screens stand in once
 * Mixed flipped them (:380-391), so a pool of two pairs them: the dark
 * world's two without Mixed, with it once the noted flips tell every
 * whirlpool's world. Undefined otherwise.
 */
export const forcedWhirlpoolOf = (
  name: string,
  settings: DoorRunSettings & { mode?: string },
  flips?: OverworldNotes["flips"],
): string | undefined => {
  const door = doorOf(settings);
  if (door === null || !door.owWhirlpool) return undefined;
  if (door.owMixed && door.owCrossed === "polar")
    return OWR_DARK_WHIRLPOOLS.has(name)
      ? [...OWR_DARK_WHIRLPOOLS].find((other) => other !== name)
      : undefined;
  if (door.owCrossed !== "none" && door.owCrossed !== "polar") return undefined;
  const flipped = door.owMixed
    ? flippedOf(settings, flips)
    : () => false as const;
  const darkOf = (whirlpool: (typeof OWR_WHIRLPOOLS)[number]) => {
    const screen = OWR_WHIRLPOOL_SCREENS[whirlpool];
    const flip = flipped(screen % 0x40);
    return flip === undefined ? undefined : screen >= 0x40 !== flip;
  };
  const worlds = OWR_WHIRLPOOLS.map(darkOf);
  if (worlds.includes(undefined)) return undefined;
  const own = OWR_WHIRLPOOLS.indexOf(name as (typeof OWR_WHIRLPOOLS)[number]);
  if (own < 0) return undefined;
  const pool = OWR_WHIRLPOOLS.filter((_, i) => worlds[i] === worlds[own]);
  return pool.length === 2 ? pool.find((other) => other !== name) : undefined;
};

/**
 * The screens a flute spot may stand on (flute_data's light world ids,
 * FluteShuffle.py:683-726): what an overworld note lists. Its spec holds
 * the list to the pack's data.
 */
export const OWR_FLUTE_SCREENS: readonly number[] = [
  0x00, 0x02, 0x03, 0x05, 0x07, 0x0a, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15,
  0x16, 0x17, 0x18, 0x1a, 0x1b, 0x1d, 0x1e, 0x22, 0x25, 0x28, 0x29, 0x2a, 0x2b,
  0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x32, 0x33, 0x34, 0x35, 0x37, 0x3a, 0x3b, 0x3c,
  0x3f,
];

/**
 * The edge pairs a crossed overworld may cross (the pack's
 * `crossablePairsOf`: each vanilla pair of light world edges with dark
 * world twins), by the fork's edge names: what a crossing note names, by
 * its first edge. Its spec holds the list to the pack's data.
 */
export const OWR_CROSSINGS: readonly (readonly [string, string])[] = [
  ["Lost Woods SW", "Lost Woods Pass NW"],
  ["Lost Woods SC", "Lost Woods Pass NE"],
  ["Lost Woods SE", "Kakariko Fortune NE"],
  ["Lost Woods EN", "Lumberjack WN"],
  ["Lumberjack SW", "Mountain Pass NW"],
  ["Mountain Pass SE", "Kakariko Pond NE"],
  ["Lost Woods Pass SW", "Kakariko NW"],
  ["Lost Woods Pass SE", "Kakariko NC"],
  ["Kakariko Fortune SC", "Kakariko NE"],
  ["Kakariko Fortune EN", "Kakariko Pond WN"],
  ["Kakariko Fortune ES", "Kakariko Pond WS"],
  ["Kakariko Pond SW", "Forgotten Forest NW"],
  ["Kakariko Pond SE", "Forgotten Forest NE"],
  ["Kakariko Pond EN", "Sanctuary WN"],
  ["Kakariko Pond ES", "Sanctuary WS"],
  ["Sanctuary EC", "Graveyard WC"],
  ["Graveyard EC", "River Bend WC"],
  ["River Bend SW", "Wooden Bridge NW"],
  ["River Bend SC", "Wooden Bridge NC"],
  ["River Bend SE", "Wooden Bridge NE"],
  ["River Bend EN", "Potion Shop WN"],
  ["River Bend EC", "Potion Shop WC"],
  ["River Bend ES", "Potion Shop WS"],
  ["Potion Shop EN", "Zora Approach WN"],
  ["Potion Shop EC", "Zora Approach WC"],
  ["Zora Approach NE", "Zora Waterfall SE"],
  ["Kakariko SE", "Kakariko Suburb NE"],
  ["Kakariko ES", "Blacksmith WS"],
  ["Hyrule Castle SW", "Central Bonk Rocks NW"],
  ["Hyrule Castle SE", "Links House NE"],
  ["Hyrule Castle ES", "Sand Dunes WN"],
  ["Wooden Bridge SW", "Sand Dunes NW"],
  ["Sand Dunes SC", "Stone Bridge NC"],
  ["Eastern Palace SW", "Tree Line NW"],
  ["Eastern Palace SE", "Eastern Nook NE"],
  ["Maze Race ES", "Kakariko Suburb WS"],
  ["Kakariko Suburb ES", "Flute Boy WS"],
  ["Flute Boy SW", "Flute Boy Approach NW"],
  ["Flute Boy SC", "Flute Boy Approach NC"],
  ["Flute Boy Approach EC", "C Whirlpool WC"],
  ["C Whirlpool NW", "Central Bonk Rocks SW"],
  ["C Whirlpool SC", "Dam NC"],
  ["C Whirlpool EN", "Statues WN"],
  ["C Whirlpool EC", "Statues WC"],
  ["C Whirlpool ES", "Statues WS"],
  ["Central Bonk Rocks EN", "Links House WN"],
  ["Central Bonk Rocks EC", "Links House WC"],
  ["Central Bonk Rocks ES", "Links House WS"],
  ["Links House SC", "Statues NC"],
  ["Links House ES", "Stone Bridge WS"],
  ["Stone Bridge SC", "Lake Hylia NW"],
  ["Stone Bridge EN", "Tree Line WN"],
  ["Stone Bridge EC", "Tree Line WC"],
  ["Tree Line SC", "Lake Hylia NC"],
  ["Tree Line SE", "Lake Hylia NE"],
  ["Desert Pass EC", "Dam WC"],
  ["Desert Pass ES", "Dam WS"],
  ["Dam EC", "South Pass WC"],
  ["Statues SC", "South Pass NC"],
  ["South Pass ES", "Lake Hylia WS"],
  ["Lake Hylia EC", "Octoballoon WC"],
  ["Lake Hylia ES", "Octoballoon WS"],
  ["Octoballoon NW", "Ice Cave SW"],
  ["Octoballoon NE", "Ice Cave SE"],
  ["West Death Mountain EN", "East Death Mountain WN"],
  ["West Death Mountain ES", "East Death Mountain WS"],
  ["East Death Mountain EN", "Death Mountain TR Pegs WN"],
];

/**
 * Whether an OWR run's overworld crosses edges between the worlds the
 * player notes: grouped or unrestricted (OverworldShuffle.py:246-345).
 * Polar crosses nothing without Mixed (:246-278, only Mixed's own swaps),
 * so it reads as none.
 */
const crossesEdges = (door: DoorSettings): boolean =>
  door.owCrossed === "grouped" || door.owCrossed === "unrestricted";

/**
 * Which of an OWR run's overworld shuffles the player notes (its whirlpools
 * shuffled, its flute spots moved, its edges crossed), or undefined when it
 * has none or is no OWR run: what the Overworld tab offers.
 */
export const overworldShufflesOf = (
  settings: DoorRunSettings,
):
  | {
      readonly whirlpools: boolean;
      readonly flute: boolean;
      readonly crossings: boolean;
      readonly flips: boolean;
    }
  | undefined => {
  const door = doorOf(settings);
  if (door?.randomizer !== "owr") return undefined;
  const whirlpools = door.owWhirlpool;
  const flute = door.owFluteShuffle !== "vanilla";
  const crossings = crossesEdges(door);
  const flips = door.owMixed;
  return whirlpools || flute || crossings || flips
    ? { crossings, flips, flute, whirlpools }
    : undefined;
};

/**
 * The groups of screens an OWR run's Mixed flips together (the pack's
 * `owrFlipGroups`, define_tile_groups): those that may flip, by the run's
 * world, crossed overworld, whirlpools and entrance shuffle (vanilla, or
 * District and Swapped, the ones the fork's world holds). Empty outside a
 * Mixed OWR run.
 */
export const flipGroupsOf = (
  settings: DoorRunSettings & { mode?: string },
): readonly OwrFlipGroup[] => {
  const door = doorOf(settings);
  if (door?.randomizer !== "owr" || !door.owMixed) return [];
  return owrFlipGroups({
    crossed: door.owCrossed !== "none",
    mode:
      settings.mode === "inverted"
        ? "inverted"
        : settings.mode === "standard"
          ? "standard"
          : "open",
    shuffle: doorShuffleOf(settings) ?? "vanilla",
    whirlpools: door.owWhirlpool,
  }).filter((group) => group.canFlip);
};

/** Each notes object's reading per shuffle, so a world is built once. */
const owrNotes = new WeakMap<OverworldNotes, Map<string, OwrNotes>>();

/**
 * What the fork's world reads of a run's overworld notes (the pack's
 * `OwrNotes`): for a shuffle the run's settings name, what is noted (none
 * yet: nothing noted leads anywhere); nothing for a shuffle off, which the
 * world links as vanilla. Undefined outside an OWR run. The same object
 * for the same notes and shuffles.
 */
export const owrNotesOf = (
  settings: DoorRunSettings,
  notes: OverworldNotes,
): OwrNotes | undefined => {
  const door = doorOf(settings);
  if (door?.randomizer !== "owr") return undefined;
  const whirlpools = door.owWhirlpool;
  const flute = door.owFluteShuffle !== "vanilla";
  const crossings = crossesEdges(door);
  const flips = door.owMixed;
  const polar = door.owCrossed === "polar";
  const key = `${whirlpools}/${flute}/${crossings}/${flips}/${polar}`;
  let byKey = owrNotes.get(notes);
  if (byKey === undefined) {
    byKey = new Map();
    owrNotes.set(notes, byKey);
  }
  let found = byKey.get(key);
  if (found === undefined) {
    found = {
      ...(whirlpools ? { whirlpools: notes.whirlpools ?? {} } : {}),
      ...(flute ? { flute: notes.flute ?? [] } : {}),
      ...(crossings ? { crossings: notes.crossings ?? {} } : {}),
      ...(flips ? { flips: notes.flips ?? {} } : {}),
      ...(polar && flips ? { polar } : {}),
    };
    byKey.set(key, found);
  }
  return found;
};

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
  DOOR_RANDOMIZER_VERSION,
  DR_LOCATIONS,
  type DrLocationSet,
  type DrModes,
  type DropShuffle,
  type DrPoolSettings,
  type DrShuffle,
  type DungeonId,
  doorSwitches,
  drKeysAdded,
  drLocationsOf,
  type PotteryMode,
  type SeedSetting,
  type SeedSettingsReading,
  type TakeAny,
} from "@alltp/pack-alttpr";

/** Which of DR's generators wrote the seed: DR itself, or its Overworld fork. */
export type Randomizer = "dr" | "owr";

/** DR's door shuffle (`--doorShuffle`). */
export type DoorShuffle = "vanilla" | "basic" | "partitioned" | "crossed";

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
   * The settings DR's rules read that no ROM table states: the bomb bag
   * (`--bombbag`: bombs need the +10 upgrade, can_use_bombs,
   * BaseClasses.py:1208-1209), the legacy pot shuffle (`--shufflepots`:
   * Mire's spikes' key pot may move onto the spikes, Rules.py:530-533), the
   * boss items and the pyramid hole. A spoiler's meta names them; a run
   * read from its ROM alone holds DR's defaults until the player sets them.
   */
  bombBag?: boolean;
  potShuffle?: boolean;
  restrictBossItems?: RestrictBossItems;
  openPyramid?: OpenPyramid;
  /**
   * Whether the entrance shuffle moves Link's House (`--shufflelinks`,
   * EntranceShuffle2.py:555) and the Tavern's back door (`--shuffletavern`,
   * :211): a spoiler's meta names them, no ROM table does.
   */
  shuffleLinks?: boolean;
  shuffleTavern?: boolean;
};

/** A DR setting's key. */
export type DoorSetting = keyof DoorRunSettings;

/** What a DR run's settings are, every default filled in. */
export type DoorSettings = Required<Omit<DoorRunSettings, "doorEntrances">> & {
  doorEntrances?: DoorEntrances;
};

/** DR's defaults (args.json): what an absent field of a DR run means. */
export const DOOR_DEFAULTS: Omit<DoorSettings, "randomizer"> = {
  bombBag: false,
  bonkDrops: false,
  doorShuffle: "vanilla",
  doorVersion: "1.5.6",
  dropShuffle: "none",
  enemyShuffle: "none",
  keyLogic: "partial",
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
  shuffleLinks: false,
  shuffleTavern: false,
  takeAny: "none",
};

/** Whether a run is a Door Randomizer seed's. */
export const isDoorRun = (settings: DoorRunSettings): boolean =>
  settings.randomizer !== undefined;

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
  doorEntrances: [
    ["lite", "Lite"],
    ["lean", "Lean"],
    ["swapped", "Swapped"],
    ["district", "District"],
    ["dungeonssimple", "Dungeons Simple"],
    ["dungeonsfull", "Dungeons Full"],
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
  doorEntrances: "DR entrances",
  doorShuffle: "Door shuffle",
  doorVersion: "DR version",
  dropShuffle: "Enemy drops",
  enemyShuffle: "Enemies",
  keyLogic: "Key logic",
  openPyramid: "Pyramid hole",
  owCrossed: "Crossed overworld",
  owFluteShuffle: "Flute spots",
  owLayout: "Overworld layout",
  owMixed: "Mixed overworld",
  owWhirlpool: "Whirlpools",
  potShuffle: "Pot shuffle",
  pottery: "Pottery",
  randomizer: "Randomizer",
  restrictBossItems: "Boss items",
  shopsanity: "Shopsanity",
  shuffleLinks: "Link's House",
  shuffleTavern: "Tavern's back door",
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
  return settings.randomizer === "owr"
    ? [...DR_ROWS, ...entrances, ...OWR_ROWS]
    : [...DR_ROWS, ...entrances];
};

/** alttpr.com's entrance shuffles DR has too, by the same name. */
const DR_SHUFFLES: readonly string[] = [
  "simple",
  "restricted",
  "full",
  "crossed",
  "insanity",
];

/**
 * A DR run's entrance shuffle as the pack's DR pools name it: its own
 * (`doorEntrances`) or alttpr.com's of the same name; undefined for vanilla
 * entrances, an alttpr.com run and OWR's District, whose overworld is its
 * own.
 */
export const doorShuffleOf = (
  settings: DoorRunSettings & { entranceShuffle?: string },
): DrShuffle | undefined => {
  if (settings.randomizer === undefined) return undefined;
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
    shuffleLinks: door.shuffleLinks,
    shuffleTavern: door.shuffleTavern,
  };
};

/** A DR setting's value in words. */
export const doorValueText = <K extends DoorSetting>(
  setting: K,
  value: DoorRunSettings[K],
): string =>
  (DOOR_OPTIONS[setting] as readonly (readonly [unknown, string])[]).find(
    ([option]) => option === value,
  )?.[1] ?? String(value);

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
  if (door.doorShuffle !== "vanilla") {
    reasons.push(
      `${doorValueText("doorShuffle", door.doorShuffle)} door shuffle`,
    );
  }
  // OWR's District moves its own overworld's entrances
  if (door.doorEntrances === "district") {
    reasons.push(
      `the Door Randomizer's ${doorValueText("doorEntrances", door.doorEntrances)} entrance shuffle`,
    );
  }
  // vt's rules leave out the doors a vanilla drop key opens: with keys out
  // of their dungeons, the key model would count too few keys
  if (keyDropsShuffled(door) && keysWild) {
    reasons.push("shuffled key drops with keys outside their dungeons");
  }
  if (door.enemyShuffle !== "none") reasons.push("shuffled enemies");
  // Bombs then need the bag, the +10 upgrade (can_use_bombs, BaseClasses.py:
  // 1208-1209), which no cell records: the bomb count starts at 10
  if (door.bombBag) reasons.push("the bomb bag");
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
  if (door.owCrossed !== "none") reasons.push("a crossed overworld");
  if (door.owMixed) reasons.push("a mixed overworld");
  if (door.owWhirlpool) reasons.push("shuffled whirlpools");
  if (door.owFluteShuffle !== "vanilla") reasons.push("shuffled flute spots");
  return reasons;
};

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
    `Door Randomizer seed: the logic is DR's own (${DOOR_RANDOMIZER_VERSION}).`,
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

/** What decides a DR run's locations, as the pack takes it. */
export const doorModesOf = (
  settings: DoorRunSettings & { bossShuffle?: string },
): DrModes | null => {
  const door = doorOf(settings);
  if (door === null) return null;
  return {
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
    found = drLocationsOf(modes);
    sets.set(key, found);
  }
  return found;
};

/** Every DR location's id: the checks a save or a link may hold. */
export const DOOR_LOCATION_IDS: ReadonlySet<string> = new Set(
  DR_LOCATIONS.map((location) => location.id),
);

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

/**
 * The Door Randomizer tables autotracking reads for a run: those its
 * locations lie in (the pack's `doorSwitches`), none outside DR.
 */
export const doorTablesOf = (
  settings: DoorRunSettings & { bossShuffle?: string },
): ReadonlySet<string> => doorSwitches(doorLocationsOf(settings).locations);

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
      ...(ow === undefined
        ? {}
        : {
            bonkDrops: ow.bonkDrops,
            owCrossed: option("owCrossed", ow.crossed),
            owFluteShuffle: option("owFluteShuffle", ow.fluteShuffle),
            owLayout: option("owLayout", ow.layout),
            owMixed: ow.mixed,
            owWhirlpool: ow.whirlpool,
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

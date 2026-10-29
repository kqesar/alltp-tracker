// The settings of one run: every value of the upstream world's config that a
// rule reads, as the flat flags and numbers the engine folds at compile time
// (`setting(swordless)`, `!setting(basicPlacement)`,
// `lamp >= setting(requireLamp)`).
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31):
// - app/World.php: config() (445-461), which falls back to the call's own
//   default, and the values the constructor derives from the options
//   (dungeonItems 111-129, the item pool's overflow counts 171-214, the item
//   functionality's ROM values 216-259, requireBetterBow and Sword 261-273,
//   forceSkullWoodsKey 275-277); factory() sets mode.state (288-292);
// - config/logic.php: the glitch flags each logic turns on, none for
//   NoGlitches (line 4);
// - app/Randomizer.php: the Pegasus Boots a glitched or No Logic world
//   starts with (122-131);
// - config/alttp.php: the site's presets (randomizer.item.presets, 57-173).
//
// A Mystery seed hides its settings, which the player learns as the run goes:
// the values a player discovers may be UNKNOWN in the config, and every
// setting derived from one is then unknown to the engine, which folds it to
// maybe (a flag either way, a number in its range).
//
// Left out: the triforce-hunt and ganonhunt goals (triforce pieces are not
// items of this pack).

/** A config value the player has not discovered yet. */
export const UNKNOWN = { unknown: true } as const;

/** A flag a rule reads, or one not known yet (the engine folds it to maybe). */
export type Flag = boolean | typeof UNKNOWN;

/** A number a rule reads, or the range of one not known yet. */
export type Count = number | { readonly between: readonly [number, number] };

/**
 * Every setting a rule of the pack reads. Each field says the upstream
 * config value it stands for and a place a rule reads it. A type, not an
 * interface, so it is the engine's `Settings` as it is. Those a player
 * discovers in a Mystery run may be unknown (`Flag`, `Count`).
 */
export type AlttprSettings = {
  /**
   * mode.state is 'standard' (World.php:290): the run starts with the
   * escape, and RescueZelda is not given at the start (Randomizer.php:133).
   * Otherwise 'open', the retro world included (app/World/Retro.php
   * extends Open). Inverted is a world of its own.
   */
  readonly standardMode: boolean;
  /**
   * mode.state is 'inverted' (World.php:297-298): the world of
   * app/World/Inverted.php, its own region classes. Like Open, it gives
   * RescueZelda at the start (Randomizer.php:133).
   */
  readonly invertedMode: boolean;
  /**
   * mode.weapons is 'swordless' (ItemCollection.php:405). 'randomized',
   * 'assured' and 'vanilla' only place the swords differently.
   */
  readonly swordless: Flag;
  /** itemPlacement is 'basic' (Boss.php:89). */
  readonly basicPlacement: Flag;
  /**
   * itemPlacement is 'advanced' (EasternPalace.php:87). The upstream tests
   * leave itemPlacement unset, so both flags are false there.
   */
  readonly advancedPlacement: Flag;
  /**
   * region.requireBetterBow: Ganon needs silvers, with basic placement or
   * swordless (World.php:261-273; DarkWorld/NorthEast.php:227).
   */
  readonly requireBetterBow: Flag;
  /**
   * region.requireBetterSword, with basic placement (World.php:262-267;
   * DarkWorld/NorthEast.php:232).
   */
  readonly requireBetterSword: Flag;
  /**
   * region.forceSkullWoodsKey, with basic placement (World.php:275-277); a
   * fill rule reads it (SkullWoods.php:107).
   */
  readonly forceSkullWoodsKey: Flag;
  /**
   * enemizer.bossShuffle is not 'none' (Randomizer.php:396-447): a
   * dungeon's boss may be another's (bosses.ts). 'simple', 'full' and
   * 'random' let each slot hold the same bosses, so one flag says it.
   */
  readonly bossShuffle: Flag;
  /**
   * enemizer.bossShuffle is 'simple' (Randomizer.php:418-431): one boss a
   * slot from a fixed set, so a boss known in one slot is one fewer for the
   * others (bossFacts).
   */
  readonly simpleBossShuffle: Flag;

  /** goal is 'ganon', the default (World.php:67; DarkWorld/NorthEast.php:213). */
  readonly ganonGoal: Flag;
  /** goal is 'fast_ganon' (DarkWorld/NorthEast.php:213, 226). */
  readonly fastGanonGoal: Flag;
  /** goal is 'dungeons' (DarkWorld/NorthEast.php:195). */
  readonly dungeonsGoal: Flag;
  /** goal is 'pedestal': no rule reads it, the tracker's go mode will. */
  readonly pedestalGoal: Flag;
  /** goal is 'completionist': no rule reads it, the tracker's go mode will. */
  readonly completionistGoal: Flag;
  /** crystals.tower, 7 by default (GanonsTower.php:407). */
  readonly crystalsTower: Count;
  /** crystals.ganon, 7 by default (DarkWorld/NorthEast.php:220). */
  readonly crystalsGanon: Count;

  /**
   * item.require.Lamp: the lamps a dark room needs, 1 by default
   * (EasternPalace.php:77), 0 when the customizer drops the rule
   * (CustomizerController.php:156). `lamp >= setting(requireLamp)`.
   */
  readonly requireLamp: number;

  /**
   * region.wildKeys: small keys leave their dungeon (keysanity), set by
   * dungeonItems 'mcs' and 'full' (World.php:117-121; Region.php:235), and
   * by the retro world (World/Retro.php:22).
   */
  readonly wildKeys: boolean;
  /**
   * rom.rupeeBow, the retro world's (World/Retro.php:19): the bow shoots
   * rupees, once an arrow is bought in a shop (`shopArrow`) or with the
   * silver arrows (ItemCollection.php:476-492).
   */
  readonly rupeeBow: boolean;
  /**
   * rom.genericKeys, the retro world's (World/Retro.php:20): a small key
   * opens any dungeon's doors, and once one can be bought (`shopKey`) every
   * small key a rule asks for is held (ItemCollection.php:269-272; the
   * derived facts, derived.ts).
   */
  readonly genericKeys: boolean;
  /** region.wildBigKeys, set by dungeonItems 'full' (World.php:112-116). */
  readonly wildBigKeys: boolean;
  /**
   * region.wildMaps, set by dungeonItems 'mc' and up (World.php:122-128):
   * a boss then needs its dungeon's map (EasternPalace.php:91).
   */
  readonly wildMaps: boolean;
  /** region.wildCompasses, like wildMaps (EasternPalace.php:90). */
  readonly wildCompasses: boolean;
  /**
   * region.bossNormalLocation, true by default: a boss may drop a dungeon
   * item (fill rules, EasternPalace.php:94, 103).
   */
  readonly bossNormalLocation: boolean;

  /**
   * accessibility is 'locations' (fill rules, PalaceOfDarkness.php:92).
   * 'items' and 'none', and the upstream tests' unset value, read the same.
   */
  readonly locationsAccessibility: Flag;
  /** region.cantTakeDamage, false by default (IcePalace.php:75). */
  readonly cantTakeDamage: boolean;
  /**
   * region.swordsInPool, true by default: the Pyramid Fairy's two chests
   * exist only then (DarkWorld/NorthEast.php:39).
   */
  readonly swordsInPool: boolean;
  /**
   * item.overflow.count.Shield >= 3 (TurtleRock.php:197): the pool holds a
   * third shield, the mirror shield. It is 3 unless the item pool lowers it
   * (World.php:171-214).
   */
  readonly mirrorShieldInPool: Flag;
  /**
   * enemizer.enemyHealth is 'default', as without the enemizer
   * (ItemCollection.php:567, 589).
   */
  readonly defaultEnemyHealth: boolean;
  /** ignoreCanKillEscapeThings, false by default (ItemCollection.php:573). */
  readonly ignoreCanKillEscapeThings: boolean;
  /**
   * rom.BottleFill.Magic, what a bottle of magic refills, which
   * canExtendMagic multiplies a bottle's magic by (ItemCollection.php:517-
   * 524): all of it by default (0x80), half with hard item functionality
   * (0x40), a quarter with expert (0x20), none with superexpert
   * (World.php:216-259). One flag per fraction; none set is no refill.
   */
  readonly fullBottleMagic: Flag;
  readonly halfBottleMagic: Flag;
  readonly quarterBottleMagic: Flag;
  /**
   * rom.CatchableFairies, true by default; hard, expert and superexpert
   * item functionality turn it off (World.php:216-259; ItemCollection.php:
   * 446).
   */
  readonly catchableFairies: Flag;

  // The glitch flags of config/logic.php (`LOGIC_FLAGS`), and two the
  // region rules read that no logic sets. A rule writes the branch upstream
  // gates on one as `setting(canBootsClip) & ...`, which folds away while
  // the flag is off. The tricks that tricks.ts reads as items may be
  // compiled on, as its tests do.
  readonly canBootsClip: boolean;
  readonly canBunnyRevive: boolean;
  readonly canBunnySurf: boolean;
  readonly canDungeonRevive: boolean;
  readonly canFakeFlipper: boolean;
  readonly canMirrorClip: boolean;
  readonly canMirrorWrap: boolean;
  readonly canOneFrameClipOW: boolean;
  readonly canOneFrameClipUW: boolean;
  readonly canOWYBA: boolean;
  readonly canSuperBunny: boolean;
  readonly canSuperSpeed: boolean;
  readonly canTransitionWrapped: boolean;
  readonly canWaterWalk: boolean;

  /**
   * The world starts with the Pegasus Boots: a glitched logic's or No
   * Logic's, unless the customizer built it (Randomizer.php:122-131).
   * toState adds them to what the player found.
   */
  readonly bootsAtStart: boolean;
  /**
   * The seed has No Logic (`noLogicSettings`): upstream sets no region's
   * rules (World.php:93), so a location's fill rules do not hold either,
   * and the sewers key may leave the escape (Region.php:238). Its dungeon
   * items stay in their dungeons, anywhere in them: the key model then
   * vouches for a key only once every place it may sit is reached
   * (keys.ts). The rules the pack reads it with are a logic's, the
   * glitches the player plays it with.
   */
  readonly noLogic: boolean;
};

/** The glitch flags of config/logic.php. */
export type GlitchFlag =
  | "canBootsClip"
  | "canBunnyRevive"
  | "canBunnySurf"
  | "canDungeonRevive"
  | "canFakeFlipper"
  | "canMirrorClip"
  | "canMirrorWrap"
  | "canOneFrameClipOW"
  | "canOneFrameClipUW"
  | "canOWYBA"
  | "canSuperBunny"
  | "canSuperSpeed"
  | "canTransitionWrapped"
  | "canWaterWalk";

/**
 * The logics a seed is generated for (config/logic.php), whose rules the
 * pack reads. No Logic has none: `noLogicSettings` reads such a seed with
 * one of these.
 */
export const LOGICS = [
  "NoGlitches",
  "OverworldGlitches",
  "HybridMajorGlitches",
  "MajorGlitches",
] as const;

export type Logic = (typeof LOGICS)[number];

/** Overworld Glitches' flags (logic.php:5-13). */
const OVERWORLD_GLITCHES: readonly GlitchFlag[] = [
  "canSuperBunny",
  "canFakeFlipper",
  "canSuperSpeed",
  "canBootsClip",
  "canMirrorClip",
  "canWaterWalk",
  "canDungeonRevive",
];

/**
 * The glitch flags each logic turns on (config/logic.php). A logic's
 * flags are listed here once its port holds to upstream's tests (Hybrid
 * Major Glitches has none: its laws hold it, the README's "Glitched logics
 * and No Logic"): until then it reads as NoGlitches, and the app does not
 * model it.
 */
export const LOGIC_FLAGS: Readonly<Record<Logic, readonly GlitchFlag[]>> = {
  // logic.php:14-23: Overworld Glitches' and one-frame clips underworld
  HybridMajorGlitches: [...OVERWORLD_GLITCHES, "canOneFrameClipUW"],
  MajorGlitches: [],
  NoGlitches: [],
  OverworldGlitches: OVERWORLD_GLITCHES,
};

/** The worlds this pack builds: `World::factory`'s type. */
export type Mode = "open" | "standard" | "inverted";

const GOALS = [
  "completionist",
  "dungeons",
  "fast_ganon",
  "ganon",
  "pedestal",
] as const;

/** The item pools (config/alttp.php's item_pool, World.php:171-214). */
const POOLS = [
  "crowd_control",
  "expert",
  "hard",
  "normal",
  "superexpert",
] as const;

/** The boss shuffles (config/alttp.php:241-246, Randomizer.php:396-447). */
export const BOSS_SHUFFLES = ["none", "simple", "full", "random"] as const;

/** The item functionalities (World.php:216-259). */
const FUNCTIONALITIES = ["expert", "hard", "normal", "superexpert"] as const;

/**
 * The shields an item pool puts in, its `item.overflow.count.Shield`
 * (World.php:171-214): the normal pool keeps all three.
 */
const POOL_SHIELDS: Readonly<Record<(typeof POOLS)[number], number>> = {
  crowd_control: 0,
  expert: 1,
  hard: 2,
  normal: 3,
  superexpert: 0,
};

/** A bottle's magic refill, rom.BottleFill.Magic, per item functionality. */
const BOTTLE_MAGIC: Readonly<Record<(typeof FUNCTIONALITIES)[number], number>> =
  { expert: 0x20, hard: 0x40, normal: 0x80, superexpert: 0x00 };

/** A config value, or UNKNOWN where a player may not know it yet. */
type Discovered<T> = T | typeof UNKNOWN;

/**
 * A world's config, under upstream's own keys (`World::factory`'s second
 * argument). Every key is optional and takes the default the rules read it
 * with. `settingsFromUpstream` checks the values too, so a fixture's raw
 * config can be passed as it is. What a Mystery run lets the player
 * discover may be UNKNOWN.
 */
export type UpstreamConfig = {
  readonly accessibility?: Discovered<"items" | "locations" | "none">;
  /** Read by no rule (the tests set 'test_rules'). */
  readonly difficulty?: string;
  readonly dungeonItems?: "full" | "mc" | "mcs" | "standard";
  readonly "crystals.ganon"?: Discovered<number>;
  readonly "crystals.tower"?: Discovered<number>;
  readonly "enemizer.bossShuffle"?: Discovered<(typeof BOSS_SHUFFLES)[number]>;
  readonly "enemizer.enemyHealth"?: string;
  readonly goal?: Discovered<(typeof GOALS)[number]>;
  readonly ignoreCanKillEscapeThings?: boolean;
  readonly "item.functionality"?: Discovered<(typeof FUNCTIONALITIES)[number]>;
  readonly "item.overflow.count.Shield"?: number;
  readonly "item.pool"?: Discovered<(typeof POOLS)[number]>;
  readonly "item.require.Lamp"?: number;
  readonly itemPlacement?: Discovered<"advanced" | "basic">;
  readonly logic?: Logic;
  readonly "mode.weapons"?: Discovered<
    "assured" | "randomized" | "swordless" | "vanilla"
  >;
  readonly "region.bossNormalLocation"?: boolean;
  readonly "region.cantTakeDamage"?: boolean;
  readonly "region.swordsInPool"?: boolean;
  readonly "region.wildBigKeys"?: boolean;
  readonly "region.wildCompasses"?: boolean;
  readonly "region.wildKeys"?: boolean;
  readonly "rom.genericKeys"?: boolean;
  readonly "rom.rupeeBow"?: boolean;
  readonly "region.wildMaps"?: boolean;
  readonly "rom.CatchableFairies"?: boolean;
};

type Check = (value: unknown) => boolean;

const isBoolean: Check = (value) => typeof value === "boolean";
const isCount: Check = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isString: Check = (value) => typeof value === "string";
const oneOf =
  (...values: readonly string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);

const isUnknown = (value: unknown): value is typeof UNKNOWN =>
  typeof value === "object" &&
  value !== null &&
  (value as { unknown?: unknown }).unknown === true;

/** A check that also takes UNKNOWN: a value a player discovers. */
const orUnknown =
  (check: Check): Check =>
  (value) =>
    isUnknown(value) || check(value);

const isCrystals: Check = (value) => isCount(value) && (value as number) <= 7;

/** What each key accepts. A key missing here is one the pack does not model. */
const KEYS: Readonly<Record<keyof UpstreamConfig, Check>> = {
  accessibility: orUnknown(oneOf("items", "locations", "none")),
  "crystals.ganon": orUnknown(isCrystals),
  "crystals.tower": orUnknown(isCrystals),
  difficulty: isString,
  dungeonItems: oneOf("full", "mc", "mcs", "standard"),
  "enemizer.bossShuffle": orUnknown(oneOf(...BOSS_SHUFFLES)),
  "enemizer.enemyHealth": isString,
  goal: orUnknown(oneOf(...GOALS)),
  ignoreCanKillEscapeThings: isBoolean,
  "item.functionality": orUnknown(oneOf(...FUNCTIONALITIES)),
  "item.overflow.count.Shield": isCount,
  "item.pool": orUnknown(oneOf(...POOLS)),
  "item.require.Lamp": isCount,
  itemPlacement: orUnknown(oneOf("advanced", "basic")),
  logic: oneOf(...LOGICS),
  "mode.weapons": orUnknown(
    oneOf("assured", "randomized", "swordless", "vanilla"),
  ),
  "region.bossNormalLocation": isBoolean,
  "region.cantTakeDamage": isBoolean,
  "region.swordsInPool": isBoolean,
  "region.wildBigKeys": isBoolean,
  "region.wildCompasses": isBoolean,
  "region.wildKeys": isBoolean,
  "region.wildMaps": isBoolean,
  "rom.CatchableFairies": isBoolean,
  "rom.genericKeys": isBoolean,
  "rom.rupeeBow": isBoolean,
};

function checked(
  config: Readonly<Record<string, unknown>>,
): Readonly<UpstreamConfig> {
  for (const [key, value] of Object.entries(config)) {
    const check = KEYS[key as keyof UpstreamConfig];
    if (check === undefined) {
      throw new RangeError(`Upstream config "${key}" is not modeled`);
    }
    if (!check(value)) {
      throw new RangeError(
        `Upstream config "${key}" cannot be ${JSON.stringify(value)}`,
      );
    }
  }
  return config as UpstreamConfig;
}

/** Whether a config value is `x`: unknown while the value is. */
const is = (value: unknown, x: unknown): Flag =>
  isUnknown(value) ? UNKNOWN : value === x;

/** Kleene's or: true if any is, false if all are, else unknown. */
const any = (...flags: readonly Flag[]): Flag => {
  if (flags.includes(true)) return true;
  return flags.some(isUnknown) ? UNKNOWN : false;
};

/** Kleene's and: false if any is, true if all are, else unknown. */
const all = (...flags: readonly Flag[]): Flag => {
  if (flags.includes(false)) return false;
  return flags.some(isUnknown) ? UNKNOWN : true;
};

/** A crystal count, its range 0 to 7 while not known. */
const crystalsOf = (value: number | typeof UNKNOWN | undefined): Count =>
  isUnknown(value) ? { between: [0, 7] } : (value ?? 7);

/**
 * The settings of a world `World::factory(mode, config)` builds, as its
 * constructor derives them: dungeonItems turns the wild flags on, basic
 * placement and swordless ask for better bows and swords, the logic turns
 * its glitch flags on and starts Link with the boots. Throws a RangeError
 * for a mode, key or value the pack does not model, such as No Logic
 * (`noLogicSettings` reads it).
 */
export function settingsFromUpstream(
  mode: string,
  config: Readonly<Record<string, unknown>> = {},
): AlttprSettings {
  if (
    mode !== "open" &&
    mode !== "standard" &&
    mode !== "inverted" &&
    mode !== "retro"
  ) {
    throw new RangeError(`Upstream mode "${mode}" is not modeled`);
  }
  // The retro world forces these over any value the config gave
  // (World/Retro.php:18-23)
  const retro = mode === "retro";
  const c = checked(config);
  const goal = c.goal ?? "ganon";
  const dungeonItems = c.dungeonItems ?? "standard";
  const basic = is(c.itemPlacement, "basic");
  const swordless = is(c["mode.weapons"], "swordless");
  // World.php:111-129: each level falls through to the ones below it, and
  // turns its flags on whatever the config said
  const mc = dungeonItems !== "standard";
  const mcs = dungeonItems === "mcs" || dungeonItems === "full";
  // World.php:171-259: the pool and the functionality set these over any
  // value the config gave
  const functionality = c["item.functionality"] ?? "normal";
  const pool = c["item.pool"];
  const logic = c.logic ?? "NoGlitches";
  const glitch = (flag: GlitchFlag) => LOGIC_FLAGS[logic].includes(flag);
  const shields: Flag = isUnknown(pool)
    ? UNKNOWN
    : (pool === undefined
        ? (c["item.overflow.count.Shield"] ?? 3)
        : POOL_SHIELDS[pool]) >= 3;
  const bottleMagic = isUnknown(functionality)
    ? UNKNOWN
    : BOTTLE_MAGIC[functionality];
  return {
    advancedPlacement: is(c.itemPlacement, "advanced"),
    basicPlacement: basic,
    bootsAtStart: logic !== "NoGlitches" && c.difficulty !== "custom",
    bossNormalLocation: c["region.bossNormalLocation"] ?? true,
    bossShuffle: isUnknown(c["enemizer.bossShuffle"])
      ? UNKNOWN
      : (c["enemizer.bossShuffle"] ?? "none") !== "none",
    canBootsClip: glitch("canBootsClip"),
    canBunnyRevive: glitch("canBunnyRevive"),
    canBunnySurf: glitch("canBunnySurf"),
    canDungeonRevive: glitch("canDungeonRevive"),
    canFakeFlipper: glitch("canFakeFlipper"),
    canMirrorClip: glitch("canMirrorClip"),
    canMirrorWrap: glitch("canMirrorWrap"),
    canOneFrameClipOW: glitch("canOneFrameClipOW"),
    canOneFrameClipUW: glitch("canOneFrameClipUW"),
    canOWYBA: glitch("canOWYBA"),
    canSuperBunny: glitch("canSuperBunny"),
    canSuperSpeed: glitch("canSuperSpeed"),
    canTransitionWrapped: glitch("canTransitionWrapped"),
    cantTakeDamage: c["region.cantTakeDamage"] ?? false,
    canWaterWalk: glitch("canWaterWalk"),
    catchableFairies: all(
      is(functionality, "normal"),
      c["rom.CatchableFairies"] ?? true,
    ),
    completionistGoal: is(goal, "completionist"),
    crystalsGanon: crystalsOf(c["crystals.ganon"]),
    crystalsTower: crystalsOf(c["crystals.tower"]),
    defaultEnemyHealth: (c["enemizer.enemyHealth"] ?? "default") === "default",
    dungeonsGoal: is(goal, "dungeons"),
    fastGanonGoal: is(goal, "fast_ganon"),
    forceSkullWoodsKey: basic,
    fullBottleMagic: is(bottleMagic, 0x80),
    ganonGoal: is(goal, "ganon"),
    genericKeys: retro || (c["rom.genericKeys"] ?? false),
    halfBottleMagic: is(bottleMagic, 0x40),
    ignoreCanKillEscapeThings: c.ignoreCanKillEscapeThings ?? false,
    invertedMode: mode === "inverted",
    locationsAccessibility: is(c.accessibility, "locations"),
    mirrorShieldInPool: shields,
    noLogic: false,
    pedestalGoal: is(goal, "pedestal"),
    quarterBottleMagic: is(bottleMagic, 0x20),
    requireBetterBow: any(basic, swordless),
    requireBetterSword: basic,
    requireLamp: c["item.require.Lamp"] ?? 1,
    rupeeBow: retro || (c["rom.rupeeBow"] ?? false),
    simpleBossShuffle: is(c["enemizer.bossShuffle"] ?? "none", "simple"),
    standardMode: mode === "standard",
    swordless,
    swordsInPool: c["region.swordsInPool"] ?? true,
    wildBigKeys: dungeonItems === "full" || (c["region.wildBigKeys"] ?? false),
    wildCompasses: mc || (c["region.wildCompasses"] ?? false),
    wildKeys: retro || mcs || (c["region.wildKeys"] ?? false),
    wildMaps: mc || (c["region.wildMaps"] ?? false),
  };
}

/**
 * A No Logic seed's settings, read with the rules of the logic `settings`
 * were built for: the glitches the player plays it with. Upstream gives
 * No Logic no rules at all (World.php:93), so everything is accessible;
 * a tracker shows instead what Link can reach with those glitches. Link
 * starts with the boots (Randomizer.php:122-131).
 */
export const noLogicSettings = (settings: AlttprSettings): AlttprSettings => ({
  ...settings,
  bootsAtStart: true,
  noLogic: true,
});

/**
 * The site's default preset (config/alttp.php:78-96): advanced placement,
 * randomized weapons, Ganon with 7 crystals for the tower and for him,
 * dungeon items in their dungeons, 100% inventory.
 */
const SITE_DEFAULT = {
  accessibility: "items",
  "crystals.ganon": 7,
  "crystals.tower": 7,
  dungeonItems: "standard",
  goal: "ganon",
  itemPlacement: "advanced",
  logic: "NoGlitches",
  "mode.weapons": "randomized",
} as const satisfies UpstreamConfig;

/** The site's default preset, which is an Open world. */
export const OPEN: AlttprSettings = settingsFromUpstream("open", SITE_DEFAULT);

/** The site's default preset in a Standard world. */
export const STANDARD: AlttprSettings = settingsFromUpstream(
  "standard",
  SITE_DEFAULT,
);

/**
 * The world of the upstream NoGlitches tests: `World::factory('standard',
 * ['difficulty' => 'test_rules', 'logic' => 'NoGlitches'])`
 * (tests/NoGlitches/EasternPalaceTest.php:17). It leaves itemPlacement unset,
 * so neither placement's branches apply: a third variant beside the two
 * presets. OpenTest builds the same world in Open mode.
 */
export const UPSTREAM_TEST: AlttprSettings = settingsFromUpstream("standard", {
  difficulty: "test_rules",
  logic: "NoGlitches",
});

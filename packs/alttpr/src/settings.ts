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
// - config/alttp.php: the site's presets (randomizer.item.presets, 57-173).
//
// Left out, because the pack does not model the mode: rom.rupeeBow and
// rom.genericKeys (the retro world); boss shuffle (each
// dungeon keeps the boss its region names, see bosses.ts); the triforce-hunt
// and ganonhunt goals (triforce pieces are not items of this pack).

/**
 * Every setting a rule of the pack reads. Each field says the upstream
 * config value it stands for and a place a rule reads it. A type, not an
 * interface, so it is the engine's `Settings` as it is.
 */
export type AlttprSettings = {
  /**
   * mode.state is 'standard' (World.php:290): the run starts with the
   * escape, and RescueZelda is not given at the start (Randomizer.php:133).
   * Otherwise 'open'. Inverted and retro are other worlds, not modeled.
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
  readonly swordless: boolean;
  /** itemPlacement is 'basic' (Boss.php:89). */
  readonly basicPlacement: boolean;
  /**
   * itemPlacement is 'advanced' (EasternPalace.php:87). The upstream tests
   * leave itemPlacement unset, so both flags are false there.
   */
  readonly advancedPlacement: boolean;
  /**
   * region.requireBetterBow: Ganon needs silvers, with basic placement or
   * swordless (World.php:261-273; DarkWorld/NorthEast.php:227).
   */
  readonly requireBetterBow: boolean;
  /**
   * region.requireBetterSword, with basic placement (World.php:262-267;
   * DarkWorld/NorthEast.php:232).
   */
  readonly requireBetterSword: boolean;
  /**
   * region.forceSkullWoodsKey, with basic placement (World.php:275-277); a
   * fill rule reads it (SkullWoods.php:107).
   */
  readonly forceSkullWoodsKey: boolean;

  /** goal is 'ganon', the default (World.php:67; DarkWorld/NorthEast.php:213). */
  readonly ganonGoal: boolean;
  /** goal is 'fast_ganon' (DarkWorld/NorthEast.php:213, 226). */
  readonly fastGanonGoal: boolean;
  /** goal is 'dungeons' (DarkWorld/NorthEast.php:195). */
  readonly dungeonsGoal: boolean;
  /** goal is 'pedestal': no rule reads it, the tracker's go mode will. */
  readonly pedestalGoal: boolean;
  /** goal is 'completionist': no rule reads it, the tracker's go mode will. */
  readonly completionistGoal: boolean;
  /** crystals.tower, 7 by default (GanonsTower.php:407). */
  readonly crystalsTower: number;
  /** crystals.ganon, 7 by default (DarkWorld/NorthEast.php:220). */
  readonly crystalsGanon: number;

  /**
   * item.require.Lamp: the lamps a dark room needs, 1 by default
   * (EasternPalace.php:77), 0 when the customizer drops the rule
   * (CustomizerController.php:156). `lamp >= setting(requireLamp)`.
   */
  readonly requireLamp: number;

  /**
   * region.wildKeys: small keys leave their dungeon (keysanity), set by
   * dungeonItems 'mcs' and 'full' (World.php:117-121; Region.php:235).
   */
  readonly wildKeys: boolean;
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
  readonly locationsAccessibility: boolean;
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
  readonly mirrorShieldInPool: boolean;
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
  readonly fullBottleMagic: boolean;
  readonly halfBottleMagic: boolean;
  readonly quarterBottleMagic: boolean;
  /**
   * rom.CatchableFairies, true by default; hard, expert and superexpert
   * item functionality turn it off (World.php:216-259; ItemCollection.php:
   * 446).
   */
  readonly catchableFairies: boolean;

  // The glitch flags of config/logic.php, and two the region rules read that
  // no logic sets. NoGlitches sets none (logic.php:4), and it is the only
  // logic the pack models: a rule writes the branch upstream gates on one as
  // `setting(canBootsClip) & ...`, which folds away.
  readonly canBootsClip: false;
  readonly canBunnyRevive: false;
  readonly canBunnySurf: false;
  readonly canDungeonRevive: false;
  readonly canFakeFlipper: false;
  readonly canMirrorClip: false;
  readonly canMirrorWrap: false;
  readonly canOneFrameClipOW: false;
  readonly canOneFrameClipUW: false;
  readonly canOWYBA: false;
  readonly canSuperBunny: false;
  readonly canSuperSpeed: false;
  readonly canTransitionWrapped: false;
  readonly canWaterWalk: false;
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

/**
 * A world's config, under upstream's own keys (`World::factory`'s second
 * argument). Every key is optional and takes the default the rules read it
 * with. `settingsFromUpstream` checks the values too, so a fixture's raw
 * config can be passed as it is.
 */
export type UpstreamConfig = {
  readonly accessibility?: "items" | "locations" | "none";
  /** Read by no rule (the tests set 'test_rules'). */
  readonly difficulty?: string;
  readonly dungeonItems?: "full" | "mc" | "mcs" | "standard";
  readonly "crystals.ganon"?: number;
  readonly "crystals.tower"?: number;
  readonly "enemizer.enemyHealth"?: string;
  readonly goal?: (typeof GOALS)[number];
  readonly ignoreCanKillEscapeThings?: boolean;
  readonly "item.functionality"?: (typeof FUNCTIONALITIES)[number];
  readonly "item.overflow.count.Shield"?: number;
  readonly "item.pool"?: (typeof POOLS)[number];
  readonly "item.require.Lamp"?: number;
  readonly itemPlacement?: "advanced" | "basic";
  readonly logic?: "NoGlitches";
  readonly "mode.weapons"?: "assured" | "randomized" | "swordless" | "vanilla";
  readonly "region.bossNormalLocation"?: boolean;
  readonly "region.cantTakeDamage"?: boolean;
  readonly "region.swordsInPool"?: boolean;
  readonly "region.wildBigKeys"?: boolean;
  readonly "region.wildCompasses"?: boolean;
  readonly "region.wildKeys"?: boolean;
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

/** What each key accepts. A key missing here is one the pack does not model. */
const KEYS: Readonly<Record<keyof UpstreamConfig, Check>> = {
  accessibility: oneOf("items", "locations", "none"),
  "crystals.ganon": (value) => isCount(value) && (value as number) <= 7,
  "crystals.tower": (value) => isCount(value) && (value as number) <= 7,
  difficulty: isString,
  dungeonItems: oneOf("full", "mc", "mcs", "standard"),
  "enemizer.enemyHealth": isString,
  goal: oneOf(...GOALS),
  ignoreCanKillEscapeThings: isBoolean,
  "item.functionality": oneOf(...FUNCTIONALITIES),
  "item.overflow.count.Shield": isCount,
  "item.pool": oneOf(...POOLS),
  "item.require.Lamp": isCount,
  itemPlacement: oneOf("advanced", "basic"),
  logic: oneOf("NoGlitches"),
  "mode.weapons": oneOf("assured", "randomized", "swordless", "vanilla"),
  "region.bossNormalLocation": isBoolean,
  "region.cantTakeDamage": isBoolean,
  "region.swordsInPool": isBoolean,
  "region.wildBigKeys": isBoolean,
  "region.wildCompasses": isBoolean,
  "region.wildKeys": isBoolean,
  "region.wildMaps": isBoolean,
  "rom.CatchableFairies": isBoolean,
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

/**
 * The settings of a world `World::factory(mode, config)` builds, as its
 * constructor derives them: dungeonItems turns the wild flags on, basic
 * placement and swordless ask for better bows and swords. Throws a
 * RangeError for a mode, key or value the pack does not model, such as a
 * logic other than NoGlitches.
 */
export function settingsFromUpstream(
  mode: string,
  config: Readonly<Record<string, unknown>> = {},
): AlttprSettings {
  if (mode !== "open" && mode !== "standard" && mode !== "inverted") {
    throw new RangeError(`Upstream mode "${mode}" is not modeled`);
  }
  const c = checked(config);
  const goal = c.goal ?? "ganon";
  const dungeonItems = c.dungeonItems ?? "standard";
  const basic = c.itemPlacement === "basic";
  const swordless = c["mode.weapons"] === "swordless";
  // World.php:111-129: each level falls through to the ones below it, and
  // turns its flags on whatever the config said
  const mc = dungeonItems !== "standard";
  const mcs = dungeonItems === "mcs" || dungeonItems === "full";
  // World.php:171-259: the pool and the functionality set these over any
  // value the config gave
  const functionality = c["item.functionality"] ?? "normal";
  const shields =
    c["item.pool"] === undefined
      ? (c["item.overflow.count.Shield"] ?? 3)
      : POOL_SHIELDS[c["item.pool"]];
  const bottleMagic = BOTTLE_MAGIC[functionality];
  return {
    advancedPlacement: c.itemPlacement === "advanced",
    basicPlacement: basic,
    bossNormalLocation: c["region.bossNormalLocation"] ?? true,
    canBootsClip: false,
    canBunnyRevive: false,
    canBunnySurf: false,
    canDungeonRevive: false,
    canFakeFlipper: false,
    canMirrorClip: false,
    canMirrorWrap: false,
    canOneFrameClipOW: false,
    canOneFrameClipUW: false,
    canOWYBA: false,
    canSuperBunny: false,
    canSuperSpeed: false,
    canTransitionWrapped: false,
    cantTakeDamage: c["region.cantTakeDamage"] ?? false,
    canWaterWalk: false,
    catchableFairies:
      functionality === "normal" && (c["rom.CatchableFairies"] ?? true),
    completionistGoal: goal === "completionist",
    crystalsGanon: c["crystals.ganon"] ?? 7,
    crystalsTower: c["crystals.tower"] ?? 7,
    defaultEnemyHealth: (c["enemizer.enemyHealth"] ?? "default") === "default",
    dungeonsGoal: goal === "dungeons",
    fastGanonGoal: goal === "fast_ganon",
    forceSkullWoodsKey: basic,
    fullBottleMagic: bottleMagic === 0x80,
    ganonGoal: goal === "ganon",
    halfBottleMagic: bottleMagic === 0x40,
    ignoreCanKillEscapeThings: c.ignoreCanKillEscapeThings ?? false,
    invertedMode: mode === "inverted",
    locationsAccessibility: c.accessibility === "locations",
    mirrorShieldInPool: shields >= 3,
    pedestalGoal: goal === "pedestal",
    quarterBottleMagic: bottleMagic === 0x20,
    requireBetterBow: basic || swordless,
    requireBetterSword: basic,
    requireLamp: c["item.require.Lamp"] ?? 1,
    standardMode: mode === "standard",
    swordless,
    swordsInPool: c["region.swordsInPool"] ?? true,
    wildBigKeys: dungeonItems === "full" || (c["region.wildBigKeys"] ?? false),
    wildCompasses: mc || (c["region.wildCompasses"] ?? false),
    wildKeys: mcs || (c["region.wildKeys"] ?? false),
    wildMaps: mc || (c["region.wildMaps"] ?? false),
  };
}

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

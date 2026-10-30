// The seed's run type: what a seed's settings, from its ROM or its file on
// alttpr.com, say of the tracker's run type, and the words for it. Pure: the
// store decides when to switch (stores/autotrackStore.ts), the follower
// switches (autotrack/follow.ts).
//
// A setting the seed does not state is never guessed. In Race Mode the ROM's
// settings are not read at all (the pack's seed-settings.ts), nor is the
// seed's file asked for: the run type stays the player's. Item placement,
// accessibility and the item pool and functionality only the file states:
// without it the run's own stay. A seed the tracker cannot hold (dungeon
// items let out in a mix vt never writes, the Ganonhunt and Completionist
// goals) is said, never rounded to the nearest run type. A Mystery seed's
// file hides its settings: its run type is Mystery, in the run's world.

import type {
  SeedGoal,
  SeedLogic,
  SeedSetting,
  SeedSettingsReading,
  SeedUnknown,
} from "@alltp/pack-alttpr";
import {
  DOOR_OPTIONS,
  DOOR_SETTING_LABELS,
  type DoorRunSettings,
  type DoorSetting,
  doorEntranceOf,
  doorEntranceText,
  doorFromSeed,
  doorOf,
  doorRows,
  doorValueText,
  isDoorRun,
  sameDoorSettings,
} from "@/games/alttpr/data/doorRando";
import {
  ACCESSIBILITY_LABELS,
  BOSS_SHUFFLE_LABELS,
  bossShuffleOf,
  DUNGEON_ITEM_LABELS,
  ENEMY_HEALTH_LABELS,
  ENTRANCE_LABELS,
  enemyHealthOf,
  FUNCTIONALITY_LABELS,
  GLITCHES_LABELS,
  type Glitches,
  getPreset,
  isHidden,
  MODE_LABELS,
  PLACEMENT_LABELS,
  POOL_LABELS,
  presets,
  type RunSettings,
  SWORDS_LABELS,
  swordsOf,
  type TunableSetting,
  type TuningValue,
  tunedOf,
} from "@/games/alttpr/data/presets";

/** The run the tracker holds: its run type and settings. */
export type Run = {
  readonly presetId: string;
  readonly settings: RunSettings;
};

/** What the seed says of the tracker's run type. */
export type SeedCheck =
  /** The settings are not all known, and why. */
  | { readonly kind: "unread"; readonly why: SeedUnknown }
  /** Known, but no run type of the tracker's holds them. */
  | {
      readonly kind: "unsupported";
      readonly seed: string;
      readonly reasons: readonly string[];
    }
  /** The tracker's run type is the seed's. */
  | { readonly kind: "same"; readonly seed: string; readonly text: string }
  /**
   * A Mystery run in the seed's world: the settings the seed reveals, to
   * lay on the run, its progress kept.
   */
  | {
      readonly kind: "reveals";
      readonly seed: string;
      readonly change: SeedChange;
      /** "Mystery (Open, Ganon, 7/7)" */
      readonly seedText: string;
    }
  /** The seed's run type differs: the run type and settings to switch to. */
  | {
      readonly kind: "differs";
      readonly seed: string;
      readonly presetId: string;
      readonly settings: RunSettings;
      /** "Keysanity (Open, Ganon, 7/7)" */
      readonly seedText: string;
      /** "Open", or with its settings when it bears the seed's name too */
      readonly runText: string;
    };

/** The tracker's goal for each of upstream's it has. */
const GOALS: Partial<Record<SeedGoal, RunSettings["goal"]>> = {
  completionist: "completionist",
  dungeons: "all-dungeons",
  fast_ganon: "fast-ganon",
  ganon: "ganon",
  ganonhunt: "ganonhunt",
  pedestal: "pedestal",
  "triforce-hunt": "triforce-hunt",
};

/** Upstream's goals the tracker has no run type for, in words: none now. */
const OTHER_GOALS: Partial<Record<SeedGoal, string>> = {};

/**
 * The run's glitched logic for each of upstream's (RandomizerController.php:
 * 110-116): none for NoGlitches, which every preset is.
 */
const GLITCHES: Readonly<Record<SeedLogic, Glitches | undefined>> = {
  HybridMajorGlitches: "hybrid_major_glitches",
  MajorGlitches: "major_glitches",
  NoGlitches: undefined,
  NoLogic: "no_logic",
  OverworldGlitches: "overworld_glitches",
};

/**
 * Settings with the seed's logic: its glitches when it states them, the
 * run's own when it does not (Race Mode, not read), none for NoGlitches.
 */
const withGlitches = (
  settings: RunSettings,
  logic: SeedSetting<SeedLogic>,
): RunSettings => {
  const glitches = logic.known ? GLITCHES[logic.value] : settings.glitches;
  const { glitches: _, playGlitches, ...rest } = settings;
  if (glitches === undefined) return rest;
  // The glitches a No Logic run is played with stay the player's
  return glitches === "no_logic" && playGlitches !== undefined
    ? { ...rest, glitches, playGlitches }
    : { ...rest, glitches };
};

/**
 * The glitches a seed's logic reveals to a Mystery run whose glitches are
 * hidden: undefined while it is not known, and for Major Glitches, which
 * the ROM's seed type also writes for Hybrid Major Glitches and No Logic
 * (World.php:1292-1302): a hidden setting is never set from a guess.
 */
const revealedGlitches = (
  logic: SeedSetting<SeedLogic>,
): Glitches | "none" | undefined =>
  !logic.known || logic.value === "MajorGlitches"
    ? undefined
    : (GLITCHES[logic.value] ?? "none");

/** Short names for the goals, as a seed's summary says them. */
const GOAL_NAMES: Readonly<Record<RunSettings["goal"], string>> = {
  "all-dungeons": "All Dungeons",
  completionist: "Completionist",
  "fast-ganon": "Fast Ganon",
  ganon: "Ganon",
  ganonhunt: "Ganonhunt",
  pedestal: "Pedestal",
  "triforce-hunt": "Triforce Hunt",
};

/** The settings a run type holds, which a seed's must match. */
export const COMPARED = [
  "mode",
  "entranceShuffle",
  "goal",
  "dungeonItems",
  "swordless",
  "crystalsTower",
  "crystalsGanon",
  "itemPlacement",
  "accessibility",
  "itemPool",
  "itemFunctionality",
] as const satisfies readonly (keyof RunSettings)[];

/**
 * What a seed lays on a Mystery run: its tunable settings; the glitches
 * only while hidden (`revealedGlitches`), a seed of another logic than the
 * one set switching the run (`sameLogic`).
 */
type SeedChange = {
  [K in Exclude<TunableSetting, "playGlitches">]?: TuningValue<K>;
};

/** A setting only the seed's file states: the seed's when known, else `own`. */
const fromFile = <T>(setting: SeedSetting<T> | undefined, own: T): T =>
  setting?.known ? setting.value : own;

/**
 * Why a set of settings is not known: a Mystery seed, Race Mode, then a
 * value no seed has.
 */
const firstUnknown = (
  settings: readonly SeedSetting<unknown>[],
): SeedUnknown | null => {
  const whys = new Set<SeedUnknown>();
  for (const setting of settings) if (!setting.known) whys.add(setting.why);
  for (const why of [
    "mystery",
    "race-mode",
    "unrecognized",
    "not-read",
  ] as const) {
    if (whys.has(why)) return why;
  }
  return null;
};

/**
 * The dungeon items levels vt writes, by the maps, compasses, small keys and
 * big keys they let out (1) or keep (0): each lets out the ones before it
 * (World.php:111-129). Any other mix is no seed of vt's.
 */
const DUNGEON_ITEM_LEVELS: Readonly<
  Partial<Record<string, RunSettings["dungeonItems"]>>
> = { "0000": "standard", "1100": "mc", "1110": "mcs", "1111": "full" };

/** The dungeon items a seed shuffles, named, when only some are. */
const WILD_NAMES = {
  wildBigKeys: "big keys",
  wildCompasses: "compasses",
  wildKeys: "small keys",
  wildMaps: "maps",
} as const;

/** How many of a run's compared settings a preset holds as they are. */
const likeness = (preset: RunSettings, settings: RunSettings) =>
  (Object.keys(preset) as (keyof RunSettings)[]).filter(
    (key) => preset[key] === settings[key],
  ).length;

/**
 * The run type that names settings best: the one holding most of them as
 * they are, the current one on a tie, else the first listed.
 */
const presetFor = (settings: RunSettings, currentId: string): string => {
  // A Door Randomizer seed's run type is one of DR's, an alttpr.com seed's
  // one of alttpr.com's; among DR's, the one of its entrances first (DR
  // Crosskeys' race settings, its bomb bag, never outweigh a vanilla world)
  const kin = presets.filter(
    (preset) => isDoorRun(preset.settings) === isDoorRun(settings),
  );
  const sameWorld = kin.filter(
    (preset) =>
      !isDoorRun(settings) ||
      (preset.settings.entranceShuffle ?? "none") ===
        (settings.entranceShuffle ?? "none"),
  );
  const family = sameWorld.length > 0 ? sameWorld : kin;
  const current = getPreset(currentId);
  let best = family.includes(current) ? current : (family[0] ?? current);
  let score = likeness(best.settings, settings);
  for (const preset of family) {
    const own = likeness(preset.settings, settings);
    if (own > score) {
      best = preset;
      score = own;
    }
  }
  return best.id;
};

/**
 * A run type in words: its name, then its world, goal and crystals, and what
 * its settings change from the run type's own: "Keysanity (Open, Ganon,
 * 7/7)", "Standard (Standard, Ganon, 7/7, Full Shuffle)", "Inverted (Inverted,
 * Fast Ganon, 4/7, Basic placement, Hard pool, Hard functionality)".
 */
export const describeRun = (presetId: string, settings: RunSettings) => {
  const preset = getPreset(presetId);
  // A Mystery run's hidden settings are left out: "Mystery (Open)"
  const shown = (key: TunableSetting) => !isHidden(settings, key);
  const crystals = (key: "crystalsGanon" | "crystalsTower") =>
    shown(key) ? settings[key] : "?";
  const parts = [MODE_LABELS[settings.mode]];
  if (shown("goal")) parts.push(GOAL_NAMES[settings.goal]);
  if (shown("crystalsTower") || shown("crystalsGanon")) {
    parts.push(`${crystals("crystalsTower")}/${crystals("crystalsGanon")}`);
  }
  const differs = (key: TunableSetting) =>
    shown(key) && settings[key] !== preset.settings[key];
  // A DR run's in DR's own words: Lite, Dungeons + Full…
  if (
    shown("entranceShuffle") &&
    isDoorRun(settings) &&
    doorEntranceOf(settings) !== doorEntranceOf(preset.settings)
  ) {
    parts.push(
      doorEntranceOf(settings) === "vanilla"
        ? "vanilla entrances"
        : `${doorEntranceText(settings)} entrances`,
    );
  } else if (
    shown("entranceShuffle") &&
    !isDoorRun(settings) &&
    settings.entranceShuffle !== preset.settings.entranceShuffle
  ) {
    parts.push(
      settings.entranceShuffle === "none"
        ? "vanilla entrances"
        : `${ENTRANCE_LABELS[settings.entranceShuffle]} entrances`,
    );
  }
  if (differs("dungeonItems")) {
    parts.push(
      settings.dungeonItems === "standard"
        ? "Standard dungeon items"
        : DUNGEON_ITEM_LABELS[settings.dungeonItems],
    );
  }
  if (differs("swordless")) {
    parts.push(settings.swordless ? "Swordless" : "swords");
  }
  if (differs("itemPlacement")) {
    parts.push(`${PLACEMENT_LABELS[settings.itemPlacement]} placement`);
  }
  if (differs("itemPool")) {
    parts.push(`${POOL_LABELS[settings.itemPool]} pool`);
  }
  if (differs("itemFunctionality")) {
    parts.push(
      `${FUNCTIONALITY_LABELS[settings.itemFunctionality]} functionality`,
    );
  }
  if (differs("accessibility")) {
    parts.push(ACCESSIBILITY_LABELS[settings.accessibility]);
  }
  // No preset shuffles the bosses
  if (shown("bossShuffle") && bossShuffleOf(settings) !== "none") {
    parts.push(`${BOSS_SHUFFLE_LABELS[bossShuffleOf(settings)]} boss shuffle`);
  }
  // No preset places the swords or changes the enemies' health
  if (!settings.swordless && swordsOf(settings) !== "randomized") {
    parts.push(`${SWORDS_LABELS[swordsOf(settings)]} swords`);
  }
  if (enemyHealthOf(settings) !== "default") {
    parts.push(`${ENEMY_HEALTH_LABELS[enemyHealthOf(settings)]} enemy health`);
  }
  // No preset is glitched
  if (shown("glitches") && settings.glitches !== undefined) {
    parts.push(GLITCHES_LABELS[settings.glitches]);
  }
  // A Door Randomizer run's own, where they differ from its run type's
  const door = doorOf(settings);
  const presetDoor = doorOf(preset.settings);
  for (const key of doorRows(settings)) {
    if (door !== null && door[key] !== presetDoor?.[key]) {
      parts.push(
        `${DOOR_SETTING_LABELS[key]}: ${doorValueText(key, door[key])}`,
      );
    }
  }
  return `${preset.name} (${parts.join(", ")})`;
};

/**
 * A Mystery seed, which hides its settings: a Mystery run is its run type,
 * in the run's world, which the player sees on the first screen.
 */
const mysterySeed = (
  seed: string,
  logic: SeedSetting<SeedLogic>,
  run: Run,
  door: DoorRunSettings | null,
): SeedCheck => {
  // Its file hides every setting but the logic, which the ROM may tell; a
  // Door Randomizer seed's ROM its generator, from the title
  const revealed = revealedGlitches(logic);
  const mystery = getPreset("mystery").settings;
  const settings = withGlitches(
    {
      ...mystery,
      hidden: mystery.hidden?.filter(
        (key) => revealed === undefined || key !== "glitches",
      ),
      mode: run.settings.mode,
      ...(door?.randomizer === undefined
        ? {}
        : { randomizer: door.randomizer }),
    },
    revealed === undefined ? { known: false, why: "mystery" } : logic,
  );
  // A Mystery run of another generator (alttpr.com's, the Door
  // Randomizer's) differs, whatever its glitches
  if (
    run.presetId === "mystery" &&
    settings.randomizer === run.settings.randomizer
  ) {
    if (revealed !== undefined && isHidden(run.settings, "glitches")) {
      return {
        change: { glitches: revealed },
        kind: "reveals",
        seed,
        seedText: describeRun("mystery", {
          ...withGlitches(run.settings, logic),
          hidden: run.settings.hidden?.filter((key) => key !== "glitches"),
        }),
      };
    }
    if (
      revealed === undefined ||
      isHidden(run.settings, "glitches") ||
      revealed === tunedOf(run.settings, "glitches")
    ) {
      return { kind: "unread", why: "mystery" };
    }
  }
  return {
    kind: "differs",
    presetId: "mystery",
    runText: getPreset(run.presetId).name,
    seed,
    seedText: describeRun("mystery", settings),
    settings,
  };
};

/**
 * What a seed's settings say of the tracker's run type.
 * @param seed - The seed's settings: its ROM's, its file's laid on them
 * @param run - The run type and settings the tracker holds
 */
export const checkSeed = (seed: SeedSettingsReading, run: Run): SeedCheck => {
  const {
    crystalsGanon,
    crystalsTower,
    goal,
    mode,
    swordless,
    wildBigKeys,
    wildCompasses,
    wildKeys,
    wildMaps,
  } = seed;
  const why = firstUnknown([
    crystalsGanon,
    crystalsTower,
    goal,
    mode,
    swordless,
    wildBigKeys,
    wildCompasses,
    wildKeys,
    wildMaps,
  ]);
  if (seed.seed === null) return { kind: "unread", why: why ?? "not-read" };
  if (why === "mystery") {
    return mysterySeed(seed.seed, seed.logic, run, doorFromSeed(seed, {}));
  }
  if (
    why !== null ||
    !crystalsGanon.known ||
    !crystalsTower.known ||
    !goal.known ||
    !mode.known ||
    !swordless.known ||
    !wildBigKeys.known ||
    !wildCompasses.known ||
    !wildKeys.known ||
    !wildMaps.known
  ) {
    return { kind: "unread", why: why ?? "not-read" };
  }

  const reasons: string[] = [];
  const runGoal = GOALS[goal.value];
  if (runGoal === undefined)
    reasons.push(OTHER_GOALS[goal.value] ?? goal.value);
  const wild = { wildBigKeys, wildCompasses, wildKeys, wildMaps };
  const dungeonItems =
    DUNGEON_ITEM_LEVELS[
      [wildMaps, wildCompasses, wildKeys, wildBigKeys]
        .map((setting) => (setting.value ? 1 : 0))
        .join("")
    ];
  if (dungeonItems === undefined) {
    const shuffled = (Object.keys(wild) as (keyof typeof wild)[]).filter(
      (key) => wild[key].value,
    );
    reasons.push(
      `only its ${shuffled.map((key) => WILD_NAMES[key]).join(", ")} outside their dungeons`,
    );
  }
  if (
    runGoal === undefined ||
    dungeonItems === undefined ||
    reasons.length > 0
  ) {
    return { kind: "unsupported", reasons, seed: seed.seed };
  }

  const glitches = revealedGlitches(seed.logic);
  const glitchesHidden = isHidden(run.settings, "glitches");
  const settings: RunSettings = withGlitches(
    {
      ...run.settings,
      accessibility: fromFile(seed.accessibility, run.settings.accessibility),
      crystalsGanon: crystalsGanon.value,
      crystalsTower: crystalsTower.value,
      dungeonItems,
      entranceShuffle: fromFile(seed.entrances, run.settings.entranceShuffle),
      goal: runGoal,
      itemFunctionality: fromFile(
        seed.itemFunctionality,
        run.settings.itemFunctionality,
      ),
      itemPlacement: fromFile(seed.itemPlacement, run.settings.itemPlacement),
      itemPool: fromFile(seed.itemPool, run.settings.itemPool),
      mode: mode.value,
      swordless: swordless.value,
    },
    // Hidden glitches stay the run's until the seed tells them for sure
    glitchesHidden && glitches === undefined
      ? { known: false, why: "mystery" }
      : seed.logic,
  );
  // The seed's settings hide nothing: a Mystery run's hidden list is its own
  delete settings.hidden;
  // A Door Randomizer seed's own settings, an alttpr.com seed's none
  const door = doorFromSeed(seed, run.settings);
  if (door !== null) {
    for (const key of Object.keys(DOOR_OPTIONS) as DoorSetting[]) {
      delete settings[key];
    }
    Object.assign(settings, door);
  }
  // Only the file states it; none is said by its absence, as every preset
  const bossShuffle = fromFile(seed.bossShuffle, bossShuffleOf(run.settings));
  if (bossShuffle === "none") delete settings.bossShuffle;
  else settings.bossShuffle = bossShuffle;
  // Only the file states where the swords are and the enemies' health;
  // randomized and default are said by their absence, as every preset
  const swords = seed.weapons?.known
    ? seed.weapons.value === "assured" || seed.weapons.value === "vanilla"
      ? seed.weapons.value
      : undefined
    : run.settings.swords;
  if (swords === undefined || settings.swordless) delete settings.swords;
  else settings.swords = swords;
  const enemyHealth = seed.enemyHealth?.known
    ? seed.enemyHealth.value === "default"
      ? undefined
      : seed.enemyHealth.value
    : run.settings.enemyHealth;
  if (enemyHealth === undefined) delete settings.enemyHealth;
  else settings.enemyHealth = enemyHealth;
  const sameLogic = settings.glitches === run.settings.glitches;
  // A Mystery run takes what the seed reveals, in place, in its own world
  // and logic, and its entrance shuffle and glitches while they are hidden
  const entrancesHidden = isHidden(run.settings, "entranceShuffle");
  if (
    run.presetId === "mystery" &&
    settings.mode === run.settings.mode &&
    (settings.entranceShuffle === run.settings.entranceShuffle ||
      (entrancesHidden && seed.entrances?.known === true)) &&
    (sameLogic || (glitchesHidden && glitches !== undefined)) &&
    sameDoorSettings(settings, run.settings)
  ) {
    const said: SeedChange = {
      crystalsGanon: settings.crystalsGanon,
      crystalsTower: settings.crystalsTower,
      dungeonItems: settings.dungeonItems,
      goal: settings.goal,
      swordless: settings.swordless,
      // Only what the seed's file states: the rest stays hidden
      ...(seed.accessibility?.known && {
        accessibility: settings.accessibility,
      }),
      ...(seed.itemFunctionality?.known && {
        itemFunctionality: settings.itemFunctionality,
      }),
      ...(seed.itemPlacement?.known && {
        itemPlacement: settings.itemPlacement,
      }),
      ...(seed.itemPool?.known && { itemPool: settings.itemPool }),
      ...(seed.bossShuffle?.known && { bossShuffle }),
      ...(seed.entrances?.known && {
        entranceShuffle: settings.entranceShuffle,
      }),
      ...(seed.weapons?.known &&
        !settings.swordless && { swords: swordsOf(settings) }),
      ...(seed.enemyHealth?.known && {
        enemyHealth: enemyHealthOf(settings),
      }),
      ...(glitchesHidden && glitches !== undefined && { glitches }),
    };
    const change = Object.fromEntries(
      (Object.keys(said) as (keyof SeedChange)[])
        .filter(
          (key) =>
            said[key] !== tunedOf(run.settings, key) ||
            isHidden(run.settings, key),
        )
        .map((key) => [key, said[key]]),
    );
    if (Object.keys(change).length > 0) {
      return {
        change,
        kind: "reveals",
        seed: seed.seed,
        seedText: describeRun(run.presetId, settings),
      };
    }
  }
  if (
    sameLogic &&
    COMPARED.every((key) => settings[key] === run.settings[key]) &&
    bossShuffle === bossShuffleOf(run.settings) &&
    swordsOf(settings) === swordsOf(run.settings) &&
    enemyHealthOf(settings) === enemyHealthOf(run.settings) &&
    sameDoorSettings(settings, run.settings)
  ) {
    return {
      kind: "same",
      seed: seed.seed,
      text: describeRun(run.presetId, run.settings),
    };
  }
  const presetId = presetFor(settings, run.presetId);
  const seedText = describeRun(presetId, settings);
  const current = getPreset(run.presetId);
  return {
    kind: "differs",
    presetId,
    runText:
      current.name === getPreset(presetId).name
        ? describeRun(run.presetId, run.settings)
        : current.name,
    seed: seed.seed,
    seedText,
    settings,
  };
};

/** What the live region says once a seed's settings are laid on a Mystery run. */
export const revealedText = (check: Extract<SeedCheck, { kind: "reveals" }>) =>
  `Mystery settings from the seed: ${check.seedText}.`;

/** The prompt's question, from a seed that differs. */
export const promptText = (check: Extract<SeedCheck, { kind: "differs" }>) =>
  `This seed is ${check.seedText}. The tracker is set to ${check.runText}. Switch?`;

/** What the live region says once the tracker switched to the seed's. */
export const switchedText = (check: Extract<SeedCheck, { kind: "differs" }>) =>
  `This seed is ${check.seedText}: the tracker switched to it.`;

/**
 * What the dialog says of the seed's run type, for each check.
 * @param check - What the seed says of the run type
 * @param kept - Whether the player kept their run type for this seed
 */
export const seedLineText = (check: SeedCheck, kept: boolean): string => {
  switch (check.kind) {
    case "unread":
      if (check.why === "race-mode") {
        return "Settings not read in Race Mode, nor asked of alttpr.com: pick the run type yourself.";
      }
      if (check.why === "mystery") {
        return "A Mystery seed: its settings stay hidden until you find them in game.";
      }
      return check.why === "not-read"
        ? "Seed settings not read yet."
        : "This seed's settings are not ones the tracker reads: the run type stays yours.";
    case "unsupported":
      return `No run type here holds this seed (${check.reasons.join("; ")}): the run type stays yours.`;
    case "same":
      return `The run type matches this seed: ${check.text}.`;
    case "reveals":
      return `This seed is ${check.seedText}: its settings are laid on your Mystery run.`;
    case "differs":
      return kept
        ? `This seed is ${check.seedText}. You kept ${check.runText}.`
        : `This seed is ${check.seedText}. The tracker is set to ${check.runText}.`;
  }
};

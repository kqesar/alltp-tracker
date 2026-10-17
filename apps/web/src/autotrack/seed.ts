// The seed's run type: what the settings autotracking read from the ROM say
// of the tracker's run type, and the words for it. Pure: the store decides
// when to switch (stores/autotrackStore.ts), the follower switches
// (autotrack/follow.ts).
//
// A setting the ROM does not state is never guessed. In Race Mode the
// settings are not read at all (the pack's seed-settings.ts): the run type
// then stays the player's. One the tracker cannot hold (some dungeon items
// shuffled and not others, the Ganonhunt and Completionist goals) is said,
// never rounded to the nearest run type.

import type {
  SeedGoal,
  SeedSetting,
  SeedSettingsReading,
  SeedUnknown,
} from "@alltp/pack-alttpr";
import type { SeedFileError } from "@/autotrack/seedFile";
import {
  getPreset,
  MODE_LABELS,
  presets,
  type RunSettings,
} from "@/data/presets";

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
  dungeons: "all-dungeons",
  fast_ganon: "fast-ganon",
  ganon: "ganon",
  pedestal: "pedestal",
  "triforce-hunt": "triforce-hunt",
};

/** Upstream's goals the tracker has no run type for, in words. */
const OTHER_GOALS: Partial<Record<SeedGoal, string>> = {
  completionist: "the Completionist goal",
  ganonhunt: "the Ganonhunt goal",
};

/** Short names for the goals, as a seed's summary says them. */
const GOAL_NAMES: Readonly<Record<RunSettings["goal"], string>> = {
  "all-dungeons": "All Dungeons",
  "fast-ganon": "Fast Ganon",
  ganon: "Ganon",
  pedestal: "Pedestal",
  "triforce-hunt": "Triforce Hunt",
};

/** The settings a run type holds, which a seed's must match. */
const COMPARED = [
  "mode",
  "goal",
  "keysanity",
  "swordless",
  "crystalsTower",
  "crystalsGanon",
] as const satisfies readonly (keyof RunSettings)[];

/** Why a set of settings is not known: Race Mode, then a value no seed has. */
const firstUnknown = (
  settings: readonly SeedSetting<unknown>[],
): SeedUnknown | null => {
  const whys = new Set<SeedUnknown>();
  for (const setting of settings) if (!setting.known) whys.add(setting.why);
  for (const why of ["race-mode", "unrecognized", "not-read"] as const) {
    if (whys.has(why)) return why;
  }
  return null;
};

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
  let best = getPreset(currentId);
  let score = likeness(best.settings, settings);
  for (const preset of presets) {
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
 * 7/7)", "Standard (Standard, Ganon, 7/7, Keysanity)".
 */
export const describeRun = (presetId: string, settings: RunSettings) => {
  const preset = getPreset(presetId);
  const parts = [
    MODE_LABELS[settings.mode],
    GOAL_NAMES[settings.goal],
    `${settings.crystalsTower}/${settings.crystalsGanon}`,
  ];
  if (settings.keysanity !== preset.settings.keysanity) {
    parts.push(settings.keysanity ? "Keysanity" : "no Keysanity");
  }
  if (settings.swordless !== preset.settings.swordless) {
    parts.push(settings.swordless ? "Swordless" : "swords");
  }
  return `${preset.name} (${parts.join(", ")})`;
};

/**
 * What a seed's settings say of the tracker's run type.
 * @param seed - The settings read from the ROM
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
  const shuffled = (Object.keys(wild) as (keyof typeof wild)[]).filter(
    (key) => wild[key].value,
  );
  if (shuffled.length > 0 && shuffled.length < 4) {
    reasons.push(
      `only its ${shuffled.map((key) => WILD_NAMES[key]).join(", ")} outside their dungeons`,
    );
  }
  if (runGoal === undefined || reasons.length > 0) {
    return { kind: "unsupported", reasons, seed: seed.seed };
  }

  const settings: RunSettings = {
    ...run.settings,
    crystalsGanon: crystalsGanon.value,
    crystalsTower: crystalsTower.value,
    goal: runGoal,
    keysanity: shuffled.length === 4,
    mode: mode.value,
    swordless: swordless.value,
  };
  if (COMPARED.every((key) => settings[key] === run.settings[key])) {
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

/** The prompt's question, from a seed that differs. */
export const promptText = (check: Extract<SeedCheck, { kind: "differs" }>) =>
  `This seed is ${check.seedText}. The tracker is set to ${check.runText}. Switch?`;

/** What the live region says once the tracker switched to the seed's. */
export const switchedText = (check: Extract<SeedCheck, { kind: "differs" }>) =>
  `This seed is ${check.seedText}: the tracker switched to it.`;

/** What the dialog says of a race seed while its file gives no settings. */
const RACE_FILE_LINES: Readonly<Record<"loading" | SeedFileError, string>> = {
  loading: "Settings not read in Race Mode: asking alttpr.com for them…",
  "not-found":
    "Settings not read in Race Mode, and alttpr.com has no file for this seed: the run type stays yours.",
  offline:
    "Settings not read in Race Mode, and alttpr.com could not be reached: the run type stays yours.",
  unrecognized:
    "Settings not read in Race Mode, and this seed's file on alttpr.com is not one the tracker reads: the run type stays yours.",
};

/**
 * What the dialog says of the seed's run type, for each check.
 * @param check - What the seed says of the run type
 * @param kept - Whether the player kept their run type for this seed
 * @param file - Where a race seed's file stands, while it gives no settings
 */
export const seedLineText = (
  check: SeedCheck,
  kept: boolean,
  file?: "loading" | SeedFileError,
): string => {
  switch (check.kind) {
    case "unread":
      if (check.why === "race-mode") {
        return file === undefined
          ? "Settings not read in Race Mode: the run type stays yours."
          : RACE_FILE_LINES[file];
      }
      return check.why === "not-read"
        ? "Seed settings not read yet."
        : "This seed's settings are not ones the tracker reads: the run type stays yours.";
    case "unsupported":
      return `No run type here holds this seed (${check.reasons.join("; ")}): the run type stays yours.`;
    case "same":
      return `The run type matches this seed: ${check.text}.`;
    case "differs":
      return kept
        ? `This seed is ${check.seedText}. You kept ${check.runText}.`
        : `This seed is ${check.seedText}. The tracker is set to ${check.runText}.`;
  }
};

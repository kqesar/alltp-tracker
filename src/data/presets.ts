/**
 * Run-type presets for the ALttP Randomizer.
 *
 * A preset is a named bundle of settings. The tracker reacts to the settings
 * it can model today (notably `keysanity`, which drives small/big key display
 * via the existing logic). Settings that change the accessibility *logic*
 * (mode = inverted/retro, entranceShuffle = crossed, ...) are stored and shown,
 * but the per-mode logic is implemented in later iterations — `logicSupported`
 * flags whether the tracker's accessibility logic fully models the preset.
 */

export type RunMode = "open" | "standard" | "inverted" | "retro";

export type RunGoal =
  | "ganon"
  | "fast-ganon"
  | "all-dungeons"
  | "pedestal"
  | "triforce-hunt";

export type EntranceShuffle =
  | "none"
  | "simple"
  | "restricted"
  | "full"
  | "crossed"
  | "insanity";

export type RunSettings = {
  mode: RunMode;
  goal: RunGoal;
  /** Small/big keys, maps and compasses shuffled into the world */
  keysanity: boolean;
  entranceShuffle: EntranceShuffle;
};

export type Preset = {
  id: string;
  name: string;
  description: string;
  settings: RunSettings;
  /** True when the tracker's accessibility logic fully models this preset. */
  logicSupported: boolean;
};

const baseSettings: RunSettings = {
  entranceShuffle: "none",
  goal: "ganon",
  keysanity: false,
  mode: "open",
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
    settings: { ...baseSettings, keysanity: true },
  },
  {
    description: "All dungeon bosses must be defeated before Ganon.",
    id: "all-dungeons",
    logicSupported: true,
    name: "All Dungeons",
    settings: { ...baseSettings, goal: "all-dungeons" },
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
    settings: { ...baseSettings, entranceShuffle: "crossed", keysanity: true },
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

export const ENTRANCE_LABELS: Record<EntranceShuffle, string> = {
  crossed: "Crossworld",
  full: "Full",
  insanity: "Insanity",
  none: "None",
  restricted: "Restricted",
  simple: "Simple",
};

/** A labeled summary of a run's settings, for display. */
export const describeSettings = (
  settings: RunSettings,
): { label: string; value: string }[] => [
  { label: "Mode", value: MODE_LABELS[settings.mode] },
  { label: "Goal", value: GOAL_LABELS[settings.goal] },
  { label: "Keysanity", value: settings.keysanity ? "On" : "Off" },
  { label: "Entrances", value: ENTRANCE_LABELS[settings.entranceShuffle] },
];

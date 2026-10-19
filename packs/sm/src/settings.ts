// What a Map Rando seed's ROM says of its settings, for autotrackers: the
// patcher writes each preset's ordinal into bank $DF (patches/rom_map/
// Bank DF.txt; rust/maprando/src/patch.rs:2038-2105), 0 for a setting the
// seed customized, and two items the game gained (patch.rs:783).

/** A preset of one of the seed's settings, by the ordinal the ROM holds. */
type Presets = readonly (readonly [ordinal: number, name: string])[];

/** Skill assumptions, $DF:FF09 (rust/maprando/src/settings.rs:113-124). */
export const SKILL_PRESETS: Presets = [
  [1, "Basic"],
  [2, "Medium"],
  [3, "Hard"],
  [4, "Very Hard"],
  [5, "Expert"],
  [6, "Expert+"],
  [7, "Extreme"],
  [8, "Extreme+"],
  [9, "Insane"],
  [10, "Insane+"],
];

/** Item progression, $DF:FF0A (settings.rs:208-215). */
export const PROGRESSION_PRESETS: Presets = [
  [1, "Normal"],
  [2, "Tricky"],
  [3, "Technical"],
  [4, "Challenge"],
  [5, "Desolate"],
];

/** Quality of life, $DF:FF0B (settings.rs:150-156). */
export const QOL_PRESETS: Presets = [
  [1, "Off"],
  [2, "Low"],
  [3, "Default"],
  [4, "High"],
  [5, "Max"],
];

/** Objectives, $DF:FF0C (settings.rs:177-185). */
export const OBJECTIVE_PRESETS: Presets = [
  [1, "None"],
  [2, "Bosses"],
  [3, "Minibosses"],
  [4, "Chozos"],
  [5, "Pirates"],
  [6, "Metroids"],
  [7, "Random"],
];

/** Map layout, $DF:FF0D (settings.rs:235-241). */
export const MAP_PRESETS: Presets = [
  [1, "Vanilla"],
  [2, "Small"],
  [3, "Standard"],
  [4, "Wild"],
  [5, "Familiar"],
];

/** A setting's preset name, "Custom" for 0, or null for a byte none has. */
export const presetName = (presets: Presets, ordinal: number): string | null =>
  ordinal === 0
    ? "Custom"
    : (presets.find(([value]) => value === ordinal)?.[1] ?? null);

/** The items the seed's settings add, $DF:FF05 (Bank DF.txt; patch.rs:783). */
export const SETTING_FLAGS = {
  /** The Speed Booster comes as the Spark and the Blue Booster. */
  splitSpeed: 0x0002,
  /** Wall jumps need the Wall Jump Boots. */
  wallJump: 0x0001,
} as const;

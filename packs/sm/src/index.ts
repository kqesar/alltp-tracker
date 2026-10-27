// Public entry point of @alltp/pack-sm: the app imports the pack from here only.
export {
  type ClockReading,
  clockStraddled,
  decodeBeforePlay,
  decodeCollected,
  decodeGameClock,
  decodeGameState,
  decodeGoal,
  decodeInPlay,
  decodeItems,
  decodeObjectives,
  decodeSeed,
  type MemoryView,
  type ObjectiveReading,
  RTA_FRAMES_PER_SECOND,
  rtaFrames,
  rtaMs,
  type SeedReading,
  type Unsettled,
} from "./autotrack/decode";
export { MEMORY_RANGE, MEMORY_RANGES } from "./autotrack/memory";
export { MAP_RANDO_AUTOTRACK } from "./autotrack/pack";
export { checkGame, MAP_RANDO_TITLE } from "./autotrack/probes";
export { MAP_RANDO_RACE_PROFILE } from "./autotrack/race-profile";
export { SM_ITEMS, type SmItem, type SmItemId, smItem } from "./items";
export { LOCATION_KEYS, type LocationKey } from "./locations";
export {
  isBossKill,
  OBJECTIVES,
  type Objective,
  type ObjectiveGroup,
  objectiveByFlag,
} from "./objectives";
export {
  MAP_PRESETS,
  OBJECTIVE_PRESETS,
  PROGRESSION_PRESETS,
  presetName,
  QOL_PRESETS,
  SKILL_PRESETS,
} from "./settings";
export {
  type MapRandoExtra,
  type MapRandoLog,
  type MapRandoRun,
  mapRandoEvidence,
  parseSpoiler,
} from "./spoiler";

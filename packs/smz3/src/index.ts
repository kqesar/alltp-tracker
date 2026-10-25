// @alltp/pack-smz3: SMZ3 as samus.link generates it, both games' logic as
// data over the engine, held to upstream's logic tests, and its autotracking
// (README.md).
export {
  type ClockReading,
  decodeBeforePlay,
  decodeChecks,
  decodeGameClock,
  decodeGoal,
  decodeInPlay,
  decodeItems,
  decodeMode,
  decodeRequirements,
  decodeSeed,
  decodeSeedGuid,
  type MemoryView,
  type RequirementsReading,
  type SeedGuidReading,
  type SeedReading,
  SMZ3_FRAMES_PER_SECOND,
  smz3Ms,
  type Unsettled,
} from "./autotrack/decode";
export {
  MEMORY_RANGE,
  MEMORY_RANGES,
  MODES,
  type Smz3Mode,
} from "./autotrack/memory";
export { SMZ3_AUTOTRACK } from "./autotrack/pack";
export { checkGame, SMZ3_TITLE_PREFIX } from "./autotrack/probes";
export { SMZ3_RACE_PROFILE } from "./autotrack/race-profile";
export { DERIVED_FACTS, derivedFacts } from "./derived";
export { HELPERS } from "./helpers";
export {
  fromUpstream,
  ITEM_IDS,
  ITEMS,
  KEYCARDS,
  type Smz3Item,
  stateFromUpstream,
} from "./items";
export {
  HYRULE_MARKERS,
  type Smz3Marker,
  ZEBES_MARKERS,
  ZELDA_ALIASES,
} from "./markers";
export {
  MEDALLION_FACTS,
  MEDALLIONS,
  type Medallion,
  medallionFacts,
  PADS,
  type Pad,
  type PadKnowledge,
} from "./medallions";
export {
  type CompileOptions,
  compile,
  rules,
  STATE_NAMES,
  toState,
  world,
} from "./pack";
export { REGION_MODULES } from "./regions";
export {
  DEFAULT_SETTINGS,
  engineSettings,
  PLACEMENT_LOCATIONS,
  PLACEMENTS,
  type Placement,
  placementSetting,
  type Smz3Settings,
} from "./settings";
export { parseSpoiler, type Smz3SpoilerExtra } from "./spoiler/parse";
export {
  type Entrance,
  type LocationDef,
  locationId,
  type RegionDef,
  type RegionModule,
  regionId,
  START,
} from "./world";

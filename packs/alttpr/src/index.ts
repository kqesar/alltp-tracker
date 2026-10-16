// Public entry point of @alltp/pack-alttpr: the app imports the pack from
// here only, as it does the engine.
export {
  CHECK_FLAGS,
  type CheckEntry,
  type CheckFlag,
  dungeonOf,
  UNMAPPED_LOCATIONS,
  type UnmappedLocation,
} from "./autotrack/check-flags";
export {
  type BossDungeon,
  type CheckReading,
  type DecodeOptions,
  decodeChecks,
  decodeItems,
  decodeProgress,
  type Fact,
  type ItemReading,
  type MemoryView,
  type ProgressReading,
  type Unsettled,
} from "./autotrack/decode";
export {
  type AlttprRange,
  MEMORY_RANGE,
  MEMORY_RANGES,
  MEMORY_SOURCES,
  type MemoryRangeId,
} from "./autotrack/memory";
export { ALTTPR_AUTOTRACK } from "./autotrack/pack";
export {
  ALTTPR_GAME_CHECK,
  ALTTPR_RACE_FLAG,
  checkGame,
  type GameCheckCode,
  probeRaceFlag,
  type RaceFlagProbeResult,
} from "./autotrack/probes";
export { ALTTPR_RACE_PROFILE } from "./autotrack/race-profile";
export { BOSS_SLOTS, BOSSES } from "./bosses";
export {
  DERIVED,
  DERIVED_FACTS,
  type DerivedFact,
  derivedFacts,
} from "./derived";
export {
  DUNGEON_IDS,
  DUNGEONS,
  type DungeonDef,
  type DungeonId,
  dungeon,
  dungeonItemCount,
  dungeonLocations,
  dungeonPool,
  dungeonRegions,
  dungeonStatus,
} from "./dungeons";
export {
  EVENT_LOCATIONS,
  type Filler,
  filler,
  matches,
  PRIZE_ITEMS,
} from "./fill";
export { GROUPS, HELPERS, type Rule } from "./helpers";
export {
  type Contribution,
  fromUpstream,
  ITEM_IDS,
  ITEMS,
  type ItemDef,
  type ItemId,
  stateFromUpstream,
  UPSTREAM_ENGLISH_NAMES,
  UPSTREAM_ITEMS,
} from "./items";
export {
  everything,
  everythingBut,
  type KeyedSolution,
  possibleLocations,
  solveWithKeys,
  type UntrackedItem,
  untrackedItems,
} from "./keys";
export {
  type FromLegacy,
  fromLegacy,
  LEGACY_CHESTS,
  LEGACY_DUNGEON_ITEMS,
  LEGACY_DUNGEONS,
  LEGACY_ITEM_RANGES,
  type LegacyChest,
  type LegacyEffect,
  type LegacyProgress,
  legacyItem,
  NOT_ON_THE_OLD_MAP,
} from "./legacy";
export {
  type ItemMatch,
  LOCATION_KINDS,
  type LocationDef,
  type LocationFill,
  type LocationKind,
  locationId,
  locationKind,
  type Refusal,
  type Source,
  type Visible,
} from "./location";
export {
  LEGACY_CHEST_POSITIONS,
  LEGACY_DUNGEON_POSITIONS,
  MARKED_DUNGEONS,
  MARKERS,
  type MapMarker,
  type MarkerStatus,
  markerStatus,
} from "./markers";
export {
  MEDALLION_FACTS,
  MEDALLION_RULES,
  MEDALLIONS,
  type Medallion,
  medallionFacts,
  PADS,
  type Pad,
  type PadKnowledge,
  padsFromUpstream,
} from "./medallions";
export { compile, regionModules, STATE_NAMES, world } from "./pack";
export { NAMED_RULES, RULES } from "./rules";
export {
  type AlttprSettings,
  type Mode,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UPSTREAM_TEST,
  type UpstreamConfig,
} from "./settings";
export {
  EMPTY_INPUT,
  INVENTORY_ITEM_IDS,
  type InventoryItemId,
  PRIZES,
  type Prize,
  type TrackerInput,
  toState,
} from "./tracker";
export {
  buildWorld,
  canFill,
  type DungeonItemClass,
  dungeonItemClass,
  type Entrance,
  type RegionDef,
  type RegionItems,
  type RegionModule,
  refuseKeptDungeonItems,
  regionId,
  START,
} from "./world";
export { OPEN_REGIONS } from "./worlds/open";
export { STANDARD_REGIONS } from "./worlds/standard";

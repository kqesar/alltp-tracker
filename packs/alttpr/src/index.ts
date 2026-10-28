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
  type ChestSpot,
  chargeOf,
  type DarkRoomReading,
  decodeDarkRoom,
  type Facing,
  facingOf,
  type LinkPlace,
  ROOM_TILES,
  SPIN_READY,
  type SwordCharge,
  TILE,
  type TileBox,
  type TileKind,
} from "./autotrack/dark-room";
// The ROM layout the picture is read through: tests lay out synthetic ROMs
// with it
export {
  ART_ROM,
  AUX_ROWS,
  GUARD,
  MAIN_ROWS,
  ROOM_PX,
  SHEETS,
  type SpriteImage,
} from "./autotrack/dark-room-art";
export {
  ART_RANGES,
  ART_RETRY_MS,
  type ArtFailure,
  type ArtOutcome,
  type ArtRead,
  createArtLoader,
  type DarkRoomArt,
} from "./autotrack/dark-room-art-loader";
export {
  type BossDungeon,
  type CheckReading,
  type DecodeOptions,
  decodeChecks,
  decodeEntrances,
  decodeHealth,
  decodeItems,
  decodePrizesHeld,
  decodeProgress,
  type EntranceLink,
  type EntranceReading,
  type Fact,
  FRAMES_PER_SECOND,
  type HealthReading,
  type ItemReading,
  type MemoryView,
  type PrizesHeldReading,
  type ProgressReading,
  playTimeMs,
  type RomStats,
  type Unsettled,
} from "./autotrack/decode";
export {
  decodeMedallions,
  type MedallionReading,
  type MedallionShownBy,
  type ShownMedallion,
} from "./autotrack/medallion-pads";
export {
  type AlttprRange,
  DARK_ROOM_ART_SWITCH,
  DARK_ROOM_SWITCH,
  MEMORY_RANGE,
  MEMORY_RANGES,
  MEMORY_SOURCES,
  type MemoryRangeId,
} from "./autotrack/memory";
export { ALTTPR_AUTOTRACK } from "./autotrack/pack";
export {
  decodePrizes,
  type PrizeDungeon,
  type PrizeReading,
  type PrizeShownBy,
  type ShownPrize,
} from "./autotrack/prizes";
export {
  ALTTPR_GAME_CHECK,
  ALTTPR_RACE_FLAG,
  checkGame,
  type GameCheckCode,
  probeRaceFlag,
  type RaceFlagProbeResult,
} from "./autotrack/probes";
export { ALTTPR_RACE_PROFILE } from "./autotrack/race-profile";
export {
  decodeSeedSettings,
  SEED_SETTINGS_RANGES,
  type SeedAccessibility,
  type SeedEntrances,
  type SeedGoal,
  type SeedItemFunctionality,
  type SeedItemPlacement,
  type SeedItemPool,
  type SeedLogic,
  type SeedMode,
  type SeedSetting,
  type SeedSettingsRangeId,
  type SeedSettingsReading,
  type SeedUnknown,
} from "./autotrack/seed-settings";
export { BOSS_SLOTS, BOSSES } from "./bosses";
export {
  DERIVED,
  DERIVED_FACTS,
  type DerivedFact,
  derivedFacts,
} from "./derived";
export {
  bossLocation,
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
  type CrossedPool,
  crossedPool,
  ENTRANCES,
  type EntranceTarget,
  entranceNamed,
  erLocationId,
  type GameLink,
  labelOf,
  linksOf,
  type OverworldEntrance,
  PLACE_OF_LOCATION,
  TARGETS,
  targetNamed,
} from "./entrances";
export {
  analyzeFacts,
  crossedConnections,
  type ErConnections,
  type ErOptions,
  type ErWorld,
  erWorld,
  mandatoryConnections,
  solveFacts,
  solveFactsState,
  vanillaConnections,
} from "./er-world";
export {
  EVENT_LOCATIONS,
  type Filler,
  filler,
  matches,
  PRIZE_ITEMS,
} from "./fill";
export {
  GO_MODES,
  type GoMode,
  type GoModeStatus,
  type GoStep,
  goModeBlockers,
  goModeOf,
  goModeStatus,
  goModeStatusBy,
  joinBlockers,
  type LocationSolution,
} from "./goals";
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
  withUntracked,
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
  compileMargin,
  isMarginGate,
  MARGIN_ITEM,
  MARGIN_STATE,
  marginFiller,
  marginModules,
  marginRequirement,
} from "./margin";
export { type MarkerStatus, markerStatus } from "./marker-status";
export {
  INVERTED_MARKERS,
  LEGACY_CHEST_POSITIONS,
  LEGACY_DUNGEON_POSITIONS,
  MAP_LOCATIONS,
  MARKED_DUNGEONS,
  MARKERS,
  type MapMarker,
  markersOf,
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
export { RUPEE_COSTS, type RupeeCost, rupeeCostOf } from "./rupee-costs";
export { seedFileReading } from "./seed-file";
export { seedFileUrl, seedHashOf } from "./seed-link";
export {
  type AlttprSettings,
  type Mode,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UNKNOWN,
  UPSTREAM_TEST,
  type UpstreamConfig,
} from "./settings";
export { fileFacts, hashInName, parseSpoiler } from "./spoiler/parse";
export type {
  AlttprSpoilerExtra,
  AlttprSpoilerLog,
  SpoilerShop,
} from "./spoiler/read";
export {
  EMPTY_INPUT,
  EVENT_CHECKS,
  type HeldPrize,
  INVENTORY_ITEM_IDS,
  type InventoryItemId,
  PRIZES,
  type Prize,
  type TrackerInput,
  toState,
} from "./tracker";
export {
  compileTricks,
  TRICK_IDS,
  TRICK_ITEMS,
  TRICK_RULES,
  TRICKS,
  type TrickDef,
  type TrickId,
  trickFiller,
  trickModules,
  trickRequirement,
  trickState,
} from "./tricks";
export {
  type CountKnowledge,
  UNKNOWN_COUNT_FACTS,
  UNKNOWN_COUNTS,
  UNKNOWN_FACT_OF,
  type UnknownCount,
  unknownCountFacts,
  unknownCountRequirement,
} from "./unknown-counts";
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
export { INVERTED_REGIONS } from "./worlds/inverted";
export { OPEN_REGIONS } from "./worlds/open";
export { STANDARD_REGIONS } from "./worlds/standard";

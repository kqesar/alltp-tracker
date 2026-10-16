// Public entry point of @alltp/autotrack. The README is the design document.
export {
  bus,
  busRange,
  busToPak,
  hex,
  type MemoryMapping,
  PAK,
  PAK_REGIONS,
  type PakRegion,
  type PakRegionName,
  pakRegion,
  pakToBus,
} from "./address";
export {
  DefinitionError,
  RaceViolationError,
  TransportError,
  type TransportErrorCode,
  type TransportOperation,
} from "./errors";
export {
  type AutotrackPack,
  type AutotrackPackSource,
  definePack,
  type GameCheck,
  type GameCheckResult,
  type RaceFlagProbe,
  type RaceFlagReading,
  type RangeSpec,
} from "./pack";
export {
  type ByteRange,
  type PlannedRequest,
  type PlanOptions,
  planPieces,
  planReads,
  type ReadLimits,
  type ReadPlan,
  USB2SNES_LIMITS,
} from "./plan";
export type {
  Clock,
  Visibility,
  WebSocketFactory,
  WebSocketLike,
} from "./platform";
export {
  assertRaceSafe,
  defineRaceProfile,
  type RaceCategory,
  type RaceFlagSpec,
  type RaceProfile,
} from "./race";
export {
  type RaceFlagState,
  type RaceSetting,
  type RaceStatus,
  raceStatus,
} from "./race-mode";
export type { MemorySnapshot, PollUpdate } from "./scheduler";
export type {
  BridgeInfo,
  BridgeKind,
  DeviceDescriptor,
  DeviceInfo,
  DeviceKind,
  Transport,
} from "./transport";
export {
  DEFAULT_USB2SNES_URL,
  deviceKind,
  type Usb2SnesOptions,
  Usb2SnesTransport,
} from "./usb2snes";

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
  classifyReadFailure,
  type Evidence,
  isOriginRefusal,
  type Remedy,
  SESSION_CODES,
  type SessionCode,
  type SessionStatus,
  type UnreadableCause,
} from "./diagnostics";
export {
  type BrowserFamily,
  type CpuArchitecture,
  detectEnvironment,
  type Environment,
  type LoopbackAccess,
  loopbackAccess,
  type NavigatorLike,
  type OperatingSystem,
  parseUserAgent,
} from "./environment";
export {
  DefinitionError,
  RaceViolationError,
  TransportError,
  type TransportErrorCode,
  type TransportOperation,
} from "./errors";
export { FirstAnsweringTransport } from "./first-answering";
export {
  ARCHIPELAGO_ROM,
  type AutotrackPack,
  type AutotrackPackSource,
  definePack,
  type GameCheck,
  type GameCheckResult,
  type ModeProbe,
  type RaceFlagProbe,
  type RaceFlagReading,
  type RangeSpec,
} from "./pack";
export {
  LOCAL_NETWORK_PERMISSION_NAMES,
  type LocalNetworkPermission,
  type PermissionState,
  systemPermission,
} from "./permission";
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
export { describeStatus, diagnosticReport, type ReportInput } from "./report";
export {
  parseStatus,
  RETROARCH_DEVICE,
  RETROARCH_LIMITS,
  RETROARCH_URL,
  type RetroArchOptions,
  type RetroArchSend,
  type RetroArchStatus,
  type RetroArchTimeouts,
  RetroArchTransport,
} from "./retroarch";
export type { MemorySnapshot, PollUpdate } from "./scheduler";
export {
  AutotrackSession,
  type BackoffOptions,
  backoffDelay,
  DEFAULT_BACKOFF,
  type SessionOptions,
} from "./session";
export {
  desktopSetupSteps,
  SETUP_STEPS,
  type SetupCondition,
  type SetupLink,
  type SetupProgress,
  type SetupStep,
  type SetupStepId,
  type SetupVariant,
  SNI_ASSETS,
  SNI_LATEST_KNOWN,
  SNI_RELEASES,
  type StepProgress,
  type StepState,
  setupProgress,
  sniAssets,
  statusKeys,
} from "./setup";
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
export { AUTOTRACK_VERSION } from "./version";

// @alltp/pack-smz3: SMZ3 as samus.link generates it, both games' logic as
// data over the engine, held to upstream's logic tests (README.md).
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
export {
  type Entrance,
  type LocationDef,
  locationId,
  type RegionDef,
  type RegionModule,
  regionId,
  START,
} from "./world";

// Public entry point of @alltp/pack-alttpr: the app imports the pack from
// here only, as it does the engine.
export { ALTTPR_RACE_PROFILE } from "./autotrack/race-profile";
export { BOSS_SLOTS, BOSSES } from "./bosses";
export {
  DERIVED,
  DERIVED_FACTS,
  type DerivedFact,
  derivedFacts,
} from "./derived";
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
  LOCATION_KINDS,
  type LocationDef,
  type LocationKind,
  locationId,
  locationKind,
  type Source,
  type Visible,
} from "./location";
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
  buildWorld,
  canFill,
  type DungeonItemClass,
  dungeonItemClass,
  type Entrance,
  type RegionDef,
  type RegionItems,
  type RegionModule,
  regionId,
  START,
} from "./world";
export { OPEN_REGIONS } from "./worlds/open";
export { STANDARD_REGIONS } from "./worlds/standard";

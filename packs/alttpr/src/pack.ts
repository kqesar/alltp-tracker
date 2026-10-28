// The pack as the tracker runs it: the world of a run's settings, compiled
// once, then solved on every change of the items.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type World,
} from "@alltp/engine";
import { DERIVED_FACTS } from "./derived";
import { ITEM_IDS } from "./items";
import { MEDALLION_FACTS } from "./medallions";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";
import { UNKNOWN_COUNT_FACTS } from "./unknown-counts";
import { buildWorld, type RegionModule } from "./world";
import { INVERTED_REGIONS } from "./worlds/inverted";
import { OPEN_REGIONS } from "./worlds/open";
import { STANDARD_REGIONS } from "./worlds/standard";

/**
 * Every name a requirement may read from the state: the items, the
 * medallion facts, the facts derived from the items and those of the counts
 * not known. Anything that compiles a world of this pack takes its item list
 * from here.
 */
export const STATE_NAMES: readonly string[] = [
  ...ITEM_IDS,
  ...MEDALLION_FACTS,
  ...DERIVED_FACTS,
  ...UNKNOWN_COUNT_FACTS,
];

/** The region modules of the run's world: Standard's, Open's or Inverted's. */
export function regionModules(
  settings: AlttprSettings,
): readonly RegionModule[] {
  if (settings.invertedMode) return INVERTED_REGIONS;
  return settings.standardMode ? STANDARD_REGIONS : OPEN_REGIONS;
}

/** The engine's graph of the run's world. */
export function world(settings: AlttprSettings): World {
  return buildWorld(regionModules(settings));
}

/**
 * The run's world, compiled with its settings and checked against the item
 * list, the medallion facts and the derived facts: about a millisecond, once
 * per run or settings change. Throws a DefinitionError if the pack does not
 * hold together.
 */
export function compile(settings: AlttprSettings): CompiledWorld {
  return compileWorld(world(settings), loadRules(RULES), {
    items: STATE_NAMES,
    settings,
  });
}

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
import { buildWorld, type RegionModule } from "./world";
import { OPEN_REGIONS } from "./worlds/open";
import { STANDARD_REGIONS } from "./worlds/standard";

/** The region modules of the run's world: Standard's or Open's. */
export function regionModules(
  settings: AlttprSettings,
): readonly RegionModule[] {
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
    items: [...ITEM_IDS, ...MEDALLION_FACTS, ...DERIVED_FACTS],
    settings,
  });
}

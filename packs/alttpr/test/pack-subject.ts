// The pack as the subject of the upstream contract: what it answers for
// each kind of case, in the world the case's test class builds. The runner
// turns the case's items into a state (upstream-state.ts); this maps the
// world: its mode and config become the pack's settings, and the world is
// compiled once per distinct settings.
//
// `fill` (Location::canFill, with the always-allow and fill rules) is not
// answered yet: it waits for src/fill.ts and the key model, since placing a
// key is what it asks about. The runner counts those cases as skipped.
import { type CompiledWorld, solve, type Tri } from "@alltp/engine";
import { locationId } from "../src/location";
import { compile, regionModules } from "../src/pack";
import { type AlttprSettings, settingsFromUpstream } from "../src/settings";
import { canFill, type RegionDef, regionId } from "../src/world";
import type { CaseWorld, ContractSubject } from "./contract";

const worlds = new Map<string, CompiledWorld>();

function settingsOf(world: CaseWorld): AlttprSettings {
  return settingsFromUpstream(world.mode, world.config);
}

function compiled(world: CaseWorld): CompiledWorld {
  // Medallions placed at the Misery Mire and Turtle Rock pads are knowledge
  // the state must carry; until a port models them, a case placing one
  // cannot be answered
  const placed = Object.keys(world.locationItems);
  if (placed.length > 0) {
    throw new Error(`Placed items are not modeled yet: ${placed.join(", ")}`);
  }
  const settings = settingsOf(world);
  const key = JSON.stringify(settings);
  let found = worlds.get(key);
  if (found === undefined) {
    found = compile(settings);
    worlds.set(key, found);
  }
  return found;
}

/** The region upstream names `name` (a key of World/Standard.php). */
function regionNamed(name: string, settings: AlttprSettings): RegionDef {
  const region = regionModules(settings)
    .flatMap((module) => module.regions)
    .find((r) => r.name === name);
  if (region === undefined) throw new RangeError(`No region "${name}"`);
  return region;
}

export const PACK: ContractSubject = {
  location: (name, state, world) =>
    solve(compiled(world), state).location(locationId(name)),

  // Region::canComplete: the prize location's rule, or true for a region
  // with no can_complete (Region.php:201-207)
  regionComplete: (name, state, world): Tri => {
    const prize = regionNamed(name, settingsOf(world)).prize;
    return prize === undefined
      ? "yes"
      : solve(compiled(world), state).location(prize);
  },

  regionEnter: (name, state, world) =>
    solve(compiled(world), state).region(regionId(name)),

  regionFill: (name, item, world) => {
    const settings = settingsOf(world);
    return canFill(regionNamed(name, settings), item, settings) ? "yes" : "no";
  },
};

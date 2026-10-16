// The pack as the subject of the upstream contract: what it answers for
// each kind of case, in the world the case's test class builds. The runner
// turns the case's items into a state (upstream-state.ts); this maps the
// world: its mode and config become the pack's settings, and the world is
// compiled once per distinct settings.
//
// `fill` (Location::canFill, with the always-allow and fill rules) is not
// answered yet: it waits for src/fill.ts and the key model, since placing a
// key is what it asks about. The runner counts those cases as skipped.
import { type CompiledWorld, type State, solve, type Tri } from "@alltp/engine";
import { derivedFacts } from "../src/derived";
import { locationId } from "../src/location";
import { medallionFacts, padsFromUpstream } from "../src/medallions";
import { compile, regionModules } from "../src/pack";
import { type AlttprSettings, settingsFromUpstream } from "../src/settings";
import { canFill, type RegionDef, regionId } from "../src/world";
import type { CaseWorld, ContractSubject } from "./contract";

const worlds = new Map<string, CompiledWorld>();

function settingsOf(world: CaseWorld): AlttprSettings {
  return settingsFromUpstream(world.mode, world.config);
}

function compiled(world: CaseWorld): CompiledWorld {
  const settings = settingsOf(world);
  const key = JSON.stringify(settings);
  let found = worlds.get(key);
  if (found === undefined) {
    found = compile(settings);
    worlds.set(key, found);
  }
  return found;
}

/**
 * The case's state, with what its world placed at the medallion pads as the
 * knowledge the pack reads (medallions.ts), and the facts its items give
 * under its world's settings (derived.ts). Any other placement throws.
 */
const withFacts = (state: State, world: CaseWorld): State => ({
  ...state,
  ...medallionFacts(padsFromUpstream(world.locationItems)),
  ...derivedFacts(state, settingsOf(world)),
});

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
    solve(compiled(world), withFacts(state, world)).location(locationId(name)),

  // Region::canComplete: the prize location's rule, or true for a region
  // with no can_complete (Region.php:201-207)
  regionComplete: (name, state, world): Tri => {
    const prize = regionNamed(name, settingsOf(world)).prize;
    return prize === undefined
      ? "yes"
      : solve(compiled(world), withFacts(state, world)).location(prize);
  },

  regionEnter: (name, state, world) =>
    solve(compiled(world), withFacts(state, world)).region(regionId(name)),

  regionFill: (name, item, world) => {
    const settings = settingsOf(world);
    return canFill(regionNamed(name, settings), item, settings) ? "yes" : "no";
  },
};

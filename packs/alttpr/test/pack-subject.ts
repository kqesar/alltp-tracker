// The pack as the subject of the upstream contract: what it answers for
// each kind of case, in the world the case's test class builds. The runner
// turns the case's items into a state (upstream-state.ts); this maps the
// world: its mode and config become the pack's settings, and the world is
// compiled once per distinct settings.
import { type CompiledWorld, type State, solve, type Tri } from "@alltp/engine";
import { derivedFacts } from "../src/derived";
import { type Filler, filler } from "../src/fill";
import { locationId } from "../src/location";
import { medallionFacts, padsFromUpstream } from "../src/medallions";
import { compile, regionModules } from "../src/pack";
import { type AlttprSettings, settingsFromUpstream } from "../src/settings";
import { canFill, type RegionDef, regionId } from "../src/world";
import type { CaseWorld, ContractSubject } from "./contract";

const worlds = new Map<string, { compiled: CompiledWorld; filler: Filler }>();

function settingsOf(world: CaseWorld): AlttprSettings {
  return settingsFromUpstream(world.mode, world.config);
}

function built(world: CaseWorld) {
  const settings = settingsOf(world);
  const key = JSON.stringify(settings);
  let found = worlds.get(key);
  if (found === undefined) {
    const world = compile(settings);
    found = { compiled: world, filler: filler(world, settings) };
    worlds.set(key, found);
  }
  return found;
}

const compiled = (world: CaseWorld): CompiledWorld => built(world).compiled;

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
  // Location::fill: place the item, then Location::canFill (src/fill.ts)
  fill: (name, item, state, world) =>
    built(world).filler.canFill(
      locationId(name),
      item,
      withFacts(state, world),
    ),

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

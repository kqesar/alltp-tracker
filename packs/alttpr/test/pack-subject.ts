// The pack as the subject of the upstream contract: what it answers for
// each kind of case, in the world the case's test class builds. The runner
// turns the case's items into a state (upstream-state.ts); this maps the
// world: its mode and config become the pack's settings, and the world is
// compiled once per distinct settings.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type RulesSource,
  type State,
  solve,
  type Tri,
} from "@alltp/engine";
import { derivedFacts } from "../src/derived";
import { type Filler, filler } from "../src/fill";
import { locationId } from "../src/location";
import { medallionFacts, padsFromUpstream } from "../src/medallions";
import { regionModules, STATE_NAMES, world as worldOf } from "../src/pack";
import { RULES } from "../src/rules";
import { type AlttprSettings, settingsFromUpstream } from "../src/settings";
import { canFill, type RegionDef, regionId } from "../src/world";
import type { CaseWorld, ContractSubject } from "./contract";

const worlds = new Map<string, { compiled: CompiledWorld; filler: Filler }>();

function settingsOf(world: CaseWorld): AlttprSettings {
  return settingsFromUpstream(world.mode, world.config);
}

/**
 * The pack's rules, with the bosses a test class sets: "Dummy Boss" has no
 * rule, so it is always beaten (Boss.php:142-146, 177-184), and its
 * region's boss slot (bosses.ts) is `true`. No other swap is modeled.
 */
function rulesWith(bosses: Readonly<Record<string, string>>): RulesSource {
  const helpers = { ...RULES.helpers };
  for (const [region, boss] of Object.entries(bosses)) {
    const id = regionId(region);
    const slot = `canBeat${id.charAt(0).toUpperCase()}${id.slice(1)}Boss`;
    if (boss !== "Dummy Boss" || helpers[slot] === undefined) {
      throw new RangeError(`No ${boss} in ${region}`);
    }
    helpers[slot] = "true";
  }
  return { ...RULES, helpers };
}

function built(world: CaseWorld) {
  const settings = settingsOf(world);
  const bosses = world.bosses ?? {};
  const key = JSON.stringify([settings, bosses]);
  let found = worlds.get(key);
  if (found === undefined) {
    const compiled = compileWorld(
      worldOf(settings),
      loadRules(rulesWith(bosses)),
      {
        items: STATE_NAMES,
        settings,
      },
    );
    found = { compiled, filler: filler(compiled, settings) };
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

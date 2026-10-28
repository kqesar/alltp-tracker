// A world of the run whose every rule is read through a rewrite: the tricks
// world (tricks.ts) and the world without basic placement's safety margin
// (margin.ts). Each adds items a state may hold (a trick, the margin), and
// with them at 0 reads as the real world. Its fill rules are the real
// world's: the seed was placed under them, so where an item may sit does
// not move.
import {
  type CompiledWorld,
  compileWorld,
  loadRules,
  type RulesSource,
} from "@alltp/engine";
import { type Filler, filler } from "./fill";
import type { LocationDef } from "./location";
import { regionModules, STATE_NAMES } from "./pack";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";
import { buildWorld, type RegionDef, type RegionModule } from "./world";

/**
 * Where a rule sits, for a rewrite that depends on it: a region's (its
 * entrances', its locations', what seeing them needs) or a named rule's.
 */
export type RuleSite =
  | { readonly region: string }
  | { readonly helper: string };

/** A world of the run, its rules read through one rewrite. */
export interface RewrittenWorld {
  /**
   * The region modules of the run's world, every rule rewritten: the
   * entrances', the locations' and what seeing a location needs.
   */
  readonly modules: (settings: AlttprSettings) => readonly RegionModule[];
  /** The pack's named rules, rewritten. */
  readonly rules: RulesSource;
  /** The world compiled with the run's settings: once per settings object. */
  readonly compile: (settings: AlttprSettings) => CompiledWorld;
  /** Its key model's filler (`solveWithKeys`): once per settings object. */
  readonly filler: (settings: AlttprSettings) => Filler;
}

/**
 * The run's worlds with every rule read through `requirement`, which
 * returns a rule it leaves alone as it is (the same string), and the
 * items it adds to STATE_NAMES.
 */
export function rewrittenWorld(
  requirement: (req: string, site: RuleSite) => string,
  items: readonly string[],
): RewrittenWorld {
  const location = (def: LocationDef, site: RuleSite): LocationDef => {
    const req = requirement(def.req, site);
    const visible = def.visible;
    const seen =
      visible?.req === undefined ? undefined : requirement(visible.req, site);
    if (req === def.req && seen === visible?.req) return def;
    return {
      ...def,
      req,
      ...(visible === undefined ? {} : { visible: { ...visible, req: seen } }),
    };
  };
  const region = (def: RegionDef): RegionDef => {
    const site = { region: def.id };
    return {
      ...def,
      entrances: def.entrances.map((entrance) => ({
        ...entrance,
        req: requirement(entrance.req, site),
      })),
      locations: def.locations.map((each) => location(each, site)),
    };
  };

  const rewritten = new WeakMap<
    readonly RegionModule[],
    readonly RegionModule[]
  >();
  const modules = (settings: AlttprSettings): readonly RegionModule[] => {
    const real = regionModules(settings);
    let found = rewritten.get(real);
    if (found === undefined) {
      found = real.map((module) => ({
        ...module,
        regions: module.regions.map(region),
      }));
      rewritten.set(real, found);
    }
    return found;
  };

  const rules: RulesSource = {
    ...RULES,
    helpers: Object.fromEntries(
      Object.entries(RULES.helpers ?? {}).map(([name, req]) => [
        name,
        requirement(req, { helper: name }),
      ]),
    ),
  };

  const compiled = new WeakMap<AlttprSettings, CompiledWorld>();
  const compile = (settings: AlttprSettings): CompiledWorld => {
    let found = compiled.get(settings);
    if (found === undefined) {
      found = compileWorld(buildWorld(modules(settings)), loadRules(rules), {
        items: [...STATE_NAMES, ...items],
        settings,
      });
      compiled.set(settings, found);
    }
    return found;
  };

  const fillers = new WeakMap<AlttprSettings, Filler>();
  return {
    compile,
    filler: (settings) => {
      let found = fillers.get(settings);
      if (found === undefined) {
        found = filler(compile(settings), settings, modules(settings));
        fillers.set(settings, found);
      }
      return found;
    },
    modules,
    rules,
  };
}

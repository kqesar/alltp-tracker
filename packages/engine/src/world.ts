import { type Compiled, Compiler } from "./compile";
import {
  checkReferences,
  DefinitionError,
  NO_RULES,
  parseIn,
  type Rules,
} from "./rules";
import { foldRules, foldSettings, type Settings } from "./settings";
import { YES } from "./tri";

/** A one-way connection; a two-way passage is two exits. */
export interface Exit {
  readonly to: string;
  /** Requirement to take it; `true` when omitted. */
  readonly req?: string;
}

/** Something to collect: a chest, an NPC, a boss prize. */
export interface Location {
  /** Unique across the whole world. */
  readonly id: string;
  /** Requirement once in the region; `true` when omitted. */
  readonly req?: string;
}

export interface Region {
  readonly id: string;
  readonly exits?: readonly Exit[];
  readonly locations?: readonly Location[];
}

/**
 * A game (or one mode of it) as a graph: regions joined by exits that carry
 * requirements, and locations inside regions. The player starts in `start`;
 * a game with several spawn points starts in a region with an exit to each.
 */
export interface World {
  readonly regions: readonly Region[];
  readonly start: string;
}

export interface CompileOptions {
  /**
   * Every item id the game knows. When given, a requirement, helper or group
   * naming any other item is a DefinitionError: usually a typo, which would
   * otherwise silently read as "never collected".
   */
  readonly items?: Iterable<string>;
  /**
   * The run's settings. Every setting a requirement or helper uses must be
   * here with the right type (a boolean for `setting(name)`, a non-negative
   * integer for `>= setting(name)`), or it is a DefinitionError. They are
   * folded into the requirements before anything is compiled, so a solve
   * never reads them.
   */
  readonly settings?: Settings;
}

/**
 * A world compiled for solving. `regionIds`, `locationIds` and `items` are
 * for consumers; the rest is the solver's internal layout (regions, exits and
 * locations as index arrays, exits and locations of region `r` at offsets
 * `[offsets[r], offsets[r + 1])`), not an API.
 */
export interface CompiledWorld {
  readonly regionIds: readonly string[];
  /** Grouped by region, in the order the world lists them. */
  readonly locationIds: readonly string[];
  /** Every item the requirements read, helpers and groups included. */
  readonly items: readonly string[];
  readonly start: number;
  readonly helperCount: number;
  readonly regionIndex: ReadonlyMap<string, number>;
  readonly locationIndex: ReadonlyMap<string, number>;
  readonly exitOffsets: Int32Array;
  readonly exitTargets: Int32Array;
  readonly exitReqs: readonly Compiled[];
  readonly locationOffsets: Int32Array;
  readonly locationReqs: readonly Compiled[];
}

const ALWAYS: Compiled = () => YES;

/**
 * Checks and compiles a world once per game and settings; `solve` then runs
 * on it for every state. Throws a DefinitionError for a duplicate region or
 * location id, an exit to an unknown region, an unknown start, a requirement
 * that does not parse (naming the exit or location), a reference the rules
 * cannot resolve, or a setting missing from `options.settings`.
 *
 * Names are checked on the requirements as written, so a typo in a branch
 * that the settings switch off is still an error. Then every setting is
 * folded to a constant (`foldSettings`), helpers included, and only the
 * folded requirements are compiled.
 */
export function compileWorld(
  world: World,
  rules: Rules = NO_RULES,
  options: CompileOptions = {},
): CompiledWorld {
  const items =
    options.items === undefined ? undefined : new Set(options.items);
  if (items !== undefined) checkRulesItems(rules, items);
  const settings = options.settings ?? {};
  const foldedRules = foldRules(rules, settings);

  const regionIndex = new Map<string, number>();
  for (const region of world.regions) {
    if (regionIndex.has(region.id)) {
      throw new DefinitionError(`Duplicate region "${region.id}"`);
    }
    regionIndex.set(region.id, regionIndex.size);
  }
  const start = regionIndex.get(world.start);
  if (start === undefined) {
    throw new DefinitionError(`Start region "${world.start}" does not exist`);
  }

  const compiler = new Compiler(foldedRules);
  // Packs repeat requirements a lot: each distinct text compiles once.
  const cache = new Map<string, Compiled>();
  const compileReq = (req: string | undefined, where: string): Compiled => {
    if (req === undefined) return ALWAYS;
    let compiled = cache.get(req);
    if (compiled === undefined) {
      const expr = parseIn(req, where);
      checkReferences(expr, rules, where, items);
      compiled = compiler.compile(foldSettings(expr, settings, where));
      cache.set(req, compiled);
    }
    return compiled;
  };

  const regionCount = world.regions.length;
  const exitOffsets = new Int32Array(regionCount + 1);
  const exitTargets: number[] = [];
  const exitReqs: Compiled[] = [];
  const locationOffsets = new Int32Array(regionCount + 1);
  const locationIds: string[] = [];
  const locationIndex = new Map<string, number>();
  const locationReqs: Compiled[] = [];
  const locationRegion: string[] = [];

  world.regions.forEach((region, r) => {
    for (const exit of region.exits ?? []) {
      const target = regionIndex.get(exit.to);
      if (target === undefined) {
        throw new DefinitionError(
          `Region "${region.id}" has an exit to unknown region "${exit.to}"`,
        );
      }
      exitTargets.push(target);
      exitReqs.push(
        compileReq(exit.req, `Exit "${region.id}" -> "${exit.to}"`),
      );
    }
    exitOffsets[r + 1] = exitTargets.length;

    for (const location of region.locations ?? []) {
      const seen = locationIndex.get(location.id);
      if (seen !== undefined) {
        throw new DefinitionError(
          `Duplicate location "${location.id}" (regions "${locationRegion[seen]}" and "${region.id}")`,
        );
      }
      locationIndex.set(location.id, locationIds.length);
      locationIds.push(location.id);
      locationRegion.push(region.id);
      locationReqs.push(compileReq(location.req, `Location "${location.id}"`));
    }
    locationOffsets[r + 1] = locationIds.length;
  });

  return {
    exitOffsets,
    exitReqs,
    exitTargets: Int32Array.from(exitTargets),
    helperCount: compiler.helperCount,
    items: compiler.items,
    locationIds,
    locationIndex,
    locationOffsets,
    locationReqs,
    regionIds: world.regions.map((region) => region.id),
    regionIndex,
    start,
  };
}

/** With a known item list, helpers and groups must stick to it as well. */
function checkRulesItems(rules: Rules, items: ReadonlySet<string>): void {
  for (const [name, members] of rules.groups) {
    for (const member of members) {
      if (!items.has(member)) {
        throw new DefinitionError(
          `Group "${name}" has unknown item "${member}"`,
        );
      }
    }
  }
  for (const [name, expr] of rules.helpers) {
    checkReferences(expr, rules, `Helper "@${name}"`, items);
  }
}

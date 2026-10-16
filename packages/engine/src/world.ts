import type { Expr } from "./ast";
import { type Compiled, Compiler } from "./compile";
import {
  checkReferences,
  DefinitionError,
  findReach,
  NO_RULES,
  parseIn,
  type Rules,
} from "./rules";
import { foldRules, foldSettings, type Settings } from "./settings";
import { YES } from "./tri";

/** A one-way connection; a two-way passage is two exits. */
export interface Exit {
  readonly to: string;
  /**
   * Requirement to take it; `true` when omitted. It cannot use `reach()`,
   * directly or through a helper (see the README).
   */
  readonly req?: string;
}

/**
 * Where a location's contents can be seen before they can be collected: the
 * Bumper Cave ledge from below, the Ether tablet read with the Book.
 */
export interface Visibility {
  /** The region to see it from; the location's own region when omitted. */
  readonly from?: string;
  /** What seeing it needs once there; `true` when omitted. */
  readonly req?: string;
}

/** Something to collect: a chest, an NPC, a boss prize. */
export interface Location {
  /** Unique across the whole world. */
  readonly id: string;
  /**
   * Requirement once in the region; `true` when omitted. It may use
   * `reach(region)` for a location that also needs another region reached.
   */
  readonly req?: string;
  /**
   * When its contents can be seen without collecting them: solved into
   * `Solution.visible()`, beside the location's availability. Its `req` may
   * use `reach()` too.
   */
  readonly visible?: Visibility;
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
 * for consumers; the rest is the internal layout of the solver, `explain()`
 * and `analyze()` (regions, exits and locations as index arrays, exits and
 * locations of region `r` at offsets `[offsets[r], offsets[r + 1])`), not an
 * API.
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
  /** The rules with the run's settings folded in. */
  readonly rules: Rules;
  readonly exitOffsets: Int32Array;
  readonly exitSources: Int32Array;
  readonly exitTargets: Int32Array;
  readonly exitReqs: readonly Compiled[];
  /** Each exit's folded requirement (`true` where the world gave none). */
  readonly exitExprs: readonly Expr[];
  readonly locationOffsets: Int32Array;
  readonly locationRegions: Int32Array;
  readonly locationReqs: readonly Compiled[];
  /** Each location's folded requirement (`true` where the world gave none). */
  readonly locationExprs: readonly Expr[];
  /** Locations with a `visible` entry, by location index... */
  readonly visibleLocations: Int32Array;
  /** ...the region index each is seen from... */
  readonly visibleFrom: Int32Array;
  /** ...and what seeing it needs, all three in the same order. */
  readonly visibleReqs: readonly Compiled[];
}

/** A requirement compiled once per distinct text. */
interface Entry {
  readonly compiled: Compiled;
  /** The requirement with the settings folded in. */
  readonly expr: Expr;
}

const ALWAYS: Entry = {
  compiled: () => YES,
  expr: { type: "const", value: "yes" },
};

/**
 * Checks and compiles a world once per game and settings; `solve` then runs
 * on it for every state. Throws a DefinitionError for a duplicate region or
 * location id, an exit to an unknown region, an unknown start, a requirement
 * that does not parse (naming the exit or location), a reference the rules
 * cannot resolve, a `reach()` of an unknown region or in an exit, or a
 * setting missing from `options.settings`.
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

  const items =
    options.items === undefined ? undefined : new Set(options.items);
  checkRules(rules, items, regionIndex);
  const settings = options.settings ?? {};
  const foldedRules = foldRules(rules, settings);

  const compiler = new Compiler(foldedRules, regionIndex);
  // Packs repeat requirements a lot: each distinct text compiles once.
  const parsed = new Map<string, Expr>();
  const cache = new Map<string, Entry>();
  const reachMemo = new Map<string, readonly string[] | null>();
  const exitChecked = new Set<string>();
  const compileReq = (
    req: string | undefined,
    where: string,
    inExit = false,
  ): Entry => {
    if (req === undefined) return ALWAYS;
    let expr = parsed.get(req);
    if (expr === undefined) {
      expr = parseIn(req, where);
      parsed.set(req, expr);
    }
    if (inExit && !exitChecked.has(req)) {
      checkNoReach(expr, rules, where, reachMemo);
      exitChecked.add(req);
    }
    let entry = cache.get(req);
    if (entry === undefined) {
      checkReferences(expr, rules, where, items, regionIndex);
      const folded = foldSettings(expr, settings, where);
      entry = { compiled: compiler.compile(folded), expr: folded };
      cache.set(req, entry);
    }
    return entry;
  };

  const regionCount = world.regions.length;
  const exitOffsets = new Int32Array(regionCount + 1);
  const exitSources: number[] = [];
  const exitTargets: number[] = [];
  const exits: Entry[] = [];
  const locationOffsets = new Int32Array(regionCount + 1);
  const locationIds: string[] = [];
  const locationIndex = new Map<string, number>();
  const locationRegions: number[] = [];
  const locations: Entry[] = [];
  const visibleLocations: number[] = [];
  const visibleFrom: number[] = [];
  const visibleReqs: Compiled[] = [];

  world.regions.forEach((region, r) => {
    for (const exit of region.exits ?? []) {
      const target = regionIndex.get(exit.to);
      if (target === undefined) {
        throw new DefinitionError(
          `Region "${region.id}" has an exit to unknown region "${exit.to}"`,
        );
      }
      exitSources.push(r);
      exitTargets.push(target);
      exits.push(
        compileReq(exit.req, `Exit "${region.id}" -> "${exit.to}"`, true),
      );
    }
    exitOffsets[r + 1] = exitTargets.length;

    for (const location of region.locations ?? []) {
      const seen = locationIndex.get(location.id);
      if (seen !== undefined) {
        const first = world.regions[locationRegions[seen]].id;
        throw new DefinitionError(
          `Duplicate location "${location.id}" (regions "${first}" and "${region.id}")`,
        );
      }
      const where = `Location "${location.id}"`;
      locationIndex.set(location.id, locationIds.length);
      locationIds.push(location.id);
      locationRegions.push(r);
      locations.push(compileReq(location.req, where));

      const visible = location.visible;
      if (visible === undefined) continue;
      const from = regionIndex.get(visible.from ?? region.id);
      if (from === undefined) {
        throw new DefinitionError(
          `${where} is visible from unknown region "${visible.from}"`,
        );
      }
      visibleLocations.push(locationIds.length - 1);
      visibleFrom.push(from);
      visibleReqs.push(compileReq(visible.req, `${where} (visible)`).compiled);
    }
    locationOffsets[r + 1] = locationIds.length;
  });

  return {
    exitExprs: exits.map((exit) => exit.expr),
    exitOffsets,
    exitReqs: exits.map((exit) => exit.compiled),
    exitSources: Int32Array.from(exitSources),
    exitTargets: Int32Array.from(exitTargets),
    helperCount: compiler.helperCount,
    items: compiler.items,
    locationExprs: locations.map((location) => location.expr),
    locationIds,
    locationIndex,
    locationOffsets,
    locationRegions: Int32Array.from(locationRegions),
    locationReqs: locations.map((location) => location.compiled),
    regionIds: world.regions.map((region) => region.id),
    regionIndex,
    rules: foldedRules,
    start,
    visibleFrom: Int32Array.from(visibleFrom),
    visibleLocations: Int32Array.from(visibleLocations),
    visibleReqs,
  };
}

/**
 * Helpers and groups must stick to the item list when there is one, and a
 * helper's `reach()` must name a region of this world.
 */
function checkRules(
  rules: Rules,
  items: ReadonlySet<string> | undefined,
  regions: ReadonlyMap<string, number>,
): void {
  if (items !== undefined) {
    for (const [name, members] of rules.groups) {
      for (const member of members) {
        if (!items.has(member)) {
          throw new DefinitionError(
            `Group "${name}" has unknown item "${member}"`,
          );
        }
      }
    }
  }
  for (const [name, expr] of rules.helpers) {
    checkReferences(expr, rules, `Helper "@${name}"`, items, regions);
  }
}

/**
 * Rejects `reach()` in an exit requirement, directly or through any chain of
 * helpers: the single-pass solver evaluates each exit once, before the
 * regions it would read have their final level.
 */
function checkNoReach(
  expr: Expr,
  rules: Rules,
  where: string,
  memo: Map<string, readonly string[] | null>,
): void {
  const chain = findReach(expr, rules, memo);
  if (chain === undefined) return;
  const through =
    chain.length > 1 ? ` through ${chain.slice(0, -1).join(" -> ")}` : "";
  throw new DefinitionError(
    `${where} uses ${chain.at(-1)}${through}: reach() is allowed only in location and visible requirements`,
  );
}

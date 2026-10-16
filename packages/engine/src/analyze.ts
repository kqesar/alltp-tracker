import type { Expr, Threshold } from "./ast";
import { itemValue, type State } from "./evaluate";
import { countedItems, DefinitionError } from "./rules";
import { run, type Solved } from "./solve";
import type { Tri } from "./tri";
import type { CompiledWorld } from "./world";

/**
 * One thing to get: hold at least `min` of an item, or have `min` of a
 * group's members in all (for `count(group) >= n`, whichever members). A
 * derived fact the pack puts in the state, such as `agahnim`, is an item.
 */
export type Atom =
  | { readonly item: string; readonly min: number }
  | { readonly group: string; readonly min: number };

/**
 * What a location is waiting for. `sets` lists every minimal set of atoms
 * (at most `maxAtoms` each) that would bring it to the target, fewest atoms
 * first: `[[]]` when it is there already, `[]` when nothing within the bound
 * gets it there. `truncated` says some node had more than MAX_SETS sets:
 * some minimal sets may then be missing, and a listed set (still sufficient)
 * may not be minimal.
 */
export interface Blockers {
  readonly sets: readonly (readonly Atom[])[];
  readonly truncated: boolean;
}

export interface AnalyzeOptions {
  /** Items the player can still get; atoms are proposed only for these. */
  readonly acquirable?: (item: string) => boolean;
  /** The most atoms in one set. Defaults to 3. */
  readonly maxAtoms?: number;
  /**
   * The highest level an item can reach. Defaults to the largest of 1 and
   * every threshold an exit, location or helper requirement tests the item
   * at (`sword >= 2` makes it 2). It bounds item tests and how much a count
   * can take from one item.
   */
  readonly maxLevel?: (item: string) => number;
}

export interface Analysis {
  /**
   * Every minimal set of atoms that brings the location to `target`, for
   * the state the analysis was made for. Memoized. Throws a RangeError for
   * an unknown location or target.
   */
  blockers(locationId: string, target: "yes" | "maybe"): Blockers;
  /** The locations in logic now (`yes`), in world order. */
  doableNow(): string[];
}

const DEFAULT_MAX_ATOMS = 3;
/** The most sets one node keeps, the cheapest first. */
export const MAX_SETS = 32;
// Targets as Levels, local: Vitest makes every imported binding a getter.
const YES = 2;
const MAYBE = 1;
const LEVELS: Readonly<Record<Tri, number>> = { maybe: MAYBE, no: 0, yes: YES };

/**
 * A need: the atoms still missing, as `[variable, level, ...]` pairs sorted
 * by variable, then a signature, the OR of `1 << (variable & 31)`, that lets
 * `covers` reject most pairs at once. A variable is an item, or the count of
 * a group. Applying a need raises each of its variables to at least its
 * level. It has `need.length >> 1` atoms.
 */
type Need = readonly number[];

const bit = (variable: number): number => 1 << (variable & 31);

/**
 * A node's value: the antichain of the minimal needs that make it true, at
 * most MAX_SETS of them, each of at most maxAtoms atoms.
 */
interface Value {
  readonly sets: readonly Need[];
  readonly truncated: boolean;
}

/** The need with no atoms: already there. */
const EMPTY: Need = [0];
const TOP: Value = { sets: [EMPTY], truncated: false };
const BOTTOM: Value = { sets: [], truncated: false };
const BOTTOM_TRUNCATED: Value = { sets: [], truncated: true };

const isEmpty = (need: Need): boolean => need.length === 1;
const isTop = (value: Value): boolean =>
  value.sets.length === 1 && isEmpty(value.sets[0]);

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** `a <= b` pointwise: whatever `a` asks for, `b` asks for too, or more. */
function covers(a: Need, b: Need): boolean {
  const endA = a.length - 1;
  const endB = b.length - 1;
  if (endA > endB || (a[endA] & ~b[endB]) !== 0) return false;
  let j = 0;
  for (let i = 0; i < endA; i += 2) {
    while (j < endB && b[j] < a[i]) j += 2;
    if (j >= endB || b[j] !== a[i] || b[j + 1] < a[i + 1]) return false;
    j += 2;
  }
  return true;
}

/** The pointwise max of two needs, or null past `limit` atoms. */
function join(a: Need, b: Need, limit: number): Need | null {
  // One covering the other is common: reuse it rather than build a copy.
  if (covers(a, b)) return b;
  if (covers(b, a)) return a;
  const endA = a.length - 1;
  const endB = b.length - 1;
  const out: number[] = [];
  const max = 2 * limit;
  let i = 0;
  let j = 0;
  while (i < endA || j < endB) {
    const va = i < endA ? a[i] : Number.POSITIVE_INFINITY;
    const vb = j < endB ? b[j] : Number.POSITIVE_INFINITY;
    if (va === vb) {
      out.push(va, a[i + 1] > b[j + 1] ? a[i + 1] : b[j + 1]);
      i += 2;
      j += 2;
    } else if (va < vb) {
      out.push(va, a[i + 1]);
      i += 2;
    } else {
      out.push(vb, b[j + 1]);
      j += 2;
    }
    if (out.length > max) return null;
  }
  out.push(a[endA] | b[endB]);
  return out;
}

/**
 * Cheapest first: fewer atoms, then by variable and level. A total order in
 * which a need below another pointwise sorts first (with as many atoms, it
 * has the same variables and no higher level). Variables are numbered in
 * name order, so this is also the order blockers are listed in, and every
 * Value keeps its sets in it.
 */
function order(a: Need, b: Need): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * The minimal needs among `candidates`, the cheapest MAX_SETS of them. Once
 * sorted, a need can only be covered by one kept before it, so one pass
 * keeps exactly the minimal ones. `candidates` may be reordered.
 */
function minimize(candidates: Need[], truncated: boolean): Value {
  if (candidates.length === 0) return truncated ? BOTTOM_TRUNCATED : BOTTOM;
  for (const need of candidates) if (isEmpty(need)) return TOP;
  if (candidates.length === 1) return { sets: candidates, truncated };
  candidates.sort(order);
  const kept: Need[] = [];
  let cut = truncated;
  for (const need of candidates) {
    if (coveredBy(kept, need)) continue;
    if (kept.length === MAX_SETS) {
      cut = true;
      break;
    }
    kept.push(need);
  }
  return { sets: kept, truncated: cut };
}

/** Whether some need of `list` covers `need` (a loop: this is the hot path). */
function coveredBy(list: readonly Need[], need: Need): boolean {
  for (let i = 0; i < list.length; i++) {
    if (covers(list[i], need)) return true;
  }
  return false;
}

/**
 * `minimize(old ∪ fresh)` when `old` is an antichain already in order and
 * nothing in `old` covers a need of `fresh`: only `fresh` is sorted, the old
 * needs that a fresh one covers are dropped, and the two runs are merged.
 */
function extend(old: readonly Need[], fresh: Need[]): Value {
  const own = minimize(fresh, false);
  const kept: Need[] = [];
  for (const need of old) if (!coveredBy(own.sets, need)) kept.push(need);
  const out: Need[] = [];
  let cut = own.truncated;
  let i = 0;
  let j = 0;
  while (i < kept.length || j < own.sets.length) {
    if (out.length === MAX_SETS) {
      cut = true;
      break;
    }
    const takeOld =
      j === own.sets.length ||
      (i < kept.length && order(kept[i], own.sets[j]) <= 0);
    out.push(takeOld ? kept[i++] : own.sets[j++]);
  }
  return { sets: out, truncated: cut };
}

/** What every analysis of one compiled world shares. */
interface Layout {
  /**
   * Variable to item or group name: items, then groups, each in name order,
   * so a need's atoms are already sorted for output.
   */
  readonly names: readonly string[];
  readonly itemCount: number;
  readonly itemVar: ReadonlyMap<string, number>;
  readonly groupVar: ReadonlyMap<string, number>;
  /** The members of group variable `itemCount + g`, as item variables. */
  readonly members: readonly (readonly number[])[];
  /** For each item variable, the highest threshold an item test uses. */
  readonly tested: Float64Array;
}

const layouts = new WeakMap<CompiledWorld, Layout>();

function layoutOf(world: CompiledWorld): Layout {
  const known = layouts.get(world);
  if (known !== undefined) return known;
  const groups = [...world.rules.groups].sort(([a], [b]) => compareText(a, b));
  // A group no requirement uses may have members no requirement reads.
  const names = [
    ...new Set([...world.items, ...groups.flatMap(([, list]) => list)]),
  ].sort(compareText);
  const itemVar = new Map(names.map((name, v) => [name, v]));
  const itemCount = names.length;
  const groupVar = new Map<string, number>();
  const members = groups.map(([group, list]) => {
    groupVar.set(group, names.length);
    names.push(group);
    return list.map((member) => itemVar.get(member) as number);
  });

  const tested = new Float64Array(itemCount);
  const scan = (expr: Expr): void => {
    switch (expr.type) {
      case "item": {
        const v = itemVar.get(expr.name);
        if (v !== undefined && typeof expr.min === "number") {
          tested[v] = Math.max(tested[v], expr.min);
        }
        break;
      }
      case "maybe":
        scan(expr.expr);
        break;
      case "and":
      case "or":
        for (const arg of expr.args) scan(arg);
        break;
      default:
        break;
    }
  };
  for (const expr of new Set([...world.exitExprs, ...world.locationExprs])) {
    scan(expr);
  }
  for (const body of world.rules.helpers.values()) scan(body);

  const layout = { groupVar, itemCount, itemVar, members, names, tested };
  layouts.set(world, layout);
  return layout;
}

function folded(min: Threshold): number {
  if (typeof min !== "number") {
    throw new DefinitionError(`Unfolded setting "${min.setting}"`);
  }
  return min;
}

/**
 * Analyzes what the player could collect next, for one state: see
 * `Analysis.blockers`, and the README ("Blockers") for the definition, the
 * algorithm and its bounds. Nothing is computed until asked; everything is
 * memoized for the life of the returned object.
 */
export function analyze(
  world: CompiledWorld,
  state: State,
  options: AnalyzeOptions = {},
): Analysis {
  const limit = options.maxAtoms ?? DEFAULT_MAX_ATOMS;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError(`maxAtoms must be a non-negative integer: ${limit}`);
  }
  const { groupVar, itemCount, itemVar, members, names, tested } =
    layoutOf(world);
  const rules = world.rules;

  // Each variable's value now, and the most it can reach.
  const cur = new Float64Array(names.length);
  const cap = new Float64Array(names.length);
  const acquirable = options.acquirable ?? (() => true);
  const maxLevel = options.maxLevel;
  for (let v = 0; v < itemCount; v++) {
    const have = itemValue(state, names[v]);
    cur[v] = have;
    if (acquirable(names[v])) {
      const most = maxLevel ? maxLevel(names[v]) : Math.max(1, tested[v]);
      cap[v] = most > have ? most : have;
    } else {
      cap[v] = have;
    }
  }
  members.forEach((list, g) => {
    for (const v of list) {
      cur[itemCount + g] += cur[v];
      cap[itemCount + g] += cap[v];
    }
  });

  let solved: Solved | undefined;
  const solution = (): Solved => {
    solved ??= run(world, state);
    return solved;
  };

  const atom = (variable: number, min: number): Value => {
    if (cur[variable] >= min) return TOP;
    if (limit === 0 || min > cap[variable]) return BOTTOM;
    return { sets: [[variable, min, bit(variable)]], truncated: false };
  };

  const and = (a: Value, b: Value): Value => {
    if (isTop(a) || b.sets.length === 0) return b;
    if (isTop(b) || a.sets.length === 0) return a;
    const out: Need[] = [];
    for (const x of a.sets) {
      for (const y of b.sets) {
        const joined = join(x, y, limit);
        if (joined !== null) out.push(joined);
      }
    }
    return minimize(out, a.truncated || b.truncated);
  };

  /**
   * `count(items) >= min` over items: every way to add the missing units
   * with at most `limit` atoms, each atom raising one item by 1 up to its
   * room. A minimal way adds exactly the missing units, so no two ways
   * compare. Fewest atoms first; past MAX_SETS it stops, truncated.
   */
  const distribute = (variables: readonly number[], min: number): Value => {
    let total = 0;
    for (const v of variables) total += cur[v];
    const missing = min - total;
    if (missing <= 0) return TOP;
    const pool = variables.filter((v) => cap[v] > cur[v]).sort((x, y) => x - y);
    const rooms = pool.map((v) => cap[v] - cur[v]);
    if (rooms.reduce((sum, room) => sum + room, 0) < missing) return BOTTOM;

    const out: Need[] = [];
    let cut = false;
    const chosen: number[] = [];
    const parts: number[] = [];
    const split = (i: number, remaining: number, size: number): void => {
      const room = rooms[chosen[i]];
      if (i === size - 1) {
        if (remaining > room) return;
        parts[i] = remaining;
        const need: number[] = [];
        let signature = 0;
        for (let a = 0; a < size; a++) {
          const v = pool[chosen[a]];
          need.push(v, cur[v] + parts[a]);
          signature |= bit(v);
        }
        need.push(signature);
        out.push(need);
        if (out.length > MAX_SETS) cut = true;
        return;
      }
      const after = size - 1 - i;
      for (let p = 1; p <= room && p <= remaining - after && !cut; p++) {
        parts[i] = p;
        split(i + 1, remaining - p, size);
      }
    };
    const choose = (from: number, depth: number, size: number): void => {
      if (depth === size) {
        split(0, missing, size);
        return;
      }
      for (let x = from; x < pool.length && !cut; x++) {
        chosen[depth] = x;
        choose(x + 1, depth + 1, size);
      }
    };
    for (let size = 1; size <= limit && size <= pool.length && !cut; size++) {
      choose(0, 0, size);
    }
    return minimize(out, cut);
  };

  const itemOf = (name: string): number => {
    const v = itemVar.get(name);
    if (v === undefined) throw new DefinitionError(`Unknown item "${name}"`);
    return v;
  };

  // Memos, indexed by target (YES or MAYBE).
  const roots: Map<Expr, Value>[] = [new Map(), new Map(), new Map()];
  const helperValues: Map<string, Value>[] = [new Map(), new Map(), new Map()];
  const pending = new Set<string>();
  const regionValues: (Value[] | undefined)[] = [];

  /** `[expr >= target]`, as the antichain of needs that make it true. */
  const value = (expr: Expr, target: number): Value => {
    switch (expr.type) {
      case "const":
        return LEVELS[expr.value] >= target ? TOP : BOTTOM;
      case "item":
        return atom(itemOf(expr.name), folded(expr.min));
      case "count": {
        const min = folded(expr.min);
        const [first] = expr.names;
        const group = expr.names.every((name) => name === first)
          ? groupVar.get(first)
          : undefined;
        if (group !== undefined) return atom(group, min);
        return distribute(
          countedItems(expr.names, rules.groups).map(itemOf),
          min,
        );
      }
      case "helper": {
        const memo = helperValues[target];
        let known = memo.get(expr.name);
        if (known === undefined) {
          const body = rules.helpers.get(expr.name);
          if (body === undefined || pending.has(expr.name)) {
            throw new DefinitionError(
              `Helper "@${expr.name}" cannot be analyzed`,
            );
          }
          pending.add(expr.name);
          known = value(body, target);
          pending.delete(expr.name);
          memo.set(expr.name, known);
        }
        return known;
      }
      case "reach": {
        const r = world.regionIndex.get(expr.region);
        if (r === undefined) {
          throw new DefinitionError(`Unknown region "${expr.region}"`);
        }
        return regionsAt(target)[r];
      }
      case "maybe":
        // ?x is yes exactly when x is, and always at least maybe.
        return target === YES ? value(expr.expr, YES) : TOP;
      case "and": {
        let acc = TOP;
        for (const arg of expr.args) {
          acc = and(acc, value(arg, target));
          if (acc.sets.length === 0 && !acc.truncated) return BOTTOM;
        }
        return acc;
      }
      case "or": {
        const out: Need[] = [];
        let truncated = false;
        for (const arg of expr.args) {
          const v = value(arg, target);
          if (isTop(v)) return TOP;
          out.push(...v.sets);
          if (v.truncated) truncated = true;
        }
        return minimize(out, truncated);
      }
      case "setting":
        throw new DefinitionError(`Unfolded setting "${expr.name}"`);
    }
  };

  /** A requirement shared by several exits or locations is analyzed once. */
  const root = (expr: Expr, target: number): Value => {
    const memo = roots[target];
    let known = memo.get(expr);
    if (known === undefined) {
      known = value(expr, target);
      memo.set(expr, known);
    }
    return known;
  };

  /**
   * Every region's value: the least fixpoint of
   * `R(r) = union over exits u -> r of R(u) & exit`, starting from `[[]]`
   * where the solver already reaches the target and `[]` elsewhere.
   *
   * A worklist expands a region with only the needs it gained since, one
   * bucket per atom count, fewest first. A join never has fewer atoms than
   * its inputs, so when a bucket runs every cheaper need is final, as in
   * Dijkstra's algorithm: cheap needs settle first and cover the costlier
   * ones before those spread. Exits never use reach(), so their values are
   * fixed. Truncation does not change the needs, so it is propagated after.
   */
  const regionsAt = (target: number): Value[] => {
    const known = regionValues[target];
    if (known !== undefined) return known;
    const { exitExprs, exitOffsets, exitTargets } = world;
    const { levels } = solution();
    const count = levels.length;
    const sets: Need[][] = [];
    const top = new Uint8Array(count);
    // A region that dropped needs past MAX_SETS...
    const cut = new Uint8Array(count);
    // ...or covered by later ones: its pending needs may include them.
    const evicted = new Uint8Array(count);
    // pending[size][r]: the needs of `size` atoms r gained and has not yet
    // expanded; queues[size]: the regions holding some.
    const pending: (Need[] | undefined)[][] = [];
    const queues: number[][] = [];
    const queued: Uint8Array[] = [];
    for (let size = 0; size <= limit; size++) {
      pending.push(new Array(count));
      queues.push([]);
      queued.push(new Uint8Array(count));
    }
    let bucket = 0;
    const add = (r: number, need: Need) => {
      const size = need.length >> 1;
      const list = pending[size][r];
      if (list === undefined) pending[size][r] = [need];
      else list.push(need);
      if (queued[size][r] === 0) {
        queued[size][r] = 1;
        queues[size].push(r);
      }
      if (size < bucket) bucket = size;
    };
    for (let r = 0; r < count; r++) {
      const reached = levels[r] >= target;
      top[r] = reached ? 1 : 0;
      sets.push(reached ? [EMPTY] : []);
      if (reached) add(r, EMPTY);
    }

    const merge = (r: number, candidates: Need[]) => {
      const old = sets[r];
      // Most candidates are covered by what the region has already: only
      // the others need a full minimize.
      const fresh: Need[] = [];
      for (const need of candidates) {
        if (isEmpty(need)) {
          // Only from a reached region through an exit already met, which
          // the solver would have reached too; kept for safety.
          top[r] = 1;
          evicted[r] = 1;
          sets[r] = [EMPTY];
          add(r, EMPTY);
          return;
        }
        if (!coveredBy(old, need)) fresh.push(need);
      }
      if (fresh.length === 0) return;
      const merged = extend(old, fresh);
      let added = 0;
      for (const need of merged.sets) {
        if (fresh.includes(need)) {
          add(r, need);
          added++;
        }
      }
      if (merged.sets.length < old.length + added) evicted[r] = 1;
      if (merged.truncated) cut[r] = 1;
      sets[r] = merged.sets as Need[];
    };

    const heads = new Array<number>(limit + 1).fill(0);
    while (bucket <= limit) {
      const queue = queues[bucket];
      if (heads[bucket] === queue.length) {
        bucket++;
        continue;
      }
      const size = bucket;
      const u = queue[heads[size]++];
      queued[size][u] = 0;
      let fresh = pending[size][u] ?? [];
      pending[size][u] = undefined;
      if (evicted[u] === 1) {
        // Drop the needs u lost since they were queued.
        const current = sets[u];
        fresh = fresh.filter((need) => current.includes(need));
      }
      if (fresh.length === 0) continue;
      for (let e = exitOffsets[u]; e < exitOffsets[u + 1]; e++) {
        const v = exitTargets[e];
        if (top[v] === 1) continue;
        const exit = root(exitExprs[e], target);
        if (exit.sets.length === 0) continue;
        const candidates: Need[] = [];
        for (const a of fresh) {
          for (const b of exit.sets) {
            const joined = join(a, b, limit);
            if (joined !== null) candidates.push(joined);
          }
        }
        if (candidates.length > 0) merge(v, candidates);
      }
    }

    // A region may miss sets when its own antichain was cut, when a
    // truncated exit led a need in, or downstream of either.
    const truncated = new Uint8Array(count);
    const flagged: number[] = [];
    const flag = (r: number) => {
      if (top[r] === 0 && truncated[r] === 0) {
        truncated[r] = 1;
        flagged.push(r);
      }
    };
    for (let r = 0; r < count; r++) {
      if (cut[r] === 1) flag(r);
      if (sets[r].length === 0) continue;
      for (let e = exitOffsets[r]; e < exitOffsets[r + 1]; e++) {
        if (root(exitExprs[e], target).truncated) flag(exitTargets[e]);
      }
    }
    while (flagged.length > 0) {
      const u = flagged.pop() as number;
      for (let e = exitOffsets[u]; e < exitOffsets[u + 1]; e++) {
        const exit = root(exitExprs[e], target);
        if (exit.sets.length > 0 || exit.truncated) flag(exitTargets[e]);
      }
    }

    const values = sets.map((needs, r): Value => {
      if (top[r] === 1) return TOP;
      if (needs.length > 0)
        return { sets: needs, truncated: truncated[r] === 1 };
      return truncated[r] === 1 ? BOTTOM_TRUNCATED : BOTTOM;
    });
    regionValues[target] = values;
    return values;
  };

  // Variables are numbered in name order, so atoms come out sorted. The
  // needs of a region recur in all its locations: each converts once.
  const converted = new Map<Need, readonly Atom[]>();
  const toAtoms = (need: Need): readonly Atom[] => {
    let atoms = converted.get(need);
    if (atoms === undefined) {
      const list: Atom[] = [];
      for (let i = 0; i < need.length - 1; i += 2) {
        const v = need[i];
        const min = need[i + 1];
        list.push(
          v < itemCount ? { item: names[v], min } : { group: names[v], min },
        );
      }
      atoms = list;
      converted.set(need, atoms);
    }
    return atoms;
  };

  const results: Map<number, Blockers>[] = [new Map(), new Map(), new Map()];

  return {
    blockers(locationId, target) {
      const location = world.locationIndex.get(locationId);
      if (location === undefined) {
        throw new RangeError(`Unknown location "${locationId}"`);
      }
      if (target !== "yes" && target !== "maybe") {
        throw new RangeError(`Unknown target "${target}"`);
      }
      const level = LEVELS[target];
      const known = results[level].get(location);
      if (known !== undefined) return known;

      let result: Value;
      if (solution().locations[location] >= level) {
        result = TOP;
      } else {
        const region = regionsAt(level)[world.locationRegions[location]];
        result =
          region.sets.length === 0
            ? region
            : and(region, root(world.locationExprs[location], level));
      }
      const blockers: Blockers = {
        sets: result.sets.map(toAtoms),
        truncated: result.truncated,
      };
      results[level].set(location, blockers);
      return blockers;
    },
    doableNow() {
      const { locations } = solution();
      return world.locationIds.filter((_, l) => locations[l] === YES);
    },
  };
}

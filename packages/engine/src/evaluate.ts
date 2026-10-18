import type {
  ConstExpr,
  CountExpr,
  Expr,
  ItemExpr,
  ReachExpr,
  SettingExpr,
} from "./ast";
import { countedItems, DefinitionError, NO_RULES, type Rules } from "./rules";
import {
  hasUnknownFlag,
  type Settings,
  settingFlag,
  thresholdValue,
  unknownFlags,
} from "./settings";
import { fromRank, type Level, MAYBE, NO, rank, type Tri, YES } from "./tri";

/**
 * What the player holds: item id to a count or a flag. `true` counts as 1;
 * `false`, a missing id and anything else count as 0.
 */
export type State = Readonly<Record<string, number | boolean | undefined>>;

export function itemValue(state: State, name: string): number {
  const value = state[name];
  if (value === true) return 1;
  return typeof value === "number" ? value : 0;
}

export interface EvaluateOptions {
  /** The run's settings, for `setting(name)` and `>= setting(name)`. */
  readonly settings?: Settings;
  /** The level of every region, for `reach(region)`. */
  readonly regions?: Readonly<Record<string, Tri>>;
}

const NO_SETTINGS: Settings = {};
const WHERE = "Requirement";

type Atom = ConstExpr | ItemExpr | CountExpr | SettingExpr | ReachExpr;

/**
 * Whether `value` reaches a threshold: for one not known yet, yes when it
 * reaches the whole range, maybe when only its low end.
 */
const atLeast = (
  value: number,
  min: number | readonly [number, number],
): Level => {
  if (typeof min === "number") return value >= min ? YES : NO;
  if (value >= min[1]) return YES;
  return value >= min[0] ? MAYBE : NO;
};

/** The value of a node without operands: one table for both walks below. */
function atom(
  node: Atom,
  state: State,
  rules: Rules,
  options: EvaluateOptions,
): Level {
  const settings = options.settings ?? NO_SETTINGS;
  switch (node.type) {
    case "const":
      return rank(node.value);
    case "item":
      return atLeast(
        itemValue(state, node.name),
        thresholdValue(settings, node.min, WHERE),
      );
    case "count": {
      let total = 0;
      for (const name of countedItems(node.names, rules.groups)) {
        total += itemValue(state, name);
      }
      return atLeast(total, thresholdValue(settings, node.min, WHERE));
    }
    case "setting": {
      const flag = settingFlag(settings, node.name, WHERE);
      if (flag === "unknown") return MAYBE;
      return flag !== node.negated ? YES : NO;
    }
    case "reach": {
      const regions = options.regions;
      if (regions === undefined || !Object.hasOwn(regions, node.region)) {
        throw new DefinitionError(
          `${WHERE} uses reach(${node.region}), but no level is known for that region`,
        );
      }
      return rank(regions[node.region] as Tri);
    }
  }
}

/** Looks a helper's body up, refusing a hand-built cycle (loadRules rejects them). */
function helperBody(name: string, rules: Rules, pending: Set<string>): Expr {
  const body = rules.helpers.get(name);
  if (body === undefined) {
    throw new DefinitionError(`Unknown helper "@${name}"`);
  }
  if (pending.has(name)) {
    throw new DefinitionError(`Helper "@${name}" uses itself`);
  }
  return body;
}

/**
 * Evaluates one requirement: the reference semantics of the DSL. It walks the
 * tree directly, reads settings as it meets them and memoizes helpers for the
 * duration of the call. The solver runs the same semantics through compiled
 * closures instead (`compile.ts`, after `compileWorld` folded the settings),
 * and a property test holds the two to the same answers.
 */
export function evaluate(
  expr: Expr,
  state: State,
  rules: Rules = NO_RULES,
  options: EvaluateOptions = {},
): Tri {
  const settings = options.settings ?? NO_SETTINGS;
  const memo = new Map<string, Level>();
  const pending = new Set<string>();

  /**
   * A requirement or a helper's body: each flag not known yet that it reads
   * itself, read both ways, the two values met (the same, or maybe), as
   * `foldSettings` folds it. Its helpers have the run's own settings.
   */
  const scope = (node: Expr, set: Settings): Level => {
    const [flag] = unknownFlags(node, set);
    if (flag === undefined) return run(node, set);
    const whenTrue = scope(node, { ...set, [flag]: true });
    const whenFalse = scope(node, { ...set, [flag]: false });
    return whenTrue === whenFalse ? whenTrue : MAYBE;
  };

  const run = (node: Expr, set: Settings): Level => {
    switch (node.type) {
      case "helper": {
        const known = memo.get(node.name);
        if (known !== undefined) return known;
        const body = helperBody(node.name, rules, pending);
        pending.add(node.name);
        const level = scope(body, settings);
        pending.delete(node.name);
        memo.set(node.name, level);
        return level;
      }
      case "maybe": {
        const level = run(node.expr, set);
        return level === NO ? MAYBE : level;
      }
      case "and": {
        let level: Level = YES;
        for (const arg of node.args) {
          const next = run(arg, set);
          if (next === NO) return NO;
          if (next < level) level = next;
        }
        return level;
      }
      case "or": {
        let level: Level = NO;
        for (const arg of node.args) {
          const next = run(arg, set);
          if (next === YES) return YES;
          if (next > level) level = next;
        }
        return level;
      }
      default:
        return atom(node, state, rules, { ...options, settings: set });
    }
  };

  return fromRank(scope(expr, settings));
}

/**
 * A requirement's tree with the value of every node: what `explain()`
 * returns, so a UI can show why a location is yes, maybe or no.
 */
export interface TraceNode {
  readonly expr: Expr;
  readonly value: Tri;
  /**
   * The operand of `?x`, the arguments of `&` and `|`, the body of `@h`;
   * empty for the other nodes. A helper used twice shares one trace.
   */
  readonly children: readonly TraceNode[];
}

/**
 * `evaluate()` that keeps every node's value. Unlike `evaluate()` it does not
 * short-circuit, so every branch of an `&` or `|` has its value, even after
 * one argument settled the result. The root's value is `evaluate()`'s.
 */
export function trace(
  expr: Expr,
  state: State,
  rules: Rules = NO_RULES,
  options: EvaluateOptions = {},
): TraceNode {
  // Each helper body's trace, built once.
  const bodies = new Map<string, TraceNode>();
  const pending = new Set<string>();
  // A flag not known yet makes a node's value its own (a requirement read
  // both ways, then met), not its children's: each node is then evaluated
  // on its own. Explaining a compiled world never meets one, its settings
  // folded already.
  const own = hasUnknownFlag(options.settings ?? NO_SETTINGS);
  const valued = (
    node: Expr,
    children: TraceNode[],
    value: Tri,
  ): TraceNode => ({
    children,
    expr: node,
    value: own ? evaluate(node, state, rules, options) : value,
  });

  const run = (node: Expr): TraceNode => {
    switch (node.type) {
      case "helper": {
        let body = bodies.get(node.name);
        if (body === undefined) {
          const expr = helperBody(node.name, rules, pending);
          pending.add(node.name);
          body = run(expr);
          pending.delete(node.name);
          bodies.set(node.name, body);
        }
        return { children: [body], expr: node, value: body.value };
      }
      case "maybe": {
        const inner = run(node.expr);
        return valued(
          node,
          [inner],
          inner.value === "no" ? "maybe" : inner.value,
        );
      }
      case "and":
      case "or": {
        const children = node.args.map(run);
        let level: Level = node.type === "and" ? YES : NO;
        for (const child of children) {
          const next = rank(child.value);
          if (node.type === "and" ? next < level : next > level) level = next;
        }
        return valued(node, children, fromRank(level));
      }
      default:
        return valued(node, [], fromRank(atom(node, state, rules, options)));
    }
  };

  return run(expr);
}

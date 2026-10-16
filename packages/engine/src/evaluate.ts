import type {
  ConstExpr,
  CountExpr,
  Expr,
  ItemExpr,
  ReachExpr,
  SettingExpr,
} from "./ast";
import { countedItems, DefinitionError, NO_RULES, type Rules } from "./rules";
import { type Settings, settingFlag, thresholdValue } from "./settings";
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
    case "item": {
      const min = thresholdValue(settings, node.min, WHERE);
      return itemValue(state, node.name) >= min ? YES : NO;
    }
    case "count": {
      let total = 0;
      for (const name of countedItems(node.names, rules.groups)) {
        total += itemValue(state, name);
      }
      return total >= thresholdValue(settings, node.min, WHERE) ? YES : NO;
    }
    case "setting":
      return settingFlag(settings, node.name, WHERE) !== node.negated
        ? YES
        : NO;
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
  const memo = new Map<string, Level>();
  const pending = new Set<string>();

  const run = (node: Expr): Level => {
    switch (node.type) {
      case "helper": {
        const known = memo.get(node.name);
        if (known !== undefined) return known;
        const body = helperBody(node.name, rules, pending);
        pending.add(node.name);
        const level = run(body);
        pending.delete(node.name);
        memo.set(node.name, level);
        return level;
      }
      case "maybe": {
        const level = run(node.expr);
        return level === NO ? MAYBE : level;
      }
      case "and": {
        let level: Level = YES;
        for (const arg of node.args) {
          const next = run(arg);
          if (next === NO) return NO;
          if (next < level) level = next;
        }
        return level;
      }
      case "or": {
        let level: Level = NO;
        for (const arg of node.args) {
          const next = run(arg);
          if (next === YES) return YES;
          if (next > level) level = next;
        }
        return level;
      }
      default:
        return atom(node, state, rules, options);
    }
  };

  return fromRank(run(expr));
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
        const value = inner.value === "no" ? "maybe" : inner.value;
        return { children: [inner], expr: node, value };
      }
      case "and":
      case "or": {
        const children = node.args.map(run);
        let level: Level = node.type === "and" ? YES : NO;
        for (const child of children) {
          const next = rank(child.value);
          if (node.type === "and" ? next < level : next > level) level = next;
        }
        return { children, expr: node, value: fromRank(level) };
      }
      default:
        return {
          children: [],
          expr: node,
          value: fromRank(atom(node, state, rules, options)),
        };
    }
  };

  return run(expr);
}

import type { Expr } from "./ast";
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
}

const NO_SETTINGS: Settings = {};
const WHERE = "Requirement";

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

  const run = (node: Expr): Level => {
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
      case "helper": {
        const known = memo.get(node.name);
        if (known !== undefined) return known;
        const body = rules.helpers.get(node.name);
        if (body === undefined) {
          throw new DefinitionError(`Unknown helper "@${node.name}"`);
        }
        // loadRules rejects cycles; this guards hand-built Rules objects.
        if (pending.has(node.name)) {
          throw new DefinitionError(`Helper "@${node.name}" uses itself`);
        }
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
    }
  };

  return fromRank(run(expr));
}

import type { AndExpr, Expr, OrExpr, Threshold } from "./ast";
import { DefinitionError, type Rules } from "./rules";
import { soften, type Tri } from "./tri";

/**
 * The settings of one run: name to a flag (`swordless: true`) or a number
 * (`crystalsTower: 7`). They are fixed for the whole run, so requirements
 * read them at compile time: `compileWorld` folds `setting(name)`,
 * `!setting(name)` and `>= setting(name)` to constants before compiling.
 */
export type Settings = Readonly<Record<string, boolean | number>>;

function lookup(
  settings: Settings,
  name: string,
  where: string,
): boolean | number {
  if (!Object.hasOwn(settings, name)) {
    throw new DefinitionError(`${where} uses unknown setting "${name}"`);
  }
  return settings[name] as boolean | number;
}

const shown = (value: unknown): string => JSON.stringify(value) ?? `${value}`;

/** The value of `setting(name)`. Throws unless it is a boolean setting. */
export function settingFlag(
  settings: Settings,
  name: string,
  where: string,
): boolean {
  const value = lookup(settings, name, where);
  if (typeof value !== "boolean") {
    throw new DefinitionError(
      `${where} uses setting "${name}" as a condition, but it is ${shown(value)}, not a boolean`,
    );
  }
  return value;
}

/**
 * The number a threshold stands for. A setting used as one must be a
 * non-negative safe integer, like the integers the grammar accepts, so a
 * folded requirement still prints to text that parses.
 */
export function thresholdValue(
  settings: Settings,
  min: Threshold,
  where: string,
): number {
  if (typeof min === "number") return min;
  const value = lookup(settings, min.setting, where);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new DefinitionError(
      `${where} compares with setting "${min.setting}", but it is ${shown(value)}, not a non-negative integer`,
    );
  }
  return value;
}

const constant = (value: Tri): Expr => ({ type: "const", value });

/**
 * Replaces every setting in `expr` with its value, then simplifies the
 * constants away: `x & false` is `false`, `x & true` is `x`, `x | true` is
 * `true`, `?false` is `maybe`. The result has no setting left, keeps the
 * parser's flat shape, and means the same as `expr` under `settings`.
 *
 * Every setting is resolved, including those in branches the fold then
 * drops, so an unknown or mistyped setting is an error whatever the values
 * of the others. Throws a DefinitionError naming `where` and the setting.
 */
export function foldSettings(
  expr: Expr,
  settings: Settings,
  where: string,
): Expr {
  switch (expr.type) {
    case "setting": {
      const value = settingFlag(settings, expr.name, where);
      return constant(value !== expr.negated ? "yes" : "no");
    }
    case "item":
      return typeof expr.min === "number"
        ? expr
        : { ...expr, min: thresholdValue(settings, expr.min, where) };
    case "count":
      return typeof expr.min === "number"
        ? expr
        : { ...expr, min: thresholdValue(settings, expr.min, where) };
    case "maybe": {
      const inner = foldSettings(expr.expr, settings, where);
      if (inner.type === "const") return constant(soften(inner.value));
      return inner === expr.expr ? expr : { expr: inner, type: "maybe" };
    }
    case "and":
    case "or":
      return foldJunction(expr, settings, where);
    default:
      return expr;
  }
}

function foldJunction(
  expr: AndExpr | OrExpr,
  settings: Settings,
  where: string,
): Expr {
  const isAnd = expr.type === "and";
  const absorbing: Tri = isAnd ? "no" : "yes";
  const identity: Tri = isAnd ? "yes" : "no";
  // Every argument first, so settings in dropped branches are checked too.
  const folded = expr.args.map((arg) => foldSettings(arg, settings, where));
  if (folded.some((arg) => arg.type === "const" && arg.value === absorbing)) {
    return constant(absorbing);
  }
  const args: Expr[] = [];
  for (const arg of folded) {
    if (arg.type === "const" && arg.value === identity) continue;
    if (arg.type === expr.type) args.push(...arg.args);
    else args.push(arg);
  }
  if (args.length === 0) return constant(identity);
  if (args.length === 1) return args[0] as Expr;
  const unchanged =
    args.length === expr.args.length &&
    args.every((arg, i) => arg === expr.args[i]);
  if (unchanged) return expr;
  return isAnd ? { args, type: "and" } : { args, type: "or" };
}

/** The rules with every helper body folded (see `foldSettings`). */
export function foldRules(rules: Rules, settings: Settings): Rules {
  const helpers = new Map<string, Expr>();
  for (const [name, body] of rules.helpers) {
    helpers.set(name, foldSettings(body, settings, `Helper "@${name}"`));
  }
  return { groups: rules.groups, helpers };
}

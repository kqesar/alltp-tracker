import {
  type AndExpr,
  type CountExpr,
  type Expr,
  type ItemExpr,
  type OrExpr,
  type Threshold,
  walk,
} from "./ast";
import { DefinitionError, type Rules } from "./rules";
import { soften, type Tri } from "./tri";

/**
 * A setting the player does not know yet, as a Mystery seed hides them: a
 * flag that may be either way, or a number somewhere in a range (both ends
 * included). Where it decides, a requirement folds to `maybe`.
 */
export type UnknownSetting =
  | { readonly unknown: true }
  | { readonly between: readonly [low: number, high: number] };

/**
 * The settings of one run: name to a flag (`swordless: true`), a number
 * (`crystalsTower: 7`) or an unknown one. They are fixed for the whole run,
 * so requirements read them at compile time: `compileWorld` folds
 * `setting(name)`, `!setting(name)` and `>= setting(name)` to constants
 * before compiling.
 */
export type Settings = Readonly<
  Record<string, boolean | number | UnknownSetting>
>;

type SettingValue = Settings[string];

function lookup(settings: Settings, name: string, where: string): SettingValue {
  if (!Object.hasOwn(settings, name)) {
    throw new DefinitionError(`${where} uses unknown setting "${name}"`);
  }
  return settings[name] as SettingValue;
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** A flag not known yet. */
const isUnknownFlag = (value: SettingValue): boolean =>
  typeof value === "object" && "unknown" in value && value.unknown === true;

/**
 * The flags not known yet that `expr` reads itself, in reading order, each
 * with how many times it does: not through its helpers, which are folded on
 * their own.
 */
function unknownReads(expr: Expr, settings: Settings): Map<string, number> {
  const reads = new Map<string, number>();
  walk(expr, (node) => {
    if (
      node.type === "setting" &&
      Object.hasOwn(settings, node.name) &&
      isUnknownFlag(settings[node.name] as SettingValue)
    ) {
      reads.set(node.name, (reads.get(node.name) ?? 0) + 1);
    }
  });
  return reads;
}

/** The flags not known yet that `expr` reads itself, in reading order. */
export const unknownFlags = (expr: Expr, settings: Settings): string[] => [
  ...unknownReads(expr, settings).keys(),
];

/** Whether any setting is a flag not known yet. */
export const hasUnknownFlag = (settings: Settings): boolean =>
  Object.values(settings).some(isUnknownFlag);

/** A number not known yet: its range, when it is one. */
const rangeOf = (value: SettingValue): readonly [number, number] | null => {
  if (typeof value !== "object" || !("between" in value)) return null;
  const [low, high] = value.between;
  return isCount(low) && isCount(high) && low <= high ? [low, high] : null;
};

const shown = (value: unknown): string => JSON.stringify(value) ?? `${value}`;

/**
 * The value of `setting(name)`, "unknown" for a flag not known yet. Throws
 * unless it is a boolean setting.
 */
export function settingFlag(
  settings: Settings,
  name: string,
  where: string,
): boolean | "unknown" {
  const value = lookup(settings, name, where);
  if (isUnknownFlag(value)) return "unknown";
  if (typeof value !== "boolean") {
    throw new DefinitionError(
      `${where} uses setting "${name}" as a condition, but it is ${shown(value)}, not a boolean`,
    );
  }
  return value;
}

/**
 * The number a threshold stands for, or its range for a number not known
 * yet. A setting used as one must be a non-negative safe integer, like the
 * integers the grammar accepts, so a folded requirement still prints to
 * text that parses; so must both ends of a range, the low one first.
 */
export function thresholdValue(
  settings: Settings,
  min: Threshold,
  where: string,
): number | readonly [number, number] {
  if (typeof min === "number") return min;
  const value = lookup(settings, min.setting, where);
  const range = rangeOf(value);
  if (range) return range[0] === range[1] ? range[0] : range;
  if (!isCount(value)) {
    throw new DefinitionError(
      `${where} compares with setting "${min.setting}", but it is ${shown(value)}, not a non-negative integer`,
    );
  }
  return value;
}

const constant = (value: Tri): Expr => ({ type: "const", value });

/**
 * A threshold folded: the number, or for one not known yet, "at least the
 * high end, or maybe at least the low one". That is yes when every value
 * of the range holds, no when none does, and maybe in between.
 */
function foldThreshold<E extends CountExpr | ItemExpr>(
  expr: E,
  min: number | readonly [number, number],
): Expr {
  if (typeof min === "number") return { ...expr, min };
  const [low, high] = min;
  return {
    args: [
      { ...expr, min: high },
      { args: [{ ...expr, min: low }, constant("maybe")], type: "and" },
    ],
    type: "or",
  };
}

/**
 * Replaces every setting in `expr` with its value (see `foldKnown`). A flag
 * not known yet is folded both ways, and the two requirements met: the same
 * where they agree, `maybe` where they differ, which is
 * `(t & f) | maybe & (t | f)`. That is exact for the flag (a requirement it
 * does not change keeps its value), where folding the flag alone to `maybe`
 * would lose `setting(s) & a | !setting(s) & b` with both `a` and `b` held.
 */
export function foldSettings(
  expr: Expr,
  settings: Settings,
  where: string,
): Expr {
  // A flag read once folds to maybe as it is, exactly: Kleene's operators
  // give a formula that reads each value once the meet of its two readings.
  // Only a flag read twice or more (`s & a | !s & b`) needs both.
  const [flag] = [...unknownReads(expr, settings)]
    .filter(([, reads]) => reads > 1)
    .map(([name]) => name);
  if (flag === undefined) return foldKnown(expr, settings, where);
  const whenTrue = foldSettings(expr, { ...settings, [flag]: true }, where);
  const whenFalse = foldSettings(expr, { ...settings, [flag]: false }, where);
  if (JSON.stringify(whenTrue) === JSON.stringify(whenFalse)) return whenTrue;
  return foldKnown(
    {
      args: [
        { args: [whenTrue, whenFalse], type: "and" },
        {
          args: [
            constant("maybe"),
            { args: [whenTrue, whenFalse], type: "or" },
          ],
          type: "and",
        },
      ],
      type: "or",
    },
    {},
    where,
  );
}

/**
 * Replaces every setting in `expr` with its value, then simplifies the
 * constants away: `x & false` is `false`, `x & true` is `x`, `x | true` is
 * `true`, `?false` is `maybe`. A setting not known yet folds to `maybe`, a
 * threshold not known yet to `x >= high | x >= low & maybe`. The result has no setting left, keeps the
 * parser's flat shape, and means the same as `expr` under `settings`.
 *
 * Every setting is resolved, including those in branches the fold then
 * drops, so an unknown or mistyped setting is an error whatever the values
 * of the others. Throws a DefinitionError naming `where` and the setting.
 */
function foldKnown(expr: Expr, settings: Settings, where: string): Expr {
  switch (expr.type) {
    case "setting": {
      const value = settingFlag(settings, expr.name, where);
      // Not known yet: either way, so maybe whichever way it is read
      if (value === "unknown") return constant("maybe");
      return constant(value !== expr.negated ? "yes" : "no");
    }
    case "item":
    case "count":
      return typeof expr.min === "number"
        ? expr
        : foldThreshold(expr, thresholdValue(settings, expr.min, where));
    case "maybe": {
      const inner = foldKnown(expr.expr, settings, where);
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
  const folded = expr.args.map((arg) => foldKnown(arg, settings, where));
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

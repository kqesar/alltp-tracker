import type { Tri } from "./tri";

/**
 * A parsed requirement. Plain, serializable data: no positions, so two
 * requirements that mean the same text compare equal with a deep equality.
 *
 * `and` / `or` are n-ary and kept flat by the parser: an `and` never has an
 * `and` argument (nor an `or` an `or`), and both always have two or more.
 */
export type Expr =
  | ConstExpr
  | ItemExpr
  | CountExpr
  | HelperExpr
  | SettingExpr
  | MaybeExpr
  | AndExpr
  | OrExpr;

/** `true`, `false` or `maybe`. */
export interface ConstExpr {
  readonly type: "const";
  readonly value: Tri;
}

/**
 * `>= setting(name)`: a threshold read from the run's numeric setting `name`.
 * `compileWorld` replaces it with that number before compiling anything.
 */
export interface SettingThreshold {
  readonly setting: string;
}

/** What `>=` compares with: an integer, or a numeric setting. */
export type Threshold = number | SettingThreshold;

/** `sword >= 2`; a bare `sword` is `sword >= 1`. */
export interface ItemExpr {
  readonly type: "item";
  readonly name: string;
  readonly min: Threshold;
}

/** `count(a, b, group) >= n`: the sum of the named items' values. */
export interface CountExpr {
  readonly type: "count";
  readonly names: readonly string[];
  readonly min: Threshold;
}

/** `@canLiftRocks`: a named requirement from the rules' helper table. */
export interface HelperExpr {
  readonly type: "helper";
  readonly name: string;
}

/**
 * `setting(name)`, or `!setting(name)` when `negated`: a boolean setting of
 * the run (swordless, open mode). Settings are fixed for a run, so
 * `compileWorld` folds them to constants before compiling anything. This is
 * the only negation in the language, and it cannot make a rule non-monotone
 * in items: by the time items are read, it is a constant.
 */
export interface SettingExpr {
  readonly type: "setting";
  readonly name: string;
  readonly negated: boolean;
}

/** `maybe(x)` or `?x`: "no" becomes "maybe" (see `soften`). */
export interface MaybeExpr {
  readonly type: "maybe";
  readonly expr: Expr;
}

export interface AndExpr {
  readonly type: "and";
  readonly args: readonly Expr[];
}

export interface OrExpr {
  readonly type: "or";
  readonly args: readonly Expr[];
}

/** Item, helper, group and setting names. */
export const IDENTIFIER = /^[a-z][a-zA-Z0-9_]*$/;

/** Words the grammar claims; none of them can name an item or a group. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "count",
  "false",
  "maybe",
  "setting",
  "true",
]);

export function isIdentifier(name: string): boolean {
  return IDENTIFIER.test(name) && !RESERVED_WORDS.has(name);
}

/** Calls `visit` on `expr` and every expression below it, parents first. */
export function walk(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  switch (expr.type) {
    case "maybe":
      walk(expr.expr, visit);
      break;
    case "and":
    case "or":
      for (const arg of expr.args) walk(arg, visit);
      break;
    default:
      break;
  }
}

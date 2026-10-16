import type { Expr, Threshold } from "./ast";
import type { Tri } from "./tri";

const CONSTANTS: Readonly<Record<Tri, string>> = {
  maybe: "maybe",
  no: "false",
  yes: "true",
};

/**
 * Prints a requirement in canonical form: one space around `&` and `|`,
 * parentheses only where precedence needs them, `?x` for `maybe(x)`.
 *
 * `parse(print(expr))` gives `expr` back for any expression the parser can
 * produce. Any other tree (nested same-operator nodes, fewer than two
 * arguments) prints to text that parses to an equivalent expression.
 */
export function print(expr: Expr): string {
  switch (expr.type) {
    case "const":
      return CONSTANTS[expr.value];
    case "item":
      return expr.min === 1
        ? expr.name
        : `${expr.name} >= ${printThreshold(expr.min)}`;
    case "count":
      return `count(${expr.names.join(", ")}) >= ${printThreshold(expr.min)}`;
    case "helper":
      return `@${expr.name}`;
    case "setting":
      return `${expr.negated ? "!" : ""}setting(${expr.name})`;
    case "maybe":
      return `?${isAtomic(expr.expr) ? print(expr.expr) : `(${print(expr.expr)})`}`;
    case "and":
      if (expr.args.length === 0) return "true";
      return expr.args
        .map((arg) =>
          arg.type === "and" || arg.type === "or"
            ? `(${print(arg)})`
            : print(arg),
        )
        .join(" & ");
    case "or":
      if (expr.args.length === 0) return "false";
      return expr.args
        .map((arg) => (arg.type === "or" ? `(${print(arg)})` : print(arg)))
        .join(" | ");
  }
}

function printThreshold(min: Threshold): string {
  return typeof min === "number" ? String(min) : `setting(${min.setting})`;
}

/** Prints without parentheses after `?`; comparisons get them for clarity. */
function isAtomic(expr: Expr): boolean {
  switch (expr.type) {
    case "const":
    case "helper":
    case "maybe":
    case "setting":
      return true;
    case "item":
      return expr.min === 1;
    default:
      return false;
  }
}

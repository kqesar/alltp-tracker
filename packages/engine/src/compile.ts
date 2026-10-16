import type { Expr, Threshold } from "./ast";
import { countedItems, DefinitionError, type Rules } from "./rules";
import { type Level, MAYBE, NO, rank, YES } from "./tri";

const UNFOLDED =
  "compileWorld folds settings before compiling: compile folded requirements and rules";

/** A threshold of a folded requirement: always a number by then. */
function folded(min: Threshold): number {
  if (typeof min !== "number") {
    throw new DefinitionError(
      `Unfolded setting "${min.setting}" (${UNFOLDED})`,
    );
  }
  return min;
}

/** Helper slot states in `Context.helpers`, beside a computed Level. */
export const UNKNOWN = -1;
const PENDING = -2;

/**
 * Scratch space for one solve: item values by item index, and each helper's
 * result by helper index (UNKNOWN until first used, then memoized).
 */
export interface Context {
  readonly values: Float64Array;
  readonly helpers: Int8Array;
}

export type Compiled = (ctx: Context) => Level;

/**
 * Compiles requirements into closures over item and helper indices: the
 * solver's fast path. Names are resolved once here, so evaluating reads typed
 * arrays instead of looking strings up. Semantics are those of `evaluate()`.
 * Requirements and helper bodies must be folded first (`foldSettings`): a
 * setting left in them is a DefinitionError.
 */
export class Compiler {
  /** Every item a compiled requirement reads; its index is the item index. */
  readonly items: string[] = [];
  private readonly itemIndex = new Map<string, number>();
  private readonly helperIndex = new Map<string, number>();
  private readonly helperBodies: Compiled[] = [];
  private readonly rules: Rules;

  constructor(rules: Rules) {
    this.rules = rules;
  }

  get helperCount(): number {
    return this.helperBodies.length;
  }

  compile(expr: Expr): Compiled {
    switch (expr.type) {
      case "const": {
        const level = rank(expr.value);
        return () => level;
      }
      case "item": {
        const index = this.item(expr.name);
        const min = folded(expr.min);
        return (ctx) => (ctx.values[index] >= min ? YES : NO);
      }
      case "count": {
        const indices = Int32Array.from(
          countedItems(expr.names, this.rules.groups),
          (name) => this.item(name),
        );
        const min = folded(expr.min);
        return (ctx) => {
          let total = 0;
          for (let i = 0; i < indices.length; i++) {
            total += ctx.values[indices[i]];
          }
          return total >= min ? YES : NO;
        };
      }
      case "helper":
        return this.helperCall(expr.name);
      case "setting":
        throw new DefinitionError(
          `Unfolded setting "${expr.name}" (${UNFOLDED})`,
        );
      case "maybe": {
        const inner = this.compile(expr.expr);
        return (ctx) => {
          const level = inner(ctx);
          return level === NO ? MAYBE : level;
        };
      }
      case "and":
        return this.and(expr.args.map((arg) => this.compile(arg)));
      case "or":
        return this.or(expr.args.map((arg) => this.compile(arg)));
    }
  }

  private and(args: Compiled[]): Compiled {
    if (args.length === 2) {
      const [a, b] = args;
      return (ctx) => {
        const x = a(ctx);
        if (x === NO) return NO;
        const y = b(ctx);
        return y < x ? y : x;
      };
    }
    return (ctx) => {
      let level: Level = YES;
      for (let i = 0; i < args.length; i++) {
        const next = args[i](ctx);
        if (next === NO) return NO;
        if (next < level) level = next;
      }
      return level;
    };
  }

  private or(args: Compiled[]): Compiled {
    if (args.length === 2) {
      const [a, b] = args;
      return (ctx) => {
        const x = a(ctx);
        if (x === YES) return YES;
        const y = b(ctx);
        return y > x ? y : x;
      };
    }
    return (ctx) => {
      let level: Level = NO;
      for (let i = 0; i < args.length; i++) {
        const next = args[i](ctx);
        if (next === YES) return YES;
        if (next > level) level = next;
      }
      return level;
    };
  }

  private item(name: string): number {
    let index = this.itemIndex.get(name);
    if (index === undefined) {
      index = this.items.length;
      this.items.push(name);
      this.itemIndex.set(name, index);
    }
    return index;
  }

  /** A memoized call: the helper's body runs at most once per solve. */
  private helperCall(name: string): Compiled {
    let index = this.helperIndex.get(name);
    if (index === undefined) {
      const body = this.rules.helpers.get(name);
      if (body === undefined) {
        throw new DefinitionError(`Unknown helper "@${name}"`);
      }
      index = this.helperBodies.length;
      // Registered before its body compiles, so a reference back to it ends
      // the recursion here instead of compiling forever.
      this.helperIndex.set(name, index);
      this.helperBodies.push(() => NO);
      this.helperBodies[index] = this.compile(body);
    }
    const slot = index;
    const bodies = this.helperBodies;
    return (ctx) => {
      const known = ctx.helpers[slot];
      if (known >= 0) return known as Level;
      // loadRules rejects cycles; this guards hand-built Rules objects.
      if (known === PENDING) {
        throw new DefinitionError(`Helper "@${name}" uses itself`);
      }
      ctx.helpers[slot] = PENDING;
      const level = bodies[slot](ctx);
      ctx.helpers[slot] = level;
      return level;
    };
  }
}

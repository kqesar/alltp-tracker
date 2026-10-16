/**
 * Three-valued (strong Kleene) logic: the answer to "can I get there?".
 *
 * - `"yes"`: in logic with the items held.
 * - `"maybe"`: possible, but through something the logic cannot vouch for: a
 *   dark room without a light source, an unknown medallion, a sequence break,
 *   an item that is visible but not yet obtainable.
 * - `"no"`: out of logic.
 *
 * Ordered `no < maybe < yes`. `and` is the minimum and `or` the maximum. There
 * is deliberately no negation: without it every rule is monotone, so finding
 * an item can never make a location less available.
 */
export type Tri = "yes" | "maybe" | "no";

/** A Tri as its rank in the order: what the solver computes with. */
export type Level = 0 | 1 | 2;

export const NO: Level = 0;
export const MAYBE: Level = 1;
export const YES: Level = 2;

/** Every Tri, in ascending order: `TRI_VALUES[level]` is that level's Tri. */
export const TRI_VALUES: readonly [Tri, Tri, Tri] = ["no", "maybe", "yes"];

const RANKS: Readonly<Record<Tri, Level>> = { maybe: MAYBE, no: NO, yes: YES };

export function rank(value: Tri): Level {
  return RANKS[value];
}

export function fromRank(level: Level): Tri {
  return TRI_VALUES[level];
}

/** Negative, zero or positive as `a` is below, equal to or above `b`. */
export function compare(a: Tri, b: Tri): number {
  return RANKS[a] - RANKS[b];
}

/** Kleene conjunction: the lowest value. `and()` is `"yes"`, its identity. */
export function and(...values: Tri[]): Tri {
  let level: Level = YES;
  for (const value of values) {
    const next = RANKS[value];
    if (next < level) level = next;
  }
  return TRI_VALUES[level];
}

/** Kleene disjunction: the highest value. `or()` is `"no"`, its identity. */
export function or(...values: Tri[]): Tri {
  let level: Level = NO;
  for (const value of values) {
    const next = RANKS[value];
    if (next > level) level = next;
  }
  return TRI_VALUES[level];
}

/**
 * The DSL's `maybe(x)`: what would be out of logic becomes possible. Used for
 * requirements the player may skip at their own risk (a light source in a
 * dark room); `"yes"` and `"maybe"` are unchanged.
 */
export function soften(value: Tri): Tri {
  return value === "no" ? "maybe" : value;
}

/// <reference types="node" />
// The translation of a randomizer's Python access rules into the engine's
// rule language, shared by the entrance randomizer's port (er-rules.mjs) and
// the Door Randomizer's (dr-rules.mjs): DR's Rules.py descends from the
// entrance randomizer's, with the same statements and `state.*` methods.
//
// Rules.py sets its rules in Python: each `set_rule(spot, lambda state: …)`
// replaces the rule of an entrance or a location, each `add_rule` ands one to
// it, in the order set_rules calls them. walkRules walks that order, reads
// each lambda as an expression tree (python.mjs) and translates it: an item
// through the dialect's items, a `state.*` method through its methods, a
// boss through Bosses.py, a branch on the world's settings into `setting()`.
// The rules of one spot fold into one: a rule set under a condition on the
// settings W is `W & new | !W & old`, one added `old & (!W | new)`, so the
// settings still fold at compile time.
//
// What differs between the two randomizers is a dialect: the world's
// settings and numbers, the items, the state's methods, the functions that
// are code rather than rules, the prefix of the helpers it names, and hooks
// for the expressions and statements only one of them writes.
//
// A rule that asks where an item sits (`item_name`, `item_in_locations`) is
// `maybe`, as the pack's rules read vt's (keys.ts). What is real code rather
// than a rule is listed in `unported` with its line, never dropped. What only
// decides where the randomizer may place an item (forbid_item,
// add_item_rule, set_always_allow) has no part in what Link can reach: it is
// `fill`, data for a key model (the entrance randomizer's: src/er-keys.ts).

import { expression, functionBody, tokens } from "./python.mjs";

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {import("./python.mjs").Statement} Statement
 * @typedef {{ k: "const", v: "true" | "false" | "maybe" }
 *   | { k: "atom", text: string }
 *   | { k: "setting", name: string, negated: boolean }
 *   | { k: "not", of: Rule }
 *   | { k: "and" | "or", args: Rule[] }} Rule
 */

// ---------------------------------------------------------------------------
// Rules: what a translation builds, folded and printed in the rule language

/** @type {Rule} */
export const TRUE = { k: "const", v: "true" };
/** @type {Rule} */
export const FALSE = { k: "const", v: "false" };
/** @type {Rule} */
export const MAYBE = { k: "const", v: "maybe" };

/** @param {string} text @returns {Rule} */
export const atom = (text) => ({ k: "atom", text });
/** @param {string} name @returns {Rule} */
export const setting = (name) => ({ k: "setting", name, negated: false });

/** Something the translation cannot express, with why. */
export class Untranslatable extends Error {}

/**
 * A junction of `args`, flattened, its constants folded and its repeats and
 * absorbed terms (`a | a & b` is `a`) dropped: Kleene logic is a lattice,
 * where absorption holds.
 * @param {"and" | "or"} k
 * @param {Rule[]} args
 * @returns {Rule}
 */
export function junction(k, args) {
  const unit = k === "and" ? TRUE : FALSE;
  const zero = k === "and" ? FALSE : TRUE;
  /** @type {Map<string, Rule>} */
  const kept = new Map();
  for (const arg of args.flatMap((a) => (a.k === k ? a.args : [a]))) {
    if (key(arg) === key(zero)) return zero;
    // A setting and its negation: x & !x is false, x | !x true
    if (arg.k === "setting" && kept.has(key(negate(arg)))) return zero;
    if (key(arg) !== key(unit)) kept.set(key(arg), arg);
  }
  // A setting of an and holds in its other terms, one of an or fails in
  // them: s & (s | x) is s, !s | s & x is !s | x. This holds for each value
  // the setting may take, so for one not known yet as well
  /** @type {Map<string, boolean>} */
  const facts = new Map();
  for (const arg of kept.values())
    if (arg.k === "setting")
      facts.set(arg.name, k === "and" ? !arg.negated : arg.negated);
  if (facts.size > 0) {
    const assumed = [...kept.values()].map((arg) =>
      arg.k === "and" || arg.k === "or" ? assume(arg, facts) : arg,
    );
    if (assumed.some((arg, i) => key(arg) !== [...kept.keys()][i]))
      return junction(k, assumed);
  }
  // One item at two counts: x >= 2 | x is x, x >= 2 & x is x >= 2
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const arg of kept.values()) {
    const item = arg.k === "atom" ? ITEM_COUNT.exec(arg.text) : null;
    if (item === null) continue;
    const [, id = "", n = "1"] = item;
    const was = counts.get(id);
    const count = Number(n);
    if (was === undefined || (k === "or" ? count < was : count > was))
      counts.set(id, count);
  }
  for (const [text, arg] of kept) {
    const item = arg.k === "atom" ? ITEM_COUNT.exec(arg.text) : null;
    if (item !== null && Number(item[2] ?? "1") !== counts.get(item[1] ?? ""))
      kept.delete(text);
  }
  // a | a & b is a; a & (a | b) is a
  const terms = [...kept.values()].filter(
    (arg) =>
      (arg.k !== "and" && arg.k !== "or") ||
      !arg.args.some((inner) => kept.has(key(inner))),
  );
  if (terms.length === 0) return unit;
  if (terms.length === 1) return /** @type {Rule} */ (terms[0]);
  return { args: terms, k };
}

/**
 * A rule with some settings known: each named in `facts` takes its value.
 * @param {Rule} rule
 * @param {ReadonlyMap<string, boolean>} facts
 * @returns {Rule}
 */
export function assume(rule, facts) {
  switch (rule.k) {
    case "setting": {
      const value = facts.get(rule.name);
      if (value === undefined) return rule;
      return value !== rule.negated ? TRUE : FALSE;
    }
    case "and":
      return all(...rule.args.map((arg) => assume(arg, facts)));
    case "or":
      return any(...rule.args.map((arg) => assume(arg, facts)));
    default:
      return rule;
  }
}

/** An item and its count, as an atom reads it: `sword >= 2`, `hammer`. */
export const ITEM_COUNT = /^([a-z]\w*)(?: >= (\d+))?$/;

/**
 * At least `count` of an item: `bow`, `bottle >= 2`; none is `true`.
 * @param {string} id
 * @param {number} count
 */
export const atLeast = (id, count) =>
  count === 0 ? TRUE : atom(count === 1 ? id : `${id} >= ${count}`);

/** @param {Rule[]} args */
export const all = (...args) => junction("and", args);
/** @param {Rule[]} args */
export const any = (...args) => junction("or", args);

/**
 * The negation of a rule. The language negates settings only: an item
 * under a `not` stays one, which a second negation clears (`if not x:
 * return False` reads as `x & …`) and which cannot be printed.
 * @param {Rule} rule
 * @returns {Rule}
 */
export function negate(rule) {
  switch (rule.k) {
    case "const":
      return rule.v === "true" ? FALSE : rule.v === "false" ? TRUE : MAYBE;
    case "setting":
      return { ...rule, negated: !rule.negated };
    case "atom":
      // Only a second negation may clear it: printing it fails
      return { k: "not", of: rule };
    case "not":
      return rule.of;
    default:
      return junction(rule.k === "and" ? "or" : "and", rule.args.map(negate));
  }
}

/**
 * Whether a rule reads the settings alone.
 * @param {Rule} rule
 * @returns {boolean}
 */
export const settingsOnly = (rule) =>
  rule.k === "setting" ||
  (rule.k === "const" && rule.v !== "maybe") ||
  ((rule.k === "and" || rule.k === "or") && rule.args.every(settingsOnly));

/**
 * The rule in the engine's language; an `or` inside an `and` takes
 * parentheses. An item under a `not` cannot be said: `strict` fails on
 * one, else it reads `!(x)`, for comparing rules.
 * @param {Rule} rule
 * @param {boolean} strict
 * @param {boolean} [inAnd]
 * @returns {string}
 */
function render(rule, strict, inAnd = false) {
  switch (rule.k) {
    case "const":
      return rule.v;
    case "atom":
      return rule.text;
    case "setting":
      return `${rule.negated ? "!" : ""}setting(${rule.name})`;
    case "not":
      if (strict)
        throw new Untranslatable(`negates ${render(rule.of, false)}, an item`);
      return `!(${render(rule.of, false)})`;
    case "and":
      return rule.args.map((a) => render(a, strict, true)).join(" & ");
    default: {
      const text = rule.args.map((a) => render(a, strict)).join(" | ");
      return inAnd ? `(${text})` : text;
    }
  }
}

/**
 * The rule in the engine's language.
 * @param {Rule} rule
 */
export const print = (rule) => render(rule, true);

/**
 * The rule as a key, for comparing rules.
 * @param {Rule} rule
 */
export const key = (rule) => render(rule, false);

// ---------------------------------------------------------------------------
// Names

/**
 * A region's engine id in the dialect's naming.
 * @param {Context} ctx
 * @param {string} name
 */
export const idOf = (ctx, name) => (ctx.dialect.regionId ?? regionId)(name);

/**
 * A region's engine id: its name in lowerCamel case, "Ganons Tower (Tile
 * Room)" as ganonsTowerTileRoom.
 * @param {string} name
 */
export function regionId(name) {
  const words = name.split(/[^A-Za-z0-9]+/).filter((w) => w !== "");
  return words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toLowerCase() + w.slice(1)
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join("");
}

/** @param {string} name */
export const pascal = (name) => {
  const id = regionId(name);
  return id.charAt(0).toUpperCase() + id.slice(1);
};

/**
 * What Link holds, as a rule: `count` of the randomizer's item `name`.
 * Silver arrows are the bow's second level, or the upgrade alone; an event
 * (the frog, the floodgate) is an item of its own, held once its location
 * is reached. A name no item of Items.py bears is never held: `has` looks
 * it up in what was collected (BaseClasses.py), as Rules.py:181's 'Mirror'.
 * @param {Context} ctx
 * @param {string} name
 * @param {number} count
 * @returns {Rule}
 */
export function holding(ctx, name, count) {
  const event = ctx.events.get(name);
  const key = /^(Small|Big) Key \((.+)\)$/.exec(name);
  /** @type {readonly [string, number?] | undefined} */
  let item = ctx.dialect.items[name];
  if (event !== undefined) {
    item = [event];
    ctx.heldEvents.add(name);
  } else if (key !== null) {
    const code = ctx.dialect.dungeonCodes[key[2] ?? ""];
    if (code === undefined) throw new Untranslatable(`no dungeon ${key[2]}`);
    item = [key[1] === "Small" ? `key${code}` : `bigKey${code}`];
  } else if (name === "Silver Arrows" && count === 1)
    return any(atom("bow >= 2"), atom("silverArrowUpgrade"));
  else if (!ctx.itemNames.has(name)) return FALSE;
  if (item === undefined) throw new Untranslatable(`no item ${name}`);
  const [id, level] = item;
  if (level !== undefined && count !== 1)
    throw new Untranslatable(`${count} of ${name}, a level`);
  return atLeast(id, level ?? count);
}

/**
 * The attribute `name` of the world, if `expr` reads one: `world.goal`,
 * `state.world.goal`, `world.goal[player]`.
 * @param {Expr} expr
 */
export function worldAttribute(expr) {
  // DR reads each setting by player: world.mode[player]
  if (expr.t === "index" && expr.at.t === "name" && expr.at.name === "player")
    return worldAttribute(expr.of);
  if (expr.t !== "attr") return undefined;
  const of = expr.of;
  const world =
    (of.t === "name" && of.name === "world") ||
    (of.t === "attr" &&
      of.name === "world" &&
      of.of.t === "name" &&
      of.of.name === "state");
  return world ? expr.name : undefined;
}

/**
 * A number a rule passes: a literal, or one the world holds.
 * @param {Context} ctx
 * @param {Expr | undefined} expr
 * @param {number} otherwise - When no argument is passed
 * @returns {number | string} A number, or a numeric setting's name
 */
export function numberOf(ctx, expr, otherwise) {
  if (expr === undefined) return otherwise;
  if (expr.t === "const" && typeof expr.value === "number") return expr.value;
  const name = worldAttribute(expr);
  const value = name === undefined ? undefined : ctx.dialect.numbers[name];
  if (value === undefined) throw new Untranslatable("a number of the world");
  return value;
}

// ---------------------------------------------------------------------------
// The translation

/**
 * What one randomizer's rules read differently: the world's settings, by an
 * attribute's value or as a flag (`false` for a value this path never
 * takes), the numbers the rules read off the world (a number, or a numeric
 * setting's name), the items as the pack's state counts them (an id and
 * the level the item is), the dungeons' codes in the pack's key ids, the
 * state's methods, the rule functions that are code, by what they do, and
 * the prefix of the helpers the translation names (`@erHasBoots`). Hooks:
 * a region's engine id (regionId by default), the expressions and the
 * statements only its randomizer writes, read before the shared ones.
 * @typedef {{
 *   prefix: string,
 *   world: Readonly<Record<string, Readonly<Record<string, Rule>> | Rule>>,
 *   numbers: Readonly<Record<string, string | number>>,
 *   items: Readonly<Record<string, readonly [string, number?]>>,
 *   dungeonCodes: Readonly<Record<string, string>>,
 *   methods: Readonly<Record<string, (ctx: Context, args: Expr[]) => Rule>>,
 *   code: Readonly<Record<string, string>>,
 *   regionId?: (name: string) => string,
 *   expression?: (ctx: Context, expr: Expr, scope: Scope) => Rule | undefined,
 *   statement?: (call: Hook) => boolean,
 *   list?: (ctx: Context, expr: Expr, scope: Scope) => unknown[] | undefined,
 *   assign?: (ctx: Context, value: Expr, scope: Scope) => unknown,
 *   block?: (block: Omit<Hook, "name" | "call"> & { statement: Statement }) => boolean,
 * }} Dialect
 * @typedef {{
 *   ctx: Context,
 *   name: string,
 *   call: Extract<Expr, { t: "call" }>,
 *   scope: Scope,
 *   line: number,
 *   apply: (op: "set" | "and" | "or", spot: { kind: "entrance" | "location", name: string }, rule: Rule, when: Rule, line: number) => void,
 *   walk: (statements: Statement[], scope: Scope) => void,
 *   unported: (code: string, line: number, why: string) => void,
 * }} Hook
 *   A statement calling `name`, for a dialect that reads it itself: the
 *   rules it sets go through `apply`, a function it walks through `walk`.
 */

/**
 * Everything a translation reads besides the expression. `bossHelper` names
 * the helper of the boss a region's dungeon fights (at `level` in Ganon's
 * Tower): its vanilla boss's, or its boss slot's under boss shuffle.
 * `retroShops`, the retro world's shops, for can_buy_unlimited (the entrance
 * randomizer's; DR reads its shops itself).
 * @typedef {{
 *   dialect: Dialect,
 *   regionOfLocation: ReadonlyMap<string, string>,
 *   regionOfEntrance: ReadonlyMap<string, string>,
 *   bossHelper: (region: string, level?: string) => string,
 *   events: ReadonlyMap<string, string>,
 *   heldEvents: Set<string>,
 *   itemNames: ReadonlySet<string>,
 *   potionShops: readonly string[],
 *   potionShop?: Rule,
 *   retroShops?: RetroShops,
 *   methodLine: (name: string) => number,
 *   helpers: Map<string, { req: string, source: string }>,
 *   reachedLocations: Set<string>,
 *   reachedEntrances: Set<string>,
 *   derived: Map<string, Derived>,
 * }} Context
 * @typedef {{ env: ReadonlyMap<string, unknown>, when: Rule, doors?: readonly string[] }} Scope
 *   What a statement is read under: the names its function bound, the
 *   settings its branches ask for, and the bomb shop's doors of a case.
 * A setting the world built from the entrances gives, by what it reads of
 * them: whether a region lies in the light world (mark_light_world_regions),
 * whether everything held reaches it as Turtle Rock's key rules ask
 * (set_trock_key_rules), whether Swamp Palace needs the patch.
 * @typedef {{ kind: "lightWorld" | "darkWorld" | "allItemsReach" | "door", region: string, source: string }
 *   | { kind: "swampPatch", source: string }} Derived
 */

/**
 * A derived setting, recorded with what it reads.
 * @param {Context} ctx
 * @param {string} name
 * @param {Derived} derived
 */
export function derive(ctx, name, derived) {
  ctx.derived.set(name, derived);
  return setting(name);
}

/**
 * The retro world's shops (ItemList.py set_up_shops): those that sell an
 * item whatever the seed (`fixed`, by item), and the `count` shops drawn
 * among `regions` that sell `items`.
 * @typedef {{
 *   fixed: ReadonlyMap<string, readonly string[]>,
 *   drawn: { regions: readonly string[], items: readonly string[], count: number },
 * }} RetroShops
 */

/**
 * What the tracker records of a shop that sells an item without end in the
 * retro world: the pack's `shopArrow` and `shopKey` (items.ts), which the
 * player marks on finding such a shop.
 * @type {Readonly<Record<string, string>>}
 */
export const SHOP_RECORDS = {
  "Single Arrow": "shopArrow",
  "Small Key (Universal)": "shopKey",
};

/**
 * can_buy_unlimited(item) (BaseClasses.py): a shop selling it is reached.
 * A fixed one by its region; one of the drawn shops is a placement the
 * tracker does not know, so `maybe` while any of them is reached, unless
 * the player recorded a shop that sells it: one selling the item itself,
 * or something that only the drawn shops sell, all of which sell it too.
 * @param {Context} ctx
 * @param {string} item
 * @returns {Rule}
 */
export function canBuyUnlimited(ctx, item) {
  const shops = ctx.retroShops;
  if (shops === undefined) throw new Untranslatable("no retro shops");
  return helper(
    ctx,
    `${ctx.dialect.prefix}CanBuyUnlimited${pascal(item)}`,
    () => {
      const { drawn, fixed } = shops;
      const reached = (/** @type {readonly string[]} */ regions) =>
        regions.map((r) => atom(`reach(${idOf(ctx, r)})`));
      const sold = drawn.items.includes(item);
      const records = Object.entries(SHOP_RECORDS).filter(
        ([other]) =>
          other === item ||
          (sold && drawn.items.includes(other) && !fixed.has(other)),
      );
      return any(
        ...reached(fixed.get(item) ?? []),
        ...records.map(([, record]) => atom(record)),
        sold ? all(MAYBE, any(...reached(drawn.regions))) : FALSE,
      );
    },
    `BaseClasses.py:${ctx.methodLine("can_buy_unlimited")}`,
  );
}

/**
 * A named rule of the translation, `@name`, defined once.
 * @param {Context} ctx
 * @param {string} name
 * @param {() => Rule} define
 * @param {string} source
 * @returns {Rule}
 */
export function helper(ctx, name, define, source) {
  if (!ctx.helpers.has(name)) {
    // Taken before it is defined, so a helper calling itself cannot loop
    ctx.helpers.set(name, { req: "", source });
    ctx.helpers.set(name, { req: print(define()), source });
  }
  return atom(`@${name}`);
}

/**
 * A method's helper, the dialect's prefix and its name in PascalCase,
 * then `suffix`: `@erHasBoots`.
 * @param {Context} ctx
 * @param {string} name
 * @param {string} suffix
 * @param {() => Rule} define
 */
export const method = (ctx, name, suffix, define) =>
  helper(
    ctx,
    `${ctx.dialect.prefix}${pascal(name)}${suffix}`,
    define,
    `BaseClasses.py:${ctx.methodLine(name)}`,
  );

/**
 * The name a spot expression names: `world.get_entrance('X', player)`, or
 * one of the loop's names.
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {{ kind: "entrance" | "location", name: string }}
 */
export function spotOf(expr, scope) {
  if (
    expr.t === "call" &&
    expr.fn.t === "attr" &&
    expr.fn.of.t === "name" &&
    expr.fn.of.name === "world" &&
    (expr.fn.name === "get_entrance" || expr.fn.name === "get_location")
  ) {
    return {
      kind: expr.fn.name === "get_entrance" ? "entrance" : "location",
      name: stringOf(expr.args[0], scope),
    };
  }
  // A loop's name bound to a spot (a dialect's list of a region's locations)
  if (expr.t === "name") {
    const value = scope.env.get(expr.name);
    if (
      value !== null &&
      typeof value === "object" &&
      "kind" in value &&
      "name" in value
    )
      return /** @type {{ kind: "entrance" | "location", name: string }} */ (
        value
      );
  }
  throw new Untranslatable("a spot other than an entrance or a location");
}

/**
 * A string an expression gives: a literal, or a loop's name.
 * @param {Expr | undefined} expr
 * @param {Scope} scope
 */
export function stringOf(expr, scope) {
  if (expr?.t === "const" && typeof expr.value === "string") return expr.value;
  if (expr?.t === "name") {
    const value = scope.env.get(expr.name);
    if (typeof value === "string") return value;
  }
  throw new Untranslatable("a name that is no string");
}

/**
 * The region a spot lies in: a location's, or the one an entrance leaves.
 * @param {Context} ctx
 * @param {{ kind: "entrance" | "location", name: string }} spot
 */
export function regionOf(ctx, spot) {
  const region = (
    spot.kind === "location" ? ctx.regionOfLocation : ctx.regionOfEntrance
  ).get(spot.name);
  if (region === undefined)
    throw new Untranslatable(`no ${spot.kind} ${spot.name}`);
  return region;
}

/**
 * The boss a `….parent_region.dungeon.boss` (or `.bosses['top']`) of a
 * spot fights, as its helper: its slot's, if boss shuffle fills it.
 * @param {Context} ctx
 * @param {Expr} expr - What `.can_defeat` is called on
 * @param {Scope} scope
 */
export function bossRule(ctx, expr, scope) {
  /** @type {string | undefined} */
  let level;
  let dungeon = expr;
  if (expr.t === "index" && expr.of.t === "attr" && expr.of.name === "bosses") {
    level = stringOf(expr.at, scope);
    dungeon = expr.of.of;
  } else if (expr.t === "attr" && expr.name === "boss") dungeon = expr.of;
  else throw new Untranslatable("a boss");
  if (
    dungeon.t !== "attr" ||
    dungeon.name !== "dungeon" ||
    dungeon.of.t !== "attr" ||
    dungeon.of.name !== "parent_region"
  )
    throw new Untranslatable("a boss");
  const region = regionOf(ctx, spotOf(dungeon.of.of, scope));
  return atom(`@${ctx.bossHelper(region, level)}`);
}

/**
 * A Python expression of a rule, as a rule.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {Rule}
 */
export function translate(ctx, expr, scope) {
  const shaped = ctx.dialect.expression?.(ctx, expr, scope);
  if (shaped !== undefined) return shaped;
  switch (expr.t) {
    case "const":
      if (expr.value === true) return TRUE;
      if (expr.value === false) return FALSE;
      throw new Untranslatable(`the value ${expr.value}`);
    case "and":
    case "or": {
      // Python stops at the first false (true): what follows is not read
      const stop = expr.t === "and" ? FALSE : TRUE;
      /** @type {Rule[]} */
      const args = [];
      for (const arg of expr.args) {
        const rule = translate(ctx, arg, scope);
        if (key(rule) === key(stop)) return stop;
        args.push(rule);
      }
      return expr.t === "and" ? all(...args) : any(...args);
    }
    case "not":
      return negate(translate(ctx, expr.of, scope));
    case "ifelse": {
      const test = translate(ctx, expr.test, scope);
      if (key(test) === "true") return translate(ctx, expr.then, scope);
      if (key(test) === "false") return translate(ctx, expr.otherwise, scope);
      const then = translate(ctx, expr.then, scope);
      const otherwise = translate(ctx, expr.otherwise, scope);
      if (settingsOnly(test))
        return any(all(test, then), all(negate(test), otherwise));
      // A test that hangs on a placement: both branches, or maybe one
      if (key(test) === "maybe")
        return any(all(then, otherwise), all(any(then, otherwise), MAYBE));
      throw new Untranslatable("a test on items");
    }
    case "compare":
      return comparison(ctx, expr, scope);
    case "attr": {
      const name = worldAttribute(expr);
      const value = name === undefined ? undefined : ctx.dialect.world[name];
      if (value !== undefined && "k" in value)
        return /** @type {Rule} */ (value);
      throw new Untranslatable(`the attribute ${expr.name}`);
    }
    case "call":
      return call(ctx, expr, scope);
    case "name": {
      // A name the function bound to a setting (Turtle Rock's reach)
      const value = scope.env.get(expr.name);
      if (value !== null && typeof value === "object" && "k" in value)
        return /** @type {Rule} */ (value);
      throw new Untranslatable(`the name ${expr.name}`);
    }
    case "index":
      // Whether Swamp Palace and the Dam left their doors (EntranceShuffle.py)
      if (worldAttribute(expr.of) === "swamp_patch_required")
        return derive(ctx, "swampPatch", {
          kind: "swampPatch",
          source: "EntranceShuffle.py",
        });
      {
        const name = worldAttribute(expr);
        const value = name === undefined ? undefined : ctx.dialect.world[name];
        if (value !== undefined && "k" in value)
          return /** @type {Rule} */ (value);
      }
      throw new Untranslatable("a subscript");
    default:
      throw new Untranslatable(`an expression (${expr.t})`);
  }
}

/**
 * A comparison: of a setting with its value, or of what a location holds
 * (`item_name(…) == (…)`), which a tracker does not know.
 * @param {Context} ctx
 * @param {Extract<Expr, { t: "compare" }>} expr
 * @param {Scope} scope
 * @returns {Rule}
 */
function comparison(ctx, expr, scope) {
  const { left, op, right } = expr;
  if (
    left.t === "call" &&
    left.fn.t === "name" &&
    left.fn.name === "item_name" &&
    ["==", "in"].includes(op)
  )
    return MAYBE;
  const name = worldAttribute(left);
  const values = name === undefined ? undefined : ctx.dialect.world[name];
  if (values === undefined || "k" in values)
    throw new Untranslatable(`a comparison (${op})`);
  /** @param {Expr} value */
  const valueRule = (value) => {
    const found = values[stringOf(value, scope)];
    if (found === undefined)
      throw new Untranslatable(
        `${name} compared with ${stringOf(value, scope)}`,
      );
    return found;
  };
  const listed = () => {
    if (right.t !== "seq") throw new Untranslatable("in a list that is none");
    return any(...right.items.map(valueRule));
  };
  switch (op) {
    case "==":
      return valueRule(right);
    case "!=":
      return negate(valueRule(right));
    case "in":
      return listed();
    case "not in":
      return negate(listed());
    default:
      throw new Untranslatable(`a comparison (${op})`);
  }
}

/**
 * A call: a method of the state, a boss's can_defeat, a region's
 * can_reach, item_in_locations.
 * @param {Context} ctx
 * @param {Extract<Expr, { t: "call" }>} expr
 * @param {Scope} scope
 * @returns {Rule}
 */
function call(ctx, expr, scope) {
  const { args, fn } = expr;
  if (fn.t === "name" && fn.name === "item_in_locations") return MAYBE;
  // A function the rule function defines: `return` its rule
  const local = fn.t === "name" ? localFunction(fn.name, scope) : undefined;
  if (local !== undefined) {
    const [only] = local.body;
    if (local.body.length !== 1 || !only?.text.startsWith("return "))
      throw new Untranslatable(`${local.text}, more than a return`);
    return translate(ctx, parse(only, only.text.slice(7)).found, scope);
  }
  if (fn.t !== "attr") throw new Untranslatable("a call of a function");
  if (fn.name === "can_defeat") return bossRule(ctx, fn.of, scope);
  // state.world.get_region('X', 1).can_reach(state)
  if (
    fn.name === "can_reach" &&
    fn.of.t === "call" &&
    fn.of.fn.t === "attr" &&
    fn.of.fn.name === "get_region"
  )
    return atom(`reach(${idOf(ctx, stringOf(fn.of.args[0], scope))})`);
  if (fn.of.t !== "name" || fn.of.name !== "state")
    throw new Untranslatable(`a call of ${fn.name}`);
  switch (fn.name) {
    case "has":
    case "has_key": {
      const name = fn.name;
      const item = stringOf(args[0], scope);
      const counted = args[2];
      // The retro world's has_key buys a key, whatever key or count it is
      // asked (BaseClasses.py:378-380): vt's Retro world, `genericKeys`
      /** @param {Rule} held */
      const keyed = (held) =>
        name === "has"
          ? held
          : any(
              all(negate(setting("genericKeys")), held),
              all(
                setting("genericKeys"),
                canBuyUnlimited(ctx, "Small Key (Universal)"),
              ),
            );
      // A count a local function gives by what a location holds
      if (counted?.t === "call" && counted.fn.t === "name") {
        const fn = localFunction(counted.fn.name, scope);
        if (fn !== undefined)
          return keyed(
            any(
              ...placedCounts(fn).map(({ count, placed }) =>
                all(placed ? MAYBE : TRUE, holding(ctx, item, count)),
              ),
            ),
          );
      }
      const count = numberOf(ctx, counted, 1);
      if (typeof count !== "number") throw new Untranslatable("a count");
      return keyed(holding(ctx, item, count));
    }
    case "can_reach": {
      const target = stringOf(args[0], scope);
      const hint = args[1] === undefined ? "Region" : stringOf(args[1], scope);
      if (hint === "Region") return atom(`reach(${idOf(ctx, target)})`);
      if (hint === "Location") {
        ctx.reachedLocations.add(target);
        return atom(`@${ctx.dialect.prefix}At${pascal(target)}`);
      }
      if (hint === "Entrance") {
        ctx.reachedEntrances.add(target);
        return atom(`@${ctx.dialect.prefix}Through${pascal(target)}`);
      }
      throw new Untranslatable(`can_reach of an ${hint}`);
    }
    default: {
      const translation = ctx.dialect.methods[fn.name];
      if (translation === undefined)
        throw new Untranslatable(`the method ${fn.name}`);
      return translation(ctx, args);
    }
  }
}

/**
 * The local function a rule function defined under `name`, if any.
 * @param {string} name
 * @param {Scope} scope
 * @returns {Statement | undefined}
 */
export function localFunction(name, scope) {
  const value = scope.env.get(name);
  return value !== null &&
    typeof value === "object" &&
    "text" in value &&
    "body" in value
    ? /** @type {Statement} */ (value)
    : undefined;
}

/**
 * The counts a local function returns (Turtle Rock's
 * tr_big_key_chest_keys_needed): each `if` on what a location holds gives
 * its count only maybe, the last `return` otherwise.
 * @param {Statement} fn
 * @returns {{ count: number, placed: boolean }[]}
 */
function placedCounts(fn) {
  /** @param {Statement} s */
  const returned = (s) => {
    const count = Number(/^return (\d+)$/.exec(s.text)?.[1] ?? Number.NaN);
    if (Number.isNaN(count))
      throw new Untranslatable(`${fn.text}: a return of no number`);
    return count;
  };
  /** @type {{ count: number, placed: boolean }[]} */
  const counts = [];
  for (const statement of fn.body) {
    // item = item_name(state, …): what the location holds, not known
    if (/^\w+ = item_name\(/.test(statement.text)) continue;
    const [only] = statement.body;
    if (statement.text.startsWith("if ") && only !== undefined)
      counts.push({ count: returned(only), placed: true });
    else counts.push({ count: returned(statement), placed: false });
  }
  return counts;
}

// ---------------------------------------------------------------------------
// The statements of Rules.py

/** What `all_state` names: the state that holds everything. */
const ALL_STATE = Symbol("all_state");
/** What `bombshop_entrance` names: the door into the Big Bomb Shop. */
const BOMB_SHOP_DOOR = Symbol("bombshop_entrance");

/**
 * Parses a logical line as an expression, from its start.
 * @param {Statement} statement
 * @param {string} text
 */
export function parse(statement, text) {
  const stream = tokens(text, 0, "Rules.py", statement.line);
  const found = expression(stream);
  return { found, stream };
}

/**
 * Where the randomizer may place an item, as data (a key model reads it,
 * src/er-keys.ts): what forbid_item refuses at a location, what
 * set_always_allow lets in there whatever reaches it, each under the
 * settings its branch asks for (`when`), and the add_item_rule lines,
 * which only Ganon's Triforce and the uncle's weapon set.
 * @typedef {{
 *   forbid: { item: string, id?: string, location: string, source: string, when: string }[],
 *   always: { item: string, id?: string, req: string, location: string, source: string, when: string }[],
 *   itemRules: { location: string, source: string }[],
 * }} Fill
 */

/**
 * The location a fill rule is set on: `world.get_location('X', player)`,
 * or one of the loop's names.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 */
function fillSpot(ctx, expr, scope) {
  const spot = spotOf(expr, scope);
  if (spot.kind !== "location")
    throw new Untranslatable("a fill rule on an entrance");
  regionOf(ctx, spot);
  return spot.name;
}

/**
 * An item a fill rule names, and the pack's id of a dungeon's key or big key
 * (`keyD1`, `bigKeyD1`), the items the key model places.
 * @param {Readonly<Record<string, string>>} codes - The dialect's dungeon codes
 * @param {string} name
 * @returns {{ item: string, id?: string }}
 */
export function itemNamed(codes, name) {
  const key = /^(Small|Big) Key \((.+)\)$/.exec(name);
  const code = key === null ? undefined : codes[key[2] ?? ""];
  if (key !== null && code === undefined)
    throw new Untranslatable(`no dungeon ${key[2]}`);
  return key === null
    ? { item: name }
    : { id: `${key[1] === "Small" ? "key" : "bigKey"}${code}`, item: name };
}

/**
 * What a set_always_allow lambda lets in: `lambda state, item: item.name ==
 * 'X' and item.player == player [and <a rule on the state>]`, the item and
 * that rule.
 * @param {Context} ctx
 * @param {Expr | undefined} fn
 * @param {Scope} scope
 * @returns {{ item: string, id?: string, req: string }}
 */
function alwaysAllowed(ctx, fn, scope) {
  if (fn?.t !== "lambda" || fn.params.join(",") !== "state,item")
    throw new Untranslatable("an always-allow other than a lambda");
  /** @type {string | undefined} */
  let item;
  /** @type {Rule[]} */
  const rules = [];
  for (const term of fn.body.t === "and" ? fn.body.args : [fn.body]) {
    const asked =
      term.t === "compare" &&
      term.op === "==" &&
      term.left.t === "attr" &&
      term.left.of.t === "name" &&
      term.left.of.name === "item"
        ? term.left.name
        : undefined;
    if (asked === "name" && term.t === "compare")
      item = stringOf(term.right, scope);
    else if (asked !== "player") rules.push(translate(ctx, term, scope));
  }
  if (item === undefined)
    throw new Untranslatable("an always-allow of no one item");
  return {
    ...itemNamed(ctx.dialect.dungeonCodes, item),
    req: print(all(...rules)),
  };
}

/**
 * Walks Rules.py's statements from set_rules, on vt's path, into the rules
 * of every spot.
 * @param {string} source - Rules.py
 * @param {Context} ctx
 */
export function walkRules(source, ctx) {
  /** @type {Map<string, { kind: "entrance" | "location", name: string, rule: Rule, source: number[] }>} */
  const spots = new Map();
  /** @type {{ code: string, line: number, why: string }[]} */
  const unported = [];
  /** @type {Fill} */
  const fill = { always: [], forbid: [], itemRules: [] };
  /**
   * The rule added by where the Big Bomb Shop's door is (set_big_bomb_rules):
   * one case per list of doors, the first that holds the door applies.
   * @type {{ spot: string, cases: { doors: readonly string[], req: string, source: string }[] } | undefined}
   */
  let bombShop;
  /**
   * The entrances' rules when Turtle Rock's key rules ask what everything
   * held reaches (`world.get_all_state`), by name.
   * @type {Map<string, string> | undefined}
   */
  let allItemsRules;

  /**
   * A rule set or added at `line`, under `when`.
   * @param {"set" | "and" | "or"} op
   * @param {{ kind: "entrance" | "location", name: string }} spot
   * @param {Rule} rule
   * @param {Rule} when
   * @param {number} line
   * @param {readonly string[]} [doors] - The bomb shop's doors it is for
   */
  const apply = (op, spot, rule, when, line, doors = undefined) => {
    const id = `${spot.kind}:${spot.name}`;
    regionOf(ctx, spot);
    if (doors !== undefined) {
      // A case of the bomb shop's door: an entrance's rule, added
      if (op !== "and" || spot.kind !== "entrance")
        throw new Untranslatable("a bomb shop case other than an added rule");
      // A case under a setting (DR's Open rules, beside Inverted's) keeps it
      if (!settingsOnly(when))
        throw new Untranslatable("a bomb shop case under more than a setting");
      if (bombShop !== undefined && bombShop.spot !== spot.name)
        throw new Untranslatable("bomb shop cases on two entrances");
      bombShop ??= { cases: [], spot: spot.name };
      bombShop.cases.push({
        doors,
        req: print(rule),
        source: `Rules.py:${line}`,
        ...(key(when) === "true" ? {} : { when: print(when) }),
      });
      return;
    }
    const was = spots.get(id) ?? { ...spot, rule: TRUE, source: [] };
    const always = key(when) === "true";
    const next =
      op === "set"
        ? any(all(when, rule), all(negate(when), was.rule))
        : op === "and"
          ? all(was.rule, any(negate(when), rule))
          : any(was.rule, all(when, rule));
    // Said in the language, or the statement is unported
    print(next);
    spots.set(id, {
      ...was,
      rule: next,
      source: op === "set" && always ? [line] : [...was.source, line],
    });
  };

  /**
   * @param {Statement[]} statements
   * @param {Scope} scope
   */
  const walk = (statements, scope) => {
    for (let i = 0; i < statements.length; i++) {
      const statement = /** @type {Statement} */ (statements[i]);
      const { line, text } = statement;
      try {
        // A block the dialect reads itself (DR's escape kill rooms)
        if (
          statement.block &&
          ctx.dialect.block?.({
            apply,
            ctx,
            line,
            scope,
            statement,
            unported: (code, at, why) => unported.push({ code, line: at, why }),
            walk,
          })
        )
          continue;
        if (text.startsWith("if ")) {
          // The chain: if, then each elif and the else after it
          const chain = [statement];
          for (
            let next = statements[i + 1];
            next !== undefined &&
            (next.text.startsWith("elif ") || next.text === "else");
            next = statements[i + 1]
          ) {
            chain.push(next);
            i++;
          }
          let before = TRUE;
          for (const branch of chain) {
            const condition =
              branch.text === "else"
                ? undefined
                : parse(branch, branch.text.replace(/^(el)?if /, "")).found;
            // On where the bomb shop's door is: a case of its own
            const doors =
              condition === undefined
                ? undefined
                : bombShopDoors(condition, scope);
            if (doors !== undefined) {
              walk(branch.body, { ...scope, doors });
              continue;
            }
            const test =
              condition === undefined ? TRUE : translate(ctx, condition, scope);
            if (!settingsOnly(test))
              throw new Untranslatable("a branch on more than the settings");
            const when = all(scope.when, before, test);
            if (key(when) !== "false") walk(branch.body, { ...scope, when });
            before = all(before, negate(test));
          }
        } else if (text.startsWith("for ")) {
          const head = /^for (\w+) in (.+)$/.exec(text);
          if (head === null) throw new Untranslatable("a loop");
          const [, name = "", over = ""] = head;
          for (const value of listOf(parse(statement, over).found, scope))
            walk(statement.body, {
              ...scope,
              env: new Map([...scope.env, [name, value]]),
            });
        } else if (text.startsWith("def ")) {
          // A local function: read where it is called
          const name = /^def (\w+)\(/.exec(text)?.[1] ?? "";
          scope.env = new Map([...scope.env, [name, statement]]);
        } else if (statement.block) {
          throw new Untranslatable("a block");
        } else simple(statement, scope);
      } catch (error) {
        // Python the reader does not parse (a slice, a dict): code too
        const unread =
          error instanceof Error && /^Rules\.py:\d+: /.test(error.message);
        if (!(error instanceof Untranslatable) && !unread) throw error;
        unported.push({
          code: text.length > 100 ? `${text.slice(0, 99)}…` : text,
          line,
          why: unread ? `unread: ${error.message}` : error.message,
        });
      }
    }
  };

  /**
   * A list a loop runs over: a literal, or one the function assigned.
   * @param {Expr} expr
   * @param {Scope} scope
   * @returns {string[]}
   */
  const listOf = (expr, scope) => {
    if (expr.t === "seq")
      return expr.items.map((item) => stringOf(item, scope));
    if (expr.t === "name") {
      const value = scope.env.get(expr.name);
      if (Array.isArray(value)) return value;
    }
    const listed = ctx.dialect.list?.(ctx, expr, scope);
    if (listed !== undefined) return /** @type {string[]} */ (listed);
    throw new Untranslatable("a loop over no list");
  };

  /**
   * The doors a test on where the bomb shop's door is names
   * (`bombshop_entrance.name in Normal_LW_entrances`, `== 'Kings Grave'`),
   * or undefined for any other test.
   * @param {Expr} test
   * @param {Scope} scope
   */
  const bombShopDoors = (test, scope) => {
    if (
      test.t !== "compare" ||
      test.left.t !== "attr" ||
      test.left.name !== "name" ||
      test.left.of.t !== "name" ||
      scope.env.get(test.left.of.name) !== BOMB_SHOP_DOOR
    )
      return undefined;
    if (test.op === "in") return listOf(test.right, scope);
    if (test.op === "==") return [stringOf(test.right, scope)];
    throw new Untranslatable(`the bomb shop's door ${test.op} …`);
  };

  /**
   * An assignment: a list kept for the loops, a name for what the world
   * built from the entrances gives (Turtle Rock's reach with everything
   * held, the bomb shop's door), or code.
   * @param {Expr} target
   * @param {string} sign
   * @param {Expr} value
   * @param {Scope} scope
   * @param {number} line
   */
  const assign = (target, sign, value, scope, line) => {
    if (target.t === "attr" && target.name === "can_reach_private")
      throw new Untranslatable("a save-and-quit point: what reaches a region");
    // world.can_access_trock_eyebridge = can_reach_back: a cache
    if (
      target.t === "attr" &&
      worldAttribute(target) !== undefined &&
      value.t === "name"
    )
      return;
    if (target.t !== "name") throw new Untranslatable("an assignment");
    /** @param {unknown} bound */
    const bind = (bound) => {
      scope.env = new Map([...scope.env, [target.name, bound]]);
    };
    if (sign === "+=")
      return bind([...listOf(target, scope), ...listOf(value, scope)]);
    if (sign !== "=") throw new Untranslatable(`an assignment with ${sign}`);
    if (value.t === "seq") return bind(listOf(value, scope));
    // all_state = world.get_all_state(…): read through the settings below
    if (
      value.t === "call" &&
      value.fn.t === "attr" &&
      value.fn.name === "get_all_state"
    ) {
      allItemsRules = new Map(
        [...spots.values()]
          .filter((spot) => spot.kind === "entrance")
          .map((spot) => [spot.name, print(spot.rule)]),
      );
      return bind(ALL_STATE);
    }
    // all_state.can_reach(world.get_region('X', player)) if … else …
    const reached = value.t === "ifelse" ? value.then : value;
    if (
      reached.t === "call" &&
      reached.fn.t === "attr" &&
      reached.fn.name === "can_reach" &&
      reached.fn.of.t === "name" &&
      scope.env.get(reached.fn.of.name) === ALL_STATE &&
      reached.args[0]?.t === "call"
    ) {
      const region = stringOf(reached.args[0].args[0], scope);
      return bind(
        derive(ctx, `allItemsReach_${regionId(region)}`, {
          kind: "allItemsReach",
          region,
          source: `Rules.py:${line}`,
        }),
      );
    }
    // bombshop_entrance = world.get_region('Big Bomb Shop', player).entrances[0]
    if (
      value.t === "index" &&
      value.of.t === "attr" &&
      value.of.name === "entrances"
    )
      return bind(BOMB_SHOP_DOOR);
    // A name the dialect reads (a door, a location)
    const bound = ctx.dialect.assign?.(ctx, value, scope);
    if (bound !== undefined) return bind(bound);
    throw new Untranslatable(
      value.t === "attr" && value.name === "can_reach_private"
        ? "a save-and-quit point: what reaches a region"
        : "an assignment",
    );
  };

  /**
   * One simple statement.
   * @param {Statement} statement
   * @param {Scope} scope
   */
  const simple = (statement, scope) => {
    const { line, text } = statement;
    if (text === "pass") return;
    const { found, stream } = parse(statement, text);
    if (!stream.done()) {
      const sign = String(stream.next().value);
      return assign(found, sign, expression(stream), scope, line);
    }
    if (found.t !== "call" || found.fn.t !== "name")
      throw new Untranslatable("a statement");
    const name = found.fn.name;
    const { args } = found;
    /** @param {number} index */
    const lambda = (index) => {
      const arg = args[index];
      // A local function of one return, passed by name
      const local =
        arg?.t === "name" ? localFunction(arg.name, scope) : undefined;
      const [only] = local?.body ?? [];
      if (
        local !== undefined &&
        local.body.length === 1 &&
        only?.text.startsWith("return ")
      )
        return translate(ctx, parse(only, only.text.slice(7)).found, scope);
      if (arg?.t !== "lambda")
        throw new Untranslatable("a rule other than a lambda");
      return translate(ctx, arg.body, scope);
    };
    switch (name) {
      case "set_rule":
        return apply(
          "set",
          spotOf(found.args[0] ?? found, scope),
          lambda(1),
          scope.when,
          line,
          scope.doors,
        );
      case "add_rule": {
        const combine = found.keywords.combine ?? args[2];
        const or = combine !== undefined && stringOf(combine, scope) === "or";
        return apply(
          or ? "or" : "and",
          spotOf(args[0] ?? found, scope),
          lambda(1),
          scope.when,
          line,
          scope.doors,
        );
      }
      case "set_defeat_dungeon_boss_rule": {
        const spot = spotOf(args[0] ?? found, scope);
        return apply(
          "set",
          spot,
          atom(`@${ctx.bossHelper(regionOf(ctx, spot))}`),
          scope.when,
          line,
        );
      }
      // add_lamp_requirement adds has('Lamp', …, lamps_needed_for_dark_rooms),
      // which vt's pools set to 1. add_conditional_lamp adds it unless the
      // world lights the room's side, which neither light cone does
      // (BaseClasses.py:47-48): always
      case "add_lamp_requirement":
        return apply(
          "and",
          spotOf(args[0] ?? found, scope),
          atom("lamp"),
          scope.when,
          line,
        );
      case "add_conditional_lamp": {
        const kind =
          args[2] === undefined ? "Location" : stringOf(args[2], scope);
        const spot = {
          kind: /** @type {"entrance" | "location"} */ (
            kind === "Entrance" ? "entrance" : "location"
          ),
          name: stringOf(args[0], scope),
        };
        return apply("and", spot, atom("lamp"), scope.when, line);
      }
      // Where an item may be placed, not what Link reaches: data of its own
      case "forbid_item": {
        const spot = fillSpot(ctx, args[0] ?? found, scope);
        fill.forbid.push({
          ...itemNamed(ctx.dialect.dungeonCodes, stringOf(args[1], scope)),
          location: spot,
          source: `Rules.py:${line}`,
          when: print(scope.when),
        });
        return;
      }
      case "set_always_allow": {
        const spot = fillSpot(ctx, args[0] ?? found, scope);
        fill.always.push({
          ...alwaysAllowed(ctx, args[1], scope),
          location: spot,
          source: `Rules.py:${line}`,
          when: print(scope.when),
        });
        return;
      }
      case "add_item_rule":
        fill.itemRules.push({
          location: fillSpot(ctx, args[0] ?? found, scope),
          source: `Rules.py:${line}`,
        });
        return;
      default: {
        const hook = ctx.dialect.statement;
        if (
          hook?.({
            apply,
            call: found,
            ctx,
            line,
            name,
            scope,
            unported: (code, at, why) => unported.push({ code, line: at, why }),
            walk,
          })
        )
          return;
        const why = ctx.dialect.code[name];
        if (why !== undefined) throw new Untranslatable(why);
        if (/^\w+_rules$/.test(name))
          return walk(functionBody(source, name, "Rules.py").body, scope);
        throw new Untranslatable(`a call of ${name}`);
      }
    }
  };

  walk(functionBody(source, "set_rules", "Rules.py").body, {
    env: new Map(),
    when: TRUE,
  });
  return { allItemsRules, bombShop, fill, spots, unported };
}

/**
 * The boss rules of Bosses.py: each `XDefeatRule(state, player)`, a body of
 * `if …: return …` and a last `return …`, as one rule.
 * @param {Context} ctx
 * @param {string} source
 * @param {string} name
 */
export function bossFunction(ctx, source, name) {
  const fn = functionBody(source, name, "Bosses.py");
  const scope = { env: new Map(), when: TRUE };
  /**
   * @param {Statement[]} statements
   * @returns {Rule}
   */
  const rest = (statements) => {
    const [first, ...others] = statements;
    if (first === undefined) throw new Untranslatable("no return");
    const expr = (/** @type {string} */ text) => {
      const stream = tokens(text, 0, "Bosses.py", first.line);
      return translate(ctx, expression(stream), scope);
    };
    if (first.text.startsWith("return "))
      return expr(first.text.slice("return ".length));
    if (first.text.startsWith("if ") && first.block) {
      const test = expr(first.text.slice("if ".length));
      const then = rest(first.body);
      const otherwise = rest(others);
      // if test: return True / False reads as or / and, whatever test is
      if (key(then) === "true") return any(test, otherwise);
      if (key(then) === "false") return all(negate(test), otherwise);
      return any(all(test, then), all(negate(test), otherwise));
    }
    throw new Untranslatable(`a statement of ${name}`);
  };
  return { line: fn.line, rule: rest(fn.body) };
}

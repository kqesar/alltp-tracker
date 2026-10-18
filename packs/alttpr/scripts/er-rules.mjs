/// <reference types="node" />
// Translates the entrance randomizer's access rules into the engine's rule
// language, for import-er.mjs.
//
// The entrance randomizer sets its rules in Python (Rules.py): each
// `set_rule(spot, lambda state: …)` replaces the rule of an entrance or a
// location, each `add_rule` ands one to it, in the order set_rules calls
// them. This walks that order on the path vt takes (No Glitches, the Open or
// Standard world, no retro), reads each lambda as an expression tree
// (python.mjs) and translates it: an item through ITEMS, a `state.*`
// method through METHODS, a boss through Bosses.py, a branch on the world's
// settings into `setting()`. The rules of one spot fold into one: a rule
// set under a condition on the settings W is `W & new | !W & old`, one added
// `old & (!W | new)`, so the settings still fold at compile time.
//
// A rule that asks where an item sits (`item_name`, `item_in_locations`) is
// `maybe`, as the pack's rules read vt's (keys.ts). What is real code rather
// than a rule (the big bomb's routes, the bunny's paths, Turtle Rock's key
// doors, the save-and-quit points), or reads how the entrances are
// connected, is listed in `unported` with its line, never dropped: the
// world built from the noted entrances ports it by hand. What only decides
// where the randomizer may place an item (forbid_item, add_item_rule,
// set_always_allow) has no part in what Link can reach; its lines are listed
// in `fill`.

import {
  assigned,
  body,
  callExpressions,
  expression,
  functionBody,
  tokens,
} from "./python.mjs";

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
const TRUE = { k: "const", v: "true" };
/** @type {Rule} */
const FALSE = { k: "const", v: "false" };
/** @type {Rule} */
const MAYBE = { k: "const", v: "maybe" };

/** @param {string} text @returns {Rule} */
const atom = (text) => ({ k: "atom", text });
/** @param {string} name @returns {Rule} */
const setting = (name) => ({ k: "setting", name, negated: false });

/** Something the translation cannot express, with why. */
class Untranslatable extends Error {}

/**
 * A junction of `args`, flattened, its constants folded and its repeats and
 * absorbed terms (`a | a & b` is `a`) dropped: Kleene logic is a lattice,
 * where absorption holds.
 * @param {"and" | "or"} k
 * @param {Rule[]} args
 * @returns {Rule}
 */
function junction(k, args) {
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
function assume(rule, facts) {
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
const ITEM_COUNT = /^([a-z]\w*)(?: >= (\d+))?$/;

/**
 * At least `count` of an item: `bow`, `bottle >= 2`; none is `true`.
 * @param {string} id
 * @param {number} count
 */
const atLeast = (id, count) =>
  count === 0 ? TRUE : atom(count === 1 ? id : `${id} >= ${count}`);

/** @param {Rule[]} args */
const all = (...args) => junction("and", args);
/** @param {Rule[]} args */
const any = (...args) => junction("or", args);

/**
 * The negation of a rule. The language negates settings only: an item
 * under a `not` stays one, which a second negation clears (`if not x:
 * return False` reads as `x & …`) and which cannot be printed.
 * @param {Rule} rule
 * @returns {Rule}
 */
function negate(rule) {
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
const settingsOnly = (rule) =>
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
const key = (rule) => render(rule, false);

// ---------------------------------------------------------------------------
// Names

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
const pascal = (name) => {
  const id = regionId(name);
  return id.charAt(0).toUpperCase() + id.slice(1);
};

/**
 * The randomizer's items as the pack's state counts them (items.ts): an id,
 * and the level of it the item is. Progressive items reach their levels in
 * order (BaseClasses.py collect), so `has('Master Sword')` is the second
 * sword.
 * @type {Readonly<Record<string, readonly [string, number?]>>}
 */
export const ITEMS = {
  "Beat Agahnim 1": ["defeatAgahnim"],
  "Beat Agahnim 2": ["defeatAgahnim2"],
  "Blue Boomerang": ["boomerang"],
  "Blue Pendant": ["pendantOfPower"],
  "Blue Shield": ["shield", 1],
  Bombos: ["bombos"],
  "Book of Mudora": ["bookOfMudora"],
  Bow: ["bow", 1],
  "Bug Catching Net": ["bugCatchingNet"],
  "Cane of Byrna": ["caneOfByrna"],
  "Cane of Somaria": ["caneOfSomaria"],
  Cape: ["cape"],
  "Crystal 1": ["crystal1"],
  "Crystal 2": ["crystal2"],
  "Crystal 3": ["crystal3"],
  "Crystal 4": ["crystal4"],
  "Crystal 5": ["crystal5"],
  "Crystal 6": ["crystal6"],
  "Crystal 7": ["crystal7"],
  Ether: ["ether"],
  "Fighter Sword": ["sword", 1],
  "Fire Rod": ["fireRod"],
  Flippers: ["flippers"],
  "Golden Sword": ["sword", 4],
  "Green Pendant": ["pendantOfCourage"],
  Hammer: ["hammer"],
  Hookshot: ["hookshot"],
  "Ice Rod": ["iceRod"],
  Lamp: ["lamp"],
  "Magic Mirror": ["magicMirror"],
  "Magic Powder": ["powder"],
  "Magic Upgrade (1/2)": ["magic", 1],
  "Magic Upgrade (1/4)": ["magic", 2],
  "Master Sword": ["sword", 2],
  "Mirror Shield": ["shield", 3],
  "Moon Pearl": ["moonPearl"],
  Mushroom: ["mushroom"],
  Ocarina: ["flute", 1],
  "Pegasus Boots": ["pegasusBoots"],
  "Power Glove": ["glove", 1],
  Quake: ["quake"],
  "Red Boomerang": ["redBoomerang"],
  "Red Pendant": ["pendantOfWisdom"],
  "Red Shield": ["shield", 2],
  Shovel: ["shovel"],
  "Tempered Sword": ["sword", 3],
  "Titans Mitts": ["glove", 2],
};

/** The dungeons' codes in the pack's key ids (items.ts): keyP2, bigKeyD1. */
export const DUNGEON_CODES = {
  "Agahnims Tower": "A1",
  "Desert Palace": "P2",
  "Eastern Palace": "P1",
  Escape: "H2",
  "Ganons Tower": "A2",
  "Ice Palace": "D5",
  "Misery Mire": "D6",
  "Palace of Darkness": "D1",
  "Skull Woods": "D3",
  "Swamp Palace": "D2",
  "Thieves Town": "D4",
  "Tower of Hera": "P3",
  "Turtle Rock": "D7",
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
function holding(ctx, name, count) {
  const event = ctx.events.get(name);
  const key = /^(Small|Big) Key \((.+)\)$/.exec(name);
  /** @type {readonly [string, number?] | undefined} */
  let item = ITEMS[name];
  if (event !== undefined) {
    item = [event];
    ctx.heldEvents.add(name);
  } else if (key !== null) {
    const code =
      DUNGEON_CODES[/** @type {keyof typeof DUNGEON_CODES} */ (key[2])];
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
 * The world's settings a rule reads, on vt's path: an attribute's value by
 * what it is compared with, or a flag. `false` is a value vt never gives
 * this world (logic other than No Glitches, Inverted, the retro world, the
 * triforce goals the pack does not model); the dungeon items are
 * keysanity only when vt passes --keysanity, for its `full` dungeon items
 * (vt app/EntranceRandomizer.php:69-71), which alone make big keys wild.
 * @type {Readonly<Record<string, Readonly<Record<string, Rule>> | Rule>>}
 */
const WORLD = {
  accessibility: { locations: setting("locationsAccessibility") },
  // BaseClasses.py:75; ItemList.py turns it off for the OHKO timers
  can_take_damage: negate(setting("cantTakeDamage")),
  // BaseClasses.py:47-48, and Main.py's copy of the world
  dark_world_light_cone: FALSE,
  goal: {
    completionist: setting("completionistGoal"),
    crystals: setting("fastGanonGoal"),
    dungeons: setting("dungeonsGoal"),
    ganon: setting("ganonGoal"),
    ganonhunt: FALSE,
    pedestal: setting("pedestalGoal"),
    triforcehunt: FALSE,
  },
  keysanity: setting("wildBigKeys"),
  light_world_light_cone: FALSE,
  logic: { minorglitches: FALSE, noglitches: TRUE, nologic: FALSE },
  mode: {
    inverted: FALSE,
    open: negate(setting("standardMode")),
    standard: setting("standardMode"),
  },
  retro: FALSE,
  // BaseClasses.py:46
  sewer_light_cone: setting("standardMode"),
  shuffle: { vanilla: FALSE },
  swords: { swordless: setting("swordless") },
};

/**
 * The numbers the rules read off the world.
 * @type {Readonly<Record<string, string | number>>}
 */
const WORLD_NUMBERS = {
  crystals_needed_for_ganon: "crystalsGanon",
  crystals_needed_for_gt: "crystalsTower",
  // ItemList.py's pools set 1, the only value vt's pools give
  lamps_needed_for_dark_rooms: 1,
};

/**
 * The attribute `name` of the world, if `expr` reads one: `world.goal`,
 * `state.world.goal`.
 * @param {Expr} expr
 */
function worldAttribute(expr) {
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
 * @param {Expr | undefined} expr
 * @param {number} otherwise - When no argument is passed
 * @returns {number | string} A number, or a numeric setting's name
 */
function numberOf(expr, otherwise) {
  if (expr === undefined) return otherwise;
  if (expr.t === "const" && typeof expr.value === "number") return expr.value;
  const name = worldAttribute(expr);
  const value = name === undefined ? undefined : WORLD_NUMBERS[name];
  if (value === undefined) throw new Untranslatable("a number of the world");
  return value;
}

// ---------------------------------------------------------------------------
// The translation

/**
 * Everything a translation reads besides the expression.
 * @typedef {{
 *   regionOfLocation: ReadonlyMap<string, string>,
 *   regionOfEntrance: ReadonlyMap<string, string>,
 *   bossOfRegion: (region: string, level?: string) => string,
 *   events: ReadonlyMap<string, string>,
 *   heldEvents: Set<string>,
 *   itemNames: ReadonlySet<string>,
 *   potionShops: readonly string[],
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
 * @typedef {{ kind: "lightWorld" | "allItemsReach", region: string, source: string }
 *   | { kind: "swampPatch", source: string }} Derived
 */

/**
 * A derived setting, recorded with what it reads.
 * @param {Context} ctx
 * @param {string} name
 * @param {Derived} derived
 */
function derive(ctx, name, derived) {
  ctx.derived.set(name, derived);
  return setting(name);
}

/**
 * A named rule of the translation, `@name`, defined once.
 * @param {Context} ctx
 * @param {string} name
 * @param {() => Rule} define
 * @param {string} source
 * @returns {Rule}
 */
function helper(ctx, name, define, source) {
  if (!ctx.helpers.has(name)) {
    // Taken before it is defined, so a helper calling itself cannot loop
    ctx.helpers.set(name, { req: "", source });
    ctx.helpers.set(name, { req: print(define()), source });
  }
  return atom(`@${name}`);
}

/**
 * The state's methods the rules call (BaseClasses.py, CollectionState), as
 * helpers named after them: `has_Boots` is `@erHasBoots`. An argument other
 * than the default goes into the name: `can_kill_most_things(player, 8)` is
 * `@erCanKillMostThings8`.
 * @type {Readonly<Record<string, (ctx: Context, args: Expr[]) => Rule>>}
 */
const METHODS = {
  can_avoid_lasers: (ctx) =>
    method(ctx, "can_avoid_lasers", "", () =>
      any(atom("shield >= 3"), atom("caneOfByrna"), atom("cape")),
    ),
  can_extend_magic: (ctx, [, small, full]) => {
    const magic = Number(numberOf(small, 16));
    const refill =
      full !== undefined && full.t === "const" && full.value === true;
    return method(
      ctx,
      "can_extend_magic",
      `${magic}${refill ? "Full" : ""}`,
      () => extendMagic(ctx, magic, refill),
    );
  },
  can_get_good_bee: (ctx) =>
    method(ctx, "can_get_good_bee", "", () => {
      // is_not_bunny: the pearl, or the cave lies in the light world, which
      // hangs on the entrances (mark_light_world_regions): a setting the
      // world built from them gives
      const cave = regionId("Good Bee Cave");
      return all(
        METHODS.has_bottle?.(ctx, []) ?? FALSE,
        atom("bugCatchingNet"),
        any(
          atom("pegasusBoots"),
          all(METHODS.has_sword?.(ctx, []) ?? FALSE, atom("quake")),
        ),
        atom(`reach(${cave})`),
        any(
          atom("moonPearl"),
          derive(ctx, `lightWorld_${cave}`, {
            kind: "lightWorld",
            region: "Good Bee Cave",
            source: `BaseClasses.py:${ctx.methodLine("is_not_bunny")}`,
          }),
        ),
      );
    }),
  can_kill_most_things: (ctx, [, enemies]) => {
    const count = Number(numberOf(enemies, 5));
    return method(
      ctx,
      "can_kill_most_things",
      count === 5 ? "" : `${count}`,
      () =>
        any(
          METHODS.has_blunt_weapon?.(ctx, []) ?? FALSE,
          atom("caneOfSomaria"),
          all(
            atom("caneOfByrna"),
            count < 6 ? TRUE : (METHODS.can_extend_magic?.(ctx, []) ?? FALSE),
          ),
          METHODS.can_shoot_arrows?.(ctx, []) ?? FALSE,
          atom("fireRod"),
          // has('Bombs (10)') and enemies < 6
          count < 6 ? atom("tenBombs") : FALSE,
        ),
    );
  },
  can_lift_heavy_rocks: (ctx) =>
    method(ctx, "can_lift_heavy_rocks", "", () => atom("glove >= 2")),
  can_lift_rocks: (ctx) =>
    method(ctx, "can_lift_rocks", "", () => atom("glove")),
  can_melt_things: (ctx) =>
    method(ctx, "can_melt_things", "", () =>
      any(
        atom("fireRod"),
        all(atom("bombos"), METHODS.has_sword?.(ctx, []) ?? FALSE),
      ),
    ),
  // Not the retro world, whose arrows are bought
  can_shoot_arrows: (ctx) =>
    method(ctx, "can_shoot_arrows", "", () => atom("bow")),
  has_Boots: (ctx) => method(ctx, "has_Boots", "", () => atom("pegasusBoots")),
  has_beam_sword: (ctx) =>
    method(ctx, "has_beam_sword", "", () => atom("sword >= 2")),
  has_blunt_weapon: (ctx) =>
    method(ctx, "has_blunt_weapon", "", () =>
      any(METHODS.has_sword?.(ctx, []) ?? FALSE, atom("hammer")),
    ),
  has_bottle: (ctx) => method(ctx, "has_bottle", "", () => atom("bottle")),
  has_crystals: (_ctx, [count]) => {
    const n = numberOf(count, 7);
    return atom(
      `count(crystal) >= ${typeof n === "number" ? n : `setting(${n})`}`,
    );
  },
  has_fire_source: (ctx) =>
    method(ctx, "has_fire_source", "", () =>
      any(atom("fireRod"), atom("lamp")),
    ),
  // heart_count: the 3 hearts Link starts with, the containers and a heart
  // per 4 pieces. Each is capped by the item pool's difficulty, at 2
  // containers and 8 pieces at the lowest (ItemList.py difficulties): no
  // cap binds while 2 hearts or fewer are wanted. Hearts are no
  // advancement items, so a seed's fill never counts them, but the
  // randomizer's tests collect them as such (TestMiseryMire.py:72): the
  // rule stands as it is written
  has_hearts: (ctx, [, count]) => {
    const wanted = Number(numberOf(count, 0)) - 3;
    if (wanted > 2) throw new Untranslatable(`${wanted} hearts, past a cap`);
    return method(ctx, "has_hearts", `${wanted + 3}`, () =>
      any(
        ...Array.from({ length: wanted + 1 }, (_, pieces) =>
          all(
            atLeast("heartContainer", wanted - pieces),
            atLeast("pieceOfHeart", 4 * pieces),
          ),
        ),
      ),
    );
  },
  has_Mirror: (ctx) => method(ctx, "has_Mirror", "", () => atom("magicMirror")),
  // The medallion the seed asks for: the pack's pad rules (medallions.ts)
  has_misery_mire_medallion: () => atom("@hasMireMedallion"),
  has_Pearl: (ctx) => method(ctx, "has_Pearl", "", () => atom("moonPearl")),
  has_sword: (ctx) => method(ctx, "has_sword", "", () => atom("sword")),
  has_turtle_rock_medallion: () => atom("@hasTurtleRockMedallion"),
};

/**
 * A method's helper, `@er` and its name in PascalCase, then `suffix`.
 * @param {Context} ctx
 * @param {string} name
 * @param {string} suffix
 * @param {() => Rule} define
 */
const method = (ctx, name, suffix, define) =>
  helper(
    ctx,
    `er${pascal(name)}${suffix}`,
    define,
    `BaseClasses.py:${ctx.methodLine(name)}`,
  );

/**
 * can_extend_magic: Link's whole magic is at least `small` (BaseClasses.py
 * 423-436). 8, 16 with half magic, 32 with quarter magic; with a potion
 * shop in reach, each bottle refills it all, or a half with hard item
 * functionality and a quarter with expert, unless `refill` asks for full
 * bottles (the halves round down). The pack's bottle magic flags are those
 * functionalities (settings.ts).
 * @param {Context} ctx
 * @param {number} small
 * @param {boolean} refill
 */
function extendMagic(ctx, small, refill) {
  const shop = any(
    ...ctx.potionShops.map((r) => atom(`reach(${regionId(r)})`)),
  );
  /** @param {number} share */
  const ways = (share) =>
    any(
      ...[8, 16, 32].map((base, level) => {
        const upgrade = level === 0 ? TRUE : atLeast("magic", level);
        if (base >= small) return upgrade;
        for (let bottles = 1; bottles <= 4; bottles++) {
          if (base + Math.floor(base * share * bottles) >= small)
            return all(upgrade, shop, atLeast("bottle", bottles));
        }
        return FALSE;
      }),
    );
  const full = ways(1);
  if (refill) return full;
  const halves = ways(0.5);
  const quarters = ways(0.25);
  if (key(halves) === key(full) && key(quarters) === key(full)) return full;
  const half = setting("halfBottleMagic");
  const quarter = setting("quarterBottleMagic");
  // if hard … elif expert … else: the whole bottle
  return any(
    all(half, halves),
    all(negate(half), quarter, quarters),
    all(negate(half), negate(quarter), full),
  );
}

/**
 * The name a spot expression names: `world.get_entrance('X', player)`, or
 * one of the loop's names.
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {{ kind: "entrance" | "location", name: string }}
 */
function spotOf(expr, scope) {
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
  throw new Untranslatable("a spot other than an entrance or a location");
}

/**
 * A string an expression gives: a literal, or a loop's name.
 * @param {Expr | undefined} expr
 * @param {Scope} scope
 */
function stringOf(expr, scope) {
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
function regionOf(ctx, spot) {
  const region = (
    spot.kind === "location" ? ctx.regionOfLocation : ctx.regionOfEntrance
  ).get(spot.name);
  if (region === undefined)
    throw new Untranslatable(`no ${spot.kind} ${spot.name}`);
  return region;
}

/**
 * The boss a `….parent_region.dungeon.boss` (or `.bosses['top']`) of a
 * spot fights, as its helper.
 * @param {Context} ctx
 * @param {Expr} expr - What `.can_defeat` is called on
 * @param {Scope} scope
 */
function bossRule(ctx, expr, scope) {
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
  return atom(`@erDefeat${pascal(ctx.bossOfRegion(region, level))}`);
}

/**
 * A Python expression of a rule, as a rule.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {Rule}
 */
function translate(ctx, expr, scope) {
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
      return comparison(expr, scope);
    case "attr": {
      const name = worldAttribute(expr);
      const value = name === undefined ? undefined : WORLD[name];
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
      throw new Untranslatable("a subscript");
    default:
      throw new Untranslatable(`an expression (${expr.t})`);
  }
}

/**
 * A comparison: of a setting with its value, or of what a location holds
 * (`item_name(…) == (…)`), which a tracker does not know.
 * @param {Extract<Expr, { t: "compare" }>} expr
 * @param {Scope} scope
 * @returns {Rule}
 */
function comparison(expr, scope) {
  const { left, op, right } = expr;
  if (
    left.t === "call" &&
    left.fn.t === "name" &&
    left.fn.name === "item_name" &&
    ["==", "in"].includes(op)
  )
    return MAYBE;
  const name = worldAttribute(left);
  const values = name === undefined ? undefined : WORLD[name];
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
    return atom(`reach(${regionId(stringOf(fn.of.args[0], scope))})`);
  if (fn.of.t !== "name" || fn.of.name !== "state")
    throw new Untranslatable(`a call of ${fn.name}`);
  switch (fn.name) {
    case "has":
    case "has_key": {
      const item = stringOf(args[0], scope);
      const counted = args[2];
      // A count a local function gives by what a location holds
      if (counted?.t === "call" && counted.fn.t === "name") {
        const fn = localFunction(counted.fn.name, scope);
        if (fn !== undefined)
          return any(
            ...placedCounts(fn).map(({ count, placed }) =>
              all(placed ? MAYBE : TRUE, holding(ctx, item, count)),
            ),
          );
      }
      const count = numberOf(counted, 1);
      if (typeof count !== "number") throw new Untranslatable("a count");
      return holding(ctx, item, count);
    }
    case "can_reach": {
      const target = stringOf(args[0], scope);
      const hint = args[1] === undefined ? "Region" : stringOf(args[1], scope);
      if (hint === "Region") return atom(`reach(${regionId(target)})`);
      if (hint === "Location") {
        ctx.reachedLocations.add(target);
        return atom(`@erAt${pascal(target)}`);
      }
      if (hint === "Entrance") {
        ctx.reachedEntrances.add(target);
        return atom(`@erThrough${pascal(target)}`);
      }
      throw new Untranslatable(`can_reach of an ${hint}`);
    }
    default: {
      const translation = METHODS[fn.name];
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
function localFunction(name, scope) {
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

/** Rule functions that are code rather than rules, by what they do. */
const CODE = {
  set_bunny_rules:
    "the bunny's paths, by which regions the entrances make dark",
};

/**
 * Parses a logical line as an expression, from its start.
 * @param {Statement} statement
 * @param {string} text
 */
function parse(statement, text) {
  const stream = tokens(text, 0, "Rules.py", statement.line);
  const found = expression(stream);
  return { found, stream };
}

/**
 * Walks Rules.py's statements from set_rules, on vt's path, into the rules
 * of every spot.
 * @param {string} source - Rules.py
 * @param {Context} ctx
 */
function walkRules(source, ctx) {
  /** @type {Map<string, { kind: "entrance" | "location", name: string, rule: Rule, source: number[] }>} */
  const spots = new Map();
  /** @type {{ code: string, line: number, why: string }[]} */
  const unported = [];
  /** @type {number[]} */
  const fill = [];
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
      if (key(when) !== "true")
        throw new Untranslatable("a bomb shop case under a setting");
      if (bombShop !== undefined && bombShop.spot !== spot.name)
        throw new Untranslatable("bomb shop cases on two entrances");
      bombShop ??= { cases: [], spot: spot.name };
      bombShop.cases.push({
        doors,
        req: print(rule),
        source: `Rules.py:${line}`,
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
        if (!(error instanceof Untranslatable)) throw error;
        unported.push({
          code: text.length > 100 ? `${text.slice(0, 99)}…` : text,
          line,
          why: error.message,
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
        const boss = ctx.bossOfRegion(regionOf(ctx, spot));
        return apply(
          "set",
          spot,
          atom(`@erDefeat${pascal(boss)}`),
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
      case "forbid_item":
      case "add_item_rule":
      case "set_always_allow":
        fill.push(line);
        return;
      default: {
        const why = CODE[/** @type {keyof typeof CODE} */ (name)];
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
function bossFunction(ctx, source, name) {
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

/**
 * The entrance randomizer's rules on vt's path, translated.
 * @param {(file: string) => string} read - A file of the checkout, by name
 * @param {readonly { name: string, locations: readonly unknown[], exits: readonly unknown[] }[]} regions
 *   Regions.py's regions, as import-er.mjs reads them
 */
export function importErRules(read, regions) {
  const rulesSource = read("Rules.py");
  const bossesSource = read("Bosses.py");
  const baseSource = read("BaseClasses.py");
  const dungeonsSource = read("Dungeons.py");
  const itemListSource = read("ItemList.py");
  const regionsSource = read("Regions.py");

  // What the translation assumes of the world, checked where it is set
  for (const line of [
    "self.light_world_light_cone = False",
    "self.dark_world_light_cone = False",
    "self.sewer_light_cone = mode == 'standard'",
  ])
    if (!baseSource.includes(line))
      throw new Error(`BaseClasses.py no longer says ${line}`);

  /** @type {Map<string, string>} */
  const regionOfLocation = new Map();
  /** @type {Map<string, string>} */
  const regionOfEntrance = new Map();
  for (const region of regions) {
    for (const location of region.locations)
      regionOfLocation.set(String(location), region.name);
    for (const exit of region.exits)
      regionOfEntrance.set(String(exit), region.name);
  }

  // The dungeons and their bosses (Dungeons.py create_dungeons), Inverted's
  // aside; boss shuffle is off
  const create = body(dungeonsSource, "create_dungeons", "Dungeons.py");
  /** @type {Map<string, string>} */
  const dungeonOfRegion = new Map();
  /** @type {Map<string, string | null>} */
  const bossOfDungeon = new Map();
  for (const { call } of callExpressions(
    dungeonsSource,
    "make_dungeon",
    "Dungeons.py",
    create.start,
    create.end,
  )) {
    const [name, boss, members] = call.args;
    if (
      name?.t !== "const" ||
      typeof name.value !== "string" ||
      boss?.t !== "const" ||
      members?.t !== "seq"
    )
      throw new Error("Dungeons.py: a make_dungeon of no literals");
    if (name.value.startsWith("Inverted ")) continue;
    bossOfDungeon.set(
      name.value,
      typeof boss.value === "string" ? boss.value : null,
    );
    for (const member of members.items)
      if (member.t === "const" && !dungeonOfRegion.has(String(member.value)))
        dungeonOfRegion.set(String(member.value), name.value);
  }
  /** @type {Map<string, string>} */
  const towerBosses = new Map();
  for (const m of dungeonsSource.matchAll(
    /GT\.bosses\['(\w+)'\] = BossFactory\('([^']+)', player\)/g,
  ))
    towerBosses.set(m[1] ?? "", m[2] ?? "");

  // The shops that sell potions without end (Regions.py shop tables)
  const contents = /** @type {Record<string, unknown>} */ (
    assigned(regionsSource, "default_shop_contents", "Regions.py").value
  );
  const potionShops = Object.entries(contents)
    .filter(([, stock]) => {
      const list =
        stock !== null && typeof stock === "object" && "name" in stock
          ? assigned(regionsSource, String(stock.name), "Regions.py").value
          : stock;
      return /** @type {[string, number][]} */ (list).some(([item]) =>
        ["Green Potion", "Blue Potion"].includes(item),
      );
    })
    .map(([region]) => region);

  // The events: items generate_itempool places at locations it locks
  // (ItemList.py), which no player finds; the pack's own (Agahnim) aside
  const pool = body(itemListSource, "generate_itempool", "ItemList.py");
  /** @type {Map<string, { item: string, location: string, line: number }>} */
  const placed = new Map();
  const within = itemListSource.slice(pool.start + 1, pool.end);
  const offset = itemListSource.slice(0, pool.start + 1).split("\n").length - 1;
  for (const m of within.matchAll(
    /world\.push_item\(world\.get_location\('([^']+)', player\), ItemFactory\('([^']+)', player\), False\)/g,
  )) {
    const item = m[2] ?? "";
    if (ITEMS[item] !== undefined) continue;
    placed.set(item, {
      item,
      line: offset + within.slice(0, m.index).split("\n").length,
      location: m[1] ?? "",
    });
  }
  const events = new Map(
    [...placed.keys()].map((item) => [item, regionId(item)]),
  );

  /** @param {string} name */
  const methodLine = (name) => {
    const at = baseSource.indexOf(`    def ${name}(`);
    if (at < 0) throw new Error(`BaseClasses.py: no def ${name}`);
    return baseSource.slice(0, at).split("\n").length;
  };

  /** @type {Context} */
  const ctx = {
    bossOfRegion: (region, level) => {
      const dungeon = dungeonOfRegion.get(region);
      const boss =
        dungeon === undefined
          ? undefined
          : level === undefined
            ? bossOfDungeon.get(dungeon)
            : towerBosses.get(level);
      if (boss === undefined || boss === null)
        throw new Untranslatable(`no boss in ${region}`);
      return boss;
    },
    derived: new Map(),
    events,
    heldEvents: new Set(),
    helpers: new Map(),
    itemNames: new Set(
      Object.keys(
        /** @type {Record<string, unknown>} */ (
          assigned(read("Items.py"), "item_table", "Items.py").value
        ),
      ),
    ),
    methodLine,
    potionShops,
    reachedEntrances: new Set(),
    reachedLocations: new Set(),
    regionOfEntrance,
    regionOfLocation,
  };

  // Every boss's rule, a helper of its own
  const table = /** @type {Record<string, [string, { name: string }]>} */ (
    assigned(bossesSource, "boss_table", "Bosses.py").value
  );
  for (const [boss, [, rule]] of Object.entries(table)) {
    const { line, rule: req } = bossFunction(ctx, bossesSource, rule.name);
    ctx.helpers.set(`erDefeat${pascal(boss)}`, {
      req: print(req),
      source: `Bosses.py:${line}`,
    });
  }

  const { allItemsRules, bombShop, fill, spots, unported } = walkRules(
    rulesSource,
    ctx,
  );

  // A spot reached (can_reach(…, 'Location' or 'Entrance')): its region,
  // and its rule
  for (const [kind, names, prefix] of /** @type {const} */ ([
    ["location", ctx.reachedLocations, "erAt"],
    ["entrance", ctx.reachedEntrances, "erThrough"],
  ])) {
    for (const name of names) {
      const spot = spots.get(`${kind}:${name}`);
      const region = regionOf(ctx, { kind, name });
      ctx.helpers.set(`${prefix}${pascal(name)}`, {
        req: print(all(atom(`reach(${regionId(region)})`), spot?.rule ?? TRUE)),
        source: `Rules.py:${spot?.source.at(-1) ?? 0}`,
      });
    }
  }

  /** @param {"entrance" | "location"} kind */
  const rulesOf = (kind) =>
    Object.fromEntries(
      [...spots.values()]
        .filter((spot) => spot.kind === kind)
        .map((spot) => [
          spot.name,
          {
            req: print(spot.rule),
            source: spot.source.map((line) => `Rules.py:${line}`),
          },
        ]),
    );

  // The entrances whose rule differs, then, from what it ends as
  const final = rulesOf("entrance");
  const allItemsReach = Object.fromEntries(
    Object.entries(final).flatMap(([name, { req }]) => {
      const then = allItemsRules?.get(name) ?? "true";
      return then === req ? [] : [[name, then]];
    }),
  );

  // The bunny's lists (set_bunny_rules), which the world ports
  const bunny = body(rulesSource, "set_bunny_rules", "Rules.py");
  const bunnySource = rulesSource.slice(bunny.start + 1, bunny.end);
  const bunnyLine = rulesSource.slice(0, bunny.start + 1).split("\n").length;
  /** @param {string} name */
  const bunnyList = (name) => {
    const { line, value } = assigned(bunnySource, name, "Rules.py", "\\s+");
    return { line: bunnyLine + line - 1, value };
  };

  return {
    allItemsReach,
    bombShop,
    bunny: {
      accessibleLocations: bunnyList("bunny_accessible_locations"),
      impassableCaves: bunnyList("bunny_impassable_caves"),
    },
    derived: Object.fromEntries(
      [...ctx.derived.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    entrances: final,
    events: Object.fromEntries(
      [...placed.values()]
        .filter(({ item }) => ctx.heldEvents.has(item))
        .map(({ item, line, location }) => [
          regionId(item),
          { item, location, source: `ItemList.py:${line}` },
        ]),
    ),
    fill: [...new Set(fill)],
    helpers: Object.fromEntries(
      [...ctx.helpers.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    locations: rulesOf("location"),
    unported,
  };
}

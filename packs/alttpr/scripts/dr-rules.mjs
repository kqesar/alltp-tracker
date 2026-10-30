/// <reference types="node" />
// The Door Randomizer's access rules in the engine's language (stage B of
// import-dr.mjs): DR's Rules.py and Bosses.py at the release upstream.json
// pins, read as data and never run.
//
// DR's Rules.py descends from the entrance randomizer's, so the walk and
// the translation are rules-core.mjs's, under DR's dialect: its settings
// (Open, Standard and Inverted are all settings here, as is the bomb bag,
// the bow mode, the key shuffle), its items (the bomb upgrade, the
// activated flute, the triforce pieces), and the state's methods as DR's
// BaseClasses.py writes them. The expressions only DR writes:
//
// - `state.can_reach_blue/orange(world.get_region(R))`: an atom
//   `reachedBlue_<R>` / `reachedOrange_<R>`, which the world gives from its
//   crystal states (BaseClasses.py:628-714); each read is listed in
//   `crystal`, by spot, for the world to restrict a region's own exits to its
//   copy instead.
// - `not state.has('Trench 1 Filled')`: true. The player may leave the
//   switch alone, so the dry path stays open (Rules.py:417-419, 430); listed
//   in `negatedEvents`.
// - `world.get_region(R).dungeon.bosses[level].can_defeat` and the boss's
//   `.name == …`: the vanilla boss of that slot (Dungeons.py).
// - `state.is_door_open`, `has_sm_key`, `item_count`, `everything`.
//
// The statements only DR writes: add_bunny_rule (the pearl, or a derived
// setting that the spot's region is on Link's own side of the world),
// add_conditional_lamps (its dark rooms' table, read here), and the rules
// built in code by the enemy logic (kill rooms, drops, pots), which
// dr-enemies.mjs translates.

import { enemyRules, readEnemyData } from "./dr-enemies.mjs";
import { drRegionId } from "./dr-world-data.mjs";
import {
  ITEMS as ER_ITEMS,
  METHODS as ER_METHODS,
  extendMagic,
} from "./er-rules.mjs";
import {
  assigned,
  body,
  functionBody,
  pythonExpression,
  pythonLiteral,
} from "./python.mjs";
import {
  all,
  any,
  atom,
  bossFunction,
  derive,
  FALSE,
  holding,
  idOf,
  MAYBE,
  method,
  negate,
  numberOf,
  pascal,
  print,
  regionOf,
  setting,
  stringOf,
  TRUE,
  translate,
  Untranslatable,
  walkRules,
  worldAttribute,
} from "./rules-core.mjs";

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {import("./rules-core.mjs").Rule} Rule
 * @typedef {import("./rules-core.mjs").Context} Context
 * @typedef {import("./rules-core.mjs").Dialect} Dialect
 * @typedef {import("./rules-core.mjs").Scope} Scope
 * @typedef {Context & {
 *   bossOfRegion: (region: string, level?: string) => string,
 * }} DrContext
 *   The core's context, and the vanilla boss of a region's dungeon, which
 *   DR's boss expressions compare by name.
 */

/**
 * DR's items as the pack's state counts them: the entrance randomizer's,
 * and those DR adds. The bomb upgrade and the triforce pieces are new atoms,
 * which the DR world adds to the state (`newItems` lists them).
 * @type {Readonly<Record<string, readonly [string, number?]>>}
 */
export const ITEMS = {
  ...ER_ITEMS,
  // BaseClasses.py:1208, bombbag
  "Bomb Upgrade (+10)": ["bombUpgrade"],
  // The second level of the flute (Items.py: activated, the bird called)
  "Ocarina (Activated)": ["flute", 2],
  "Power Star": ["powerStar"],
  "Triforce Piece": ["triforcePiece"],
};

/** The items the DR world adds to the pack's state (the translation's atoms). */
export const NEW_ITEMS = [
  // Hyrule Castle's big key, which DR places (Standard: Zelda's cell)
  "bigKeyH2",
  "bombUpgrade",
  "powerStar",
  "triforcePiece",
];

/** DR's dungeons in the pack's key ids: ER's names, Hyrule Castle as Escape. */
const DUNGEON_CODES = {
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
 * DR's settings on the No Glitches path. Open, Standard and Inverted are
 * settings (Inverted's rules and connections are in DR, not a world of
 * their own); the glitched logics are `false` (unmodelled, owner's decision
 * 2026-10-29). The dungeon items: `keyshuffle` none/wild/universal,
 * `bigkeyshuffle`; `difficulty_adjustments` hard and expert are the pack's
 * bottle magic settings, as the item functionality they are.
 * @type {Readonly<Record<string, Readonly<Record<string, Rule>> | Rule>>}
 */
const WORLD = {
  accessibility: { locations: setting("locationsAccessibility") },
  bombbag: setting("bombBag"),
  // BaseClasses.py; ItemList.py turns it off for the OHKO timers
  can_take_damage: negate(setting("cantTakeDamage")),
  difficulty_adjustments: {
    expert: setting("quarterBottleMagic"),
    hard: setting("halfBottleMagic"),
    normal: all(
      negate(setting("halfBottleMagic")),
      negate(setting("quarterBottleMagic")),
    ),
  },
  // Doors stay vanilla until door shuffle is modelled (study step 6)
  doorShuffle: {
    basic: setting("basicDoors"),
    crossed: setting("crossedDoors"),
    partitioned: setting("partitionedDoors"),
    vanilla: setting("vanillaDoors"),
  },
  // Main.py:104: in progress, never set by a seed
  free_lamp_cone: FALSE,
  goal: {
    completionist: setting("completionistGoal"),
    crystals: setting("fastGanonGoal"),
    dungeons: setting("dungeonsGoal"),
    ganon: setting("ganonGoal"),
    ganonhunt: setting("ganonHuntGoal"),
    pedestal: setting("pedestalGoal"),
    triforcehunt: setting("triforceHuntGoal"),
    trinity: setting("trinityGoal"),
  },
  key_logic_algorithm: {
    dangerous: setting("dangerousKeyLogic"),
    partial: setting("partialKeyLogic"),
    strict: setting("strictKeyLogic"),
  },
  keyshuffle: {
    none: all(
      negate(setting("wildSmallKeys")),
      negate(setting("universalKeys")),
    ),
    universal: setting("universalKeys"),
    wild: setting("wildSmallKeys"),
  },
  logic: {
    hybridglitches: FALSE,
    minorglitches: FALSE,
    noglitches: TRUE,
    nologic: FALSE,
    owglitches: FALSE,
  },
  mode: {
    inverted: setting("invertedMode"),
    open: all(negate(setting("standardMode")), negate(setting("invertedMode"))),
    standard: setting("standardMode"),
  },
  pottery: { none: negate(setting("pottery")) },
  restrict_boss_items: { none: negate(setting("restrictBossItems")) },
  // BaseClasses.py:105
  sewer_light_cone: setting("standardMode"),
  shuffle: { vanilla: negate(setting("entranceShuffle")) },
  swords: { swordless: setting("swordless") },
};

/**
 * The numbers the rules read off the world.
 * @type {Readonly<Record<string, string | number>>}
 */
const WORLD_NUMBERS = {
  crystals_needed_for_ganon: "crystalsGanon",
  crystals_needed_for_gt: "crystalsTower",
  treasure_hunt_count: "treasureHunt",
};

/**
 * What the shops sell without end, by item: the regions of shop_table
 * whose inventory holds it (Regions.py, has_unlimited, BaseClasses.py
 * 2471-2479), and Inverted's Dark Lake Hylia shop, which create_shops
 * stocks with blue potions (Regions.py:1146-1149).
 * @param {Context} ctx
 * @param {string} item
 * @returns {Rule}
 */
function buyable(ctx, item) {
  const sellers = shopsSelling.get(item) ?? [];
  const reach = (/** @type {string} */ region) =>
    atom(`reach(${idOf(ctx, region)})`);
  return any(
    ...sellers.map(reach),
    item === "Blue Potion"
      ? all(setting("invertedMode"), reach("Dark Lake Hylia Shop"))
      : FALSE,
    // Retro's arrows and keys: shops the vanilla tables do not stock
    ["Single Arrow", "Small Key (Universal)"].includes(item) ? MAYBE : FALSE,
  );
}

/** @type {Map<string, string[]>} */
const shopsSelling = new Map();

/** @param {Context} ctx @param {Expr[]} _args */
const hasSword = (ctx, _args) => ER_METHODS.has_sword?.(ctx, []) ?? FALSE;

/**
 * DR's methods (BaseClasses.py CollectionState), on ER's where DR writes
 * them the same.
 * @type {Readonly<Record<string, (ctx: Context, args: Expr[]) => Rule>>}
 */
const METHODS = {
  ...ER_METHODS,
  can_avoid_lasers: (ctx) =>
    method(ctx, "can_avoid_lasers", "", () =>
      any(
        atom("shield >= 3"),
        atom("cape"),
        all(
          atom("caneOfByrna"),
          negate(setting("halfBottleMagic")),
          negate(setting("quarterBottleMagic")),
        ),
      ),
    ),
  can_extend_magic: (ctx, [, small, full]) => {
    const magic = Number(numberOf(ctx, small, 16));
    const refill =
      full !== undefined && full.t === "const" && full.value === true;
    return method(
      ctx,
      "can_extend_magic",
      `${magic}${refill ? "Full" : ""}`,
      () => extendMagic(ctx, magic, refill),
    );
  },
  can_flute: (ctx) =>
    method(ctx, "can_flute", "", () =>
      all(
        // In Standard, not before Zelda is delivered
        any(
          negate(setting("standardMode")),
          holding(ctx, "Zelda Delivered", 1),
        ),
        any(
          atom("flute >= 2"),
          all(
            atom("flute"),
            atom(`reach(${idOf(ctx, "Kakariko Village")})`),
            notBunny(
              ctx,
              "Kakariko Village",
              `BaseClasses.py:${ctx.methodLine("can_flute")}`,
            ),
          ),
        ),
      ),
    ),
  can_hit_crystal: (ctx) =>
    method(ctx, "can_hit_crystal", "", () =>
      any(
        canUseBombs(ctx),
        canShootArrows(ctx),
        ER_METHODS.has_blunt_weapon?.(ctx, []) ?? FALSE,
        atom("boomerang"),
        atom("redBoomerang"),
        atom("hookshot"),
        atom("fireRod"),
        atom("iceRod"),
        atom("caneOfSomaria"),
        atom("caneOfByrna"),
      ),
    ),
  can_hit_crystal_through_barrier: (ctx) =>
    method(ctx, "can_hit_crystal_through_barrier", "", () =>
      any(
        canUseBombs(ctx),
        canShootArrows(ctx),
        atom("boomerang"),
        atom("redBoomerang"),
        atom("fireRod"),
        atom("iceRod"),
        atom("caneOfSomaria"),
      ),
    ),
  // No bombs branch in DR (BaseClasses.py:1199-1205)
  can_kill_most_things: (ctx, [, enemies]) => {
    const count = Number(numberOf(ctx, enemies, 5));
    return method(
      ctx,
      "can_kill_most_things",
      count === 5 ? "" : `${count}`,
      () =>
        any(
          ER_METHODS.has_blunt_weapon?.(ctx, []) ?? FALSE,
          atom("caneOfSomaria"),
          all(
            atom("caneOfByrna"),
            count < 6 ? TRUE : (METHODS.can_extend_magic?.(ctx, []) ?? FALSE),
          ),
          canShootArrows(ctx),
          atom("fireRod"),
        ),
    );
  },
  can_shoot_arrows: (ctx) => canShootArrows(ctx),
  can_use_bombs: (ctx) => canUseBombs(ctx),
  // completionist: every check; a tracker cannot vouch for it
  everything: () => MAYBE,
  has_sword: hasSword,
};

/**
 * can_use_bombs: no bomb bag, or the upgrade (BaseClasses.py:1208-1209).
 * @param {Context} ctx
 */
const canUseBombs = (ctx) =>
  method(ctx, "can_use_bombs", "", () =>
    any(negate(setting("bombBag")), atom("bombUpgrade")),
  );

/**
 * can_shoot_arrows: the bow, and in the retro bow modes arrows bought or
 * held (BaseClasses.py:1232-1236).
 * @param {Context} ctx
 */
const canShootArrows = (ctx) =>
  method(ctx, "can_shoot_arrows", "", () =>
    all(
      atom("bow"),
      any(negate(setting("retroBow")), buyable(ctx, "Single Arrow")),
    ),
  );

/**
 * is_not_bunny for a region: the pearl, or the region lies on Link's own
 * side of the world (light in Open and Standard, dark in Inverted), which
 * the world built from the entrances gives (mark_light_dark_world_regions,
 * Regions.py:1113).
 * @param {Context} ctx
 * @param {string} region
 * @param {string} source
 */
function notBunny(ctx, region, source) {
  const id = idOf(ctx, region);
  return any(
    atom("moonPearl"),
    derive(ctx, `notBunny_${id}`, {
      kind: "lightWorld",
      region,
      source,
    }),
  );
}

/**
 * The region an expression names: `world.get_region('X', player)`.
 * @param {Expr | undefined} expr
 * @param {Scope} scope
 */
function regionNamed(expr, scope) {
  if (
    expr?.t === "call" &&
    expr.fn.t === "attr" &&
    expr.fn.name === "get_region"
  )
    return stringOf(expr.args[0], scope);
  return undefined;
}

/**
 * The boss slot `….dungeon.bosses['level']` or `….dungeon.boss` of a
 * region: its vanilla boss.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 */
function bossOf(ctx, expr, scope) {
  /** @type {string | undefined} */
  let level;
  let dungeon = expr;
  if (expr.t === "index" && expr.of.t === "attr" && expr.of.name === "bosses") {
    level = stringOf(expr.at, scope);
    dungeon = expr.of.of;
  } else if (expr.t === "attr" && expr.name === "boss") dungeon = expr.of;
  else return undefined;
  if (dungeon.t !== "attr" || dungeon.name !== "dungeon") return undefined;
  const region = regionNamed(dungeon.of, scope);
  if (region === undefined) return undefined;
  return /** @type {DrContext} */ (ctx).bossOfRegion(region, level);
}

/**
 * The record of what the translation found that only DR writes.
 * @type {{ crystal: Map<string, { region: string, color: string }>, negatedEvents: Set<string>, doorsOpen: Set<string>, bosses: Set<string>, uncalled: Set<string>, doorData: Map<string, { door: string, flag: string, vanilla: boolean, source: string }> }}
 */
const found = {
  bosses: new Set(),
  crystal: new Map(),
  /** @type {Map<string, { door: string, flag: string, vanilla: boolean, source: string }>} */
  doorData: new Map(),
  doorsOpen: new Set(),
  negatedEvents: new Set(),
  /** @type {Set<string>} */
  uncalled: new Set(),
};

/**
 * The expressions only DR writes, read before the shared ones.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {Rule | undefined}
 */
function expression(ctx, expr, scope) {
  const shaped =
    doorExpression(ctx, expr, scope) ?? locationExpression(expr, scope);
  if (shaped !== undefined) return shaped;
  // not state.has('Trench 1 Filled'): the dry path, open while the switch
  // is left alone
  if (
    expr.t === "not" &&
    expr.of.t === "call" &&
    expr.of.fn.t === "attr" &&
    expr.of.fn.name === "has" &&
    expr.of.fn.of.t === "name" &&
    expr.of.fn.of.name === "state"
  ) {
    const item = stringOf(expr.of.args[0], scope);
    if (ctx.events.has(item)) {
      found.negatedEvents.add(item);
      return TRUE;
    }
  }
  // state.item_count('Triforce Piece') + state.item_count('Power Star') >= int(…)
  if (expr.t === "compare" && expr.op === ">=") {
    /** @type {string[]} */
    const counted = [];
    /** @param {Expr} e */
    const terms = (e) => {
      if (e.t === "op" && e.op === "+") {
        terms(e.left);
        terms(e.right);
      } else if (
        e.t === "call" &&
        e.fn.t === "attr" &&
        e.fn.name === "item_count"
      ) {
        const item = ITEMS[stringOf(e.args[0], scope)];
        if (item === undefined) throw new Untranslatable("an item count");
        counted.push(item[0]);
      } else throw new Untranslatable("a sum of no item counts");
    };
    terms(expr.left);
    let right = expr.right;
    if (right.t === "call" && right.fn.t === "name" && right.fn.name === "int")
      right = /** @type {Expr} */ (right.args[0]);
    const name = worldAttribute(right.t === "index" ? right.of : right);
    const n = name === undefined ? undefined : WORLD_NUMBERS[name];
    if (n === undefined) throw new Untranslatable("a count of the world");
    return atom(`count(${counted.join(", ")}) >= setting(${n})`);
  }
  if (expr.t === "compare") {
    // ….dungeon.bosses['middle'].name == 'Trinexx': the vanilla boss
    const { left, op, right } = expr;
    if (
      left.t === "attr" &&
      left.name === "name" &&
      (op === "==" || op === "!=")
    ) {
      const boss = bossOf(ctx, left.of, scope);
      if (boss !== undefined) {
        const same = boss === stringOf(right, scope);
        return same === (op === "==") ? TRUE : FALSE;
      }
    }
  }
  if (expr.t !== "call" || expr.fn.t !== "attr") return undefined;
  const { args, fn } = expr;
  // world.get_region('X').dungeon.bosses['bottom'].can_defeat(state)
  if (fn.name === "can_defeat") {
    const boss = bossOf(ctx, fn.of, scope);
    if (boss === undefined) return undefined;
    found.bosses.add(boss);
    return atom(`@drDefeat${pascal(boss)}`);
  }
  if (fn.of.t !== "name" || fn.of.name !== "state") return undefined;
  switch (fn.name) {
    case "can_reach_blue":
    case "can_reach_orange": {
      const region = regionNamed(args[0], scope);
      if (region === undefined) throw new Untranslatable("a crystal read");
      const color = fn.name === "can_reach_blue" ? "Blue" : "Orange";
      found.crystal.set(`${color}:${region}`, { color, region });
      return atom(`reached${color}_${idOf(ctx, region)}`);
    }
    case "has_sm_key":
    case "has_sm_key_strict": {
      const item = stringOf(args[0], scope);
      const count = numberOf(ctx, args[2], 1);
      if (typeof count !== "number") throw new Untranslatable("a key count");
      // Universal keys: the shops sell them (BaseClasses.py:1116-1131)
      return any(
        all(negate(setting("universalKeys")), holding(ctx, item, count)),
        all(setting("universalKeys"), buyable(ctx, "Small Key (Universal)")),
      );
    }
    case "is_door_open": {
      const door = stringOf(args[0], scope);
      found.doorsOpen.add(door);
      return atom(`opened_${idOf(ctx, door)}`);
    }
    case "item_count":
      throw new Untranslatable("an item count outside a sum");
    default:
      return undefined;
  }
}

/** Stage A's doors, by name. @type {Map<string, Record<string, unknown>>} */
const doorsByName = new Map();

/** What a name bound by an assignment stands for. */
class Bound {
  /** @param {"door" | "location"} kind @param {string} name */
  constructor(kind, name) {
    this.kind = kind;
    this.name = name;
  }
}

/**
 * A door's flag as the world gives it: a derived setting, its vanilla value
 * from Doors.py (stage A) recorded in `doorData`, the noted door's once
 * doors shuffle (study step 6).
 * @param {Context} ctx
 * @param {string} door
 * @param {"trapped" | "bigKey" | "smallKey" | "entranceFlag" | "crystalBlue" | "crystalOrange"} flag
 */
function doorFlag(ctx, door, flag) {
  const data = doorsByName.get(door);
  if (data === undefined) throw new Untranslatable(`no door ${door}`);
  const vanilla =
    flag === "crystalBlue"
      ? data.crystal === "blue"
      : flag === "crystalOrange"
        ? data.crystal === "orange"
        : data[flag] === true;
  const name = `door${flag.charAt(0).toUpperCase()}${flag.slice(1)}_${idOf(ctx, door)}`;
  found.doorData.set(name, {
    door,
    flag,
    source: String(data.source),
    vanilla,
  });
  return derive(ctx, name, {
    kind: "door",
    region: door,
    source: String(data.source),
  });
}

/**
 * The door an expression names: `world.get_door('X', player)`,
 * `world.get_entrance('X', player).door`, or a name bound to one.
 * @param {Expr} expr
 * @param {Scope} scope
 */
function doorNamed(expr, scope) {
  if (expr.t === "call" && expr.fn.t === "attr" && expr.fn.name === "get_door")
    return stringOf(expr.args[0], scope);
  if (
    expr.t === "attr" &&
    expr.name === "door" &&
    expr.of.t === "call" &&
    expr.of.fn.t === "attr" &&
    expr.of.fn.name === "get_entrance"
  )
    return stringOf(expr.of.args[0], scope);
  if (expr.t === "name") {
    const value = scope.env.get(expr.name);
    if (value instanceof Bound && value.kind === "door") return value.name;
  }
  return undefined;
}

/**
 * The shapes on doors, the world and the state's methods only DR writes.
 * @param {Context} ctx
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {Rule | undefined}
 */
function doorExpression(ctx, expr, scope) {
  // is_trapped('X') (Rules.py:374-375)
  if (
    expr.t === "call" &&
    expr.fn.t === "name" &&
    expr.fn.name === "is_trapped"
  )
    return doorFlag(ctx, stringOf(expr.args[0], scope), "trapped");
  // bomb_escape_rule(): whether Uncle holds the bombs (Rules.py:1526-1528),
  // a placement
  if (
    expr.t === "call" &&
    expr.fn.t === "name" &&
    expr.fn.name === "bomb_escape_rule"
  )
    return MAYBE;
  // world.is_atgt_swapped(player): Inverted (BaseClasses.py:297-298);
  // world.is_pyramid_open(player): a setting of its own (BaseClasses.py:300)
  if (
    expr.t === "call" &&
    expr.fn.t === "attr" &&
    expr.fn.of.t === "name" &&
    expr.fn.of.name === "world"
  ) {
    if (expr.fn.name === "is_atgt_swapped") return setting("invertedMode");
    if (expr.fn.name === "is_pyramid_open") return setting("openPyramid");
  }
  // door.trapped, door.bigKey, door.smallKey, door.entranceFlag
  if (
    expr.t === "attr" &&
    ["trapped", "bigKey", "smallKey", "entranceFlag"].includes(expr.name)
  ) {
    const door = doorNamed(expr.of, scope);
    if (door !== undefined)
      return doorFlag(
        ctx,
        door,
        /** @type {"trapped" | "bigKey" | "smallKey" | "entranceFlag"} */ (
          expr.name
        ),
      );
  }
  // world.get_door('X').crystal == CrystalBarrier.Blue
  if (
    expr.t === "compare" &&
    (expr.op === "==" || expr.op === "!=") &&
    expr.left.t === "attr" &&
    expr.left.name === "crystal" &&
    expr.right.t === "attr" &&
    expr.right.of.t === "name" &&
    expr.right.of.name === "CrystalBarrier" &&
    ["Blue", "Orange"].includes(expr.right.name)
  ) {
    const door = doorNamed(expr.left.of, scope);
    if (door !== undefined) {
      const rule = doorFlag(
        ctx,
        door,
        expr.right.name === "Blue" ? "crystalBlue" : "crystalOrange",
      );
      return expr.op === "==" ? rule : negate(rule);
    }
  }
  // state.can_flute, the method not called (Rules.py:1986): a bound method
  // is truthy in Python, so the rule holds; ported as written
  if (
    expr.t === "attr" &&
    expr.of.t === "name" &&
    expr.of.name === "state" &&
    ctx.dialect.methods[expr.name] !== undefined
  ) {
    found.uncalled.add(expr.name);
    return TRUE;
  }
  return undefined;
}

/**
 * The names DR binds: `hidden_pits_door = world.get_door(…)`, `loc =
 * world.get_location(…)`.
 * @param {Context} _ctx
 * @param {Expr} value
 * @param {Scope} scope
 */
function assign(_ctx, value, scope) {
  const door = doorNamed(value, scope);
  if (door !== undefined) return new Bound("door", door);
  // world.get_location_unsafe('X', player): the location, or None
  if (
    value.t === "call" &&
    value.fn.t === "attr" &&
    value.fn.name === "get_location_unsafe"
  ) {
    const name = stringOf(value.args[0], scope);
    return typeOf.has(name) ? spotOfLocation(name) : NONE;
  }
  // What the escape's kill rooms read (Rules.py:1543-1545), which the
  // block hook ports: the sewers' builder, the room map, the stats
  for (let at = value; at.t === "attr" || at.t === "index"; at = at.of)
    if (["dungeon_layouts", "data_tables"].includes(worldAttribute(at) ?? ""))
      return NONE;
  return undefined;
}

/** What `get_location_unsafe` gives for a location this seed lacks. */
const NONE = Object.freeze({ none: true });

/**
 * A location as a loop binds it, with its LocationType.
 * @param {string} name
 */
const spotOfLocation = (name) => ({
  kind: "location",
  name,
  type: typeOf.get(name) ?? "Normal",
});

/**
 * The lists DR loops over: `world.get_region('X', player).locations`.
 * @param {Context} _ctx
 * @param {Expr} expr
 * @param {Scope} scope
 */
function list(_ctx, expr, scope) {
  if (expr.t === "attr" && expr.name === "locations") {
    const region = regionNamed(expr.of, scope);
    if (region !== undefined)
      return (locationsOf.get(region) ?? []).map(spotOfLocation);
  }
  // pot_rules' blocks: the pots of a large block (Rules.py:954, a list
  // comprehension the reader leaves; read here from the pots' data)
  if (
    expr.t === "name" &&
    expr.name === "blocks" &&
    rulesSource.includes(
      "blocks = [l for l in world.get_locations() if l.type == LocationType.Pot and l.pot.flags & PotFlags.Block]",
    )
  )
    return [...blockPots].map(spotOfLocation);
  return undefined;
}

/** Each location's LocationType (Regions.py adjust_locations). @type {Map<string, string>} */
const typeOf = new Map();
/** The pots of a large block. @type {Set<string>} */
const blockPots = new Set();

/**
 * A location's type, or its presence: `l.type == LocationType.Pot`, `if
 * loc:` (Rules.py pot_rules).
 * @param {Expr} expr
 * @param {Scope} scope
 * @returns {Rule | undefined}
 */
function locationExpression(expr, scope) {
  /** @param {Expr} e */
  const bound = (e) => (e.t === "name" ? scope.env.get(e.name) : undefined);
  if (expr.t === "name") {
    const value = bound(expr);
    if (value === NONE) return FALSE;
    if (value !== null && typeof value === "object" && "type" in value)
      return TRUE;
  }
  if (
    expr.t === "compare" &&
    (expr.op === "==" || expr.op === "!=") &&
    expr.left.t === "attr" &&
    expr.left.name === "type" &&
    expr.right.t === "attr" &&
    expr.right.of.t === "name" &&
    expr.right.of.name === "LocationType"
  ) {
    const value = bound(expr.left.of);
    if (value !== null && typeof value === "object" && "type" in value) {
      const same = value.type === expr.right.name;
      return same === (expr.op === "==") ? TRUE : FALSE;
    }
  }
  return undefined;
}

/**
 * What the enemy logic reads of the state, through DR's methods
 * (EnemyLogic.py:396-460).
 * @param {Context} ctx
 * @returns {import("./dr-enemies.mjs").Lib}
 */
function enemyLib(ctx) {
  return {
    canUseBombs: () => canUseBombs(ctx),
    extendMagic: (magic, full) =>
      method(
        ctx,
        "can_extend_magic",
        `${String(magic).replace(".", "_")}${full ? "Full" : ""}`,
        () => extendMagic(ctx, magic, full),
      ),
    has: (item, count = 1) => holding(ctx, item, count),
    normalArrows: () => canShootArrows(ctx),
    // can_shoot_silver_arrows (EnemyLogic.py:447-455): retro's silvers
    // need arrows bought
    silverArrows: () =>
      any(
        all(
          negate(setting("retroBow")),
          atom("bow"),
          holding(ctx, "Silver Arrows", 1),
        ),
        all(
          setting("retroBow"),
          holding(ctx, "Silver Arrows", 1),
          buyable(ctx, "Single Arrow"),
        ),
      ),
  };
}

/** Rule functions that are code rather than rules, by what they do. */
const CODE = {
  add_connection: "Standard's save-and-quit to Uncle: an exit the world adds",
  add_hmg_key_logic_rules: "hybrid glitches' key logic (unmodelled)",
  add_key_logic_rules:
    "the key logic: KeyDoorShuffle's analysis of each dungeon (keys, §2.5 of the design)",
  find_rules_for_zelda_delivery:
    "the path Zelda is led by: a search over the world's exits",
  overworld_glitches_rules: "overworld glitches (unmodelled)",
  set_bunny_rules:
    "the bunny's paths, by which regions the entrances make dark",
  underworld_glitches_rules: "underworld glitches (unmodelled)",
};

/**
 * The statements only DR writes.
 * @param {import("./rules-core.mjs").Hook} hook
 */
function statement({ apply, call, ctx, line, name, scope, walk }) {
  if (name === "add_bunny_rule") {
    const spot = spotNamed(call.args[0], scope);
    const region = regionOf(ctx, spot);
    apply(
      "and",
      spot,
      notBunny(ctx, region, `Rules.py:${line}`),
      scope.when,
      line,
    );
    return true;
  }
  // Rule functions not named *_rules, walked as set_rules walks those
  if (name === "forbid_bomb_jump_requirements") {
    walk(functionBody(rulesSource, name, "Rules.py").body, scope);
    return true;
  }
  if (name === "add_conditional_lamps") {
    conditionalLamps(apply, scope, line);
    return true;
  }
  if (name === "challenge_room_rules") {
    challengeRooms(ctx, apply, scope, line, undefined);
    return true;
  }
  if (name === "drop_rules") {
    dropRules(apply, scope, line);
    return true;
  }
  return false;
}

/**
 * The state of the enemy logic for one import.
 * @type {{ rules: ReturnType<typeof enemyRules>, kill: Map<string, { req: string, source: string, sprites: string[] }>, drops: Map<string, { req: string, sprite: string }>, keyDrops: Map<string, [number, number]>, dropLocations: { name: string, region: string, room: number, index: number }[] } | undefined}
 */
let enemies;

/**
 * challenge_room_rules (Rules.py:909-927): each kill room's rule on its
 * doors in (not a portal: an entrance flag lets Link in from outside) and
 * on the doors a trap closes, each kill chest's on its chests. With
 * `regions`, the escape's (standard_rules, Rules.py:1546-1565): only those
 * rooms, and every other location of the sewers gets `escape`.
 * @param {Context} ctx
 * @param {import("./rules-core.mjs").Hook["apply"]} apply
 * @param {Scope} scope
 * @param {number} line
 * @param {{ regions: readonly string[], escape: Rule } | undefined} sewers
 */
function challengeRooms(ctx, apply, scope, line, sewers) {
  if (enemies === undefined) throw new Error("no enemy logic");
  const state = enemies;
  const rooms = assigned(rulesSource, "std_kill_rooms", "Rules.py");
  const chests = assigned(rulesSource, "kill_chests", "Rules.py");
  /** @param {string} region @param {number} room @param {number[]} list @param {number} at */
  const ruleOf = (region, room, list, at) => {
    const { rule, sprites } = state.rules.challenge(room, list, region);
    state.kill.set(region, {
      req: print(rule),
      source: `Rules.py:${at}`,
      sprites: sprites.map((sprite) =>
        sprite.line === 0
          ? "Rules.py:944-949"
          : `source/dungeon/EnemyList.py:${sprite.line}`,
      ),
    });
    return rule;
  };
  const roomTable =
    /** @type {Record<string, [string[], string[], number, number[]]>} */ (
      rooms.value
    );
  const chestTable =
    /** @type {Record<string, [string[], number, number[]]>} */ (chests.value);
  /** @param {string} region */
  const killRoom = (region) => {
    const [entrances, trapAbles, room, list] =
      /** @type {[string[], string[], number, number[]]} */ (roomTable[region]);
    const rule = ruleOf(region, room, list, rooms.line);
    for (const name of entrances) {
      // not entrance.door or not entrance.door.entranceFlag
      const door = doorsByName.has(name)
        ? doorFlag(ctx, name, "entranceFlag")
        : FALSE;
      apply(
        "and",
        { kind: "entrance", name },
        any(rule, door),
        scope.when,
        line,
      );
    }
    for (const name of trapAbles) {
      // entrance.door.trapped and not entrance.door.entranceFlag
      apply(
        "and",
        { kind: "entrance", name },
        any(
          rule,
          negate(doorFlag(ctx, name, "trapped")),
          doorFlag(ctx, name, "entranceFlag"),
        ),
        scope.when,
        line,
      );
    }
  };
  /** @param {string} region */
  const killChest = (region) => {
    const [locations, room, list] =
      /** @type {[string[], number, number[]]} */ (chestTable[region]);
    const rule = ruleOf(region, room, list, chests.line);
    for (const name of locations)
      apply("and", { kind: "location", name }, rule, scope.when, line);
  };
  if (sewers === undefined) {
    for (const region of Object.keys(roomTable)) killRoom(region);
    for (const region of Object.keys(chestTable)) killChest(region);
    return;
  }
  for (const region of sewers.regions) {
    if (region in roomTable) killRoom(region);
    else
      for (const name of locationsOf.get(region) ?? []) {
        const chest = Object.entries(chestTable).find(([, [names]]) =>
          names.includes(name),
        );
        if (chest !== undefined) killChest(chest[0]);
        else
          apply(
            "and",
            { kind: "location", name },
            sewers.escape,
            scope.when,
            line,
          );
      }
  }
}

/**
 * drop_rules (Rules.py:997-1009): every sprite with a location, the key
 * drops' (adjust_locations, Regions.py:1170-1176) and the enemy drops'
 * (setup_enemy_locations), its defeat rule.
 * @param {import("./rules-core.mjs").Hook["apply"]} apply
 * @param {Scope} scope
 * @param {number} line
 */
function dropRules(apply, scope, line) {
  if (enemies === undefined) throw new Error("no enemy logic");
  for (const { index, name, region, room } of enemies.dropLocations) {
    const { rule, sprite } = enemies.rules.drop(room, index, region, name);
    enemies.drops.set(name, {
      req: print(rule),
      sprite: `source/dungeon/EnemyList.py:${sprite.line}`,
    });
    apply("and", { kind: "location", name }, rule, scope.when, line);
  }
}

/**
 * The blocks only DR writes: the escape's kill rooms (Rules.py:1546-1565).
 * @param {Omit<import("./rules-core.mjs").Hook, "name" | "call"> & { statement: import("./python.mjs").Statement }} block
 */
function block({ apply, ctx, line, scope, statement }) {
  if (statement.text !== "for region in escape_builder.master_sector.regions")
    return false;
  // The sewers' master sector: Hyrule Castle's regions with its doors
  // vanilla (Dungeons.py hyrule_castle_regions)
  const escapeRule = translate(
    ctx,
    pythonExpression("standard_escape_rule(state)"),
    scope,
  );
  challengeRooms(ctx, apply, scope, line, {
    escape: escapeRule,
    regions: hyruleCastleRegions,
  });
  return true;
}

/** Hyrule Castle's regions, Dungeons.py's list. @type {string[]} */
let hyruleCastleRegions = [];

/**
 * A spot expression: `world.get_entrance/get_location('X', player)`.
 * @param {Expr | undefined} expr
 * @param {Scope} scope
 * @returns {{ kind: "entrance" | "location", name: string }}
 */
function spotNamed(expr, scope) {
  if (
    expr?.t === "call" &&
    expr.fn.t === "attr" &&
    (expr.fn.name === "get_entrance" || expr.fn.name === "get_location")
  )
    return {
      kind: expr.fn.name === "get_entrance" ? "entrance" : "location",
      name: stringOf(expr.args[0], scope),
    };
  throw new Untranslatable("a spot other than an entrance or a location");
}

/** The source of Rules.py, for the hooks that read its tables. */
let rulesSource = "";
/** Each region's locations. @type {Map<string, string[]>} */
const locationsOf = new Map();

/**
 * add_conditional_lamps (Rules.py:1305-1376): each dark room's entrances
 * and locations need the lamp, but in Standard the sewers' (the light cone
 * of sewer_light_cone); under crossed or partitioned doors the sewers are
 * whichever rooms the sewers' builder took, which door shuffle decides
 * (step 6), so this reads the vanilla and basic path. The Old Man's house
 * always.
 * @param {import("./rules-core.mjs").Hook["apply"]} apply
 * @param {Scope} scope
 * @param {number} line
 */
function conditionalLamps(apply, scope, line) {
  const fn = body(rulesSource, "add_conditional_lamps", "Rules.py");
  const within = rulesSource.slice(fn.start, fn.end);
  const offset = rulesSource.slice(0, fn.start).split("\n").length - 1;
  const rooms = assigned(within, "dark_rooms", "Rules.py", "\\s+");
  const at = offset + rooms.line;
  const lamp = atom("lamp");
  for (const [region, info] of Object.entries(
    /** @type {Record<string, { sewer: boolean, entrances: string[] }>} */ (
      rooms.value
    ),
  )) {
    // Dark unless the sewers are lit (Standard) and the room is the sewers'
    const when = info.sewer
      ? all(scope.when, negate(setting("standardMode")))
      : scope.when;
    for (const name of info.entrances)
      apply("and", { kind: "entrance", name }, lamp, when, at);
    for (const name of locationsOf.get(region) ?? [])
      apply("and", { kind: "location", name }, lamp, when, at);
  }
  apply(
    "and",
    { kind: "entrance", name: "Old Man House Front to Back" },
    lamp,
    scope.when,
    line,
  );
}

/** @type {Dialect} */
const DR = {
  assign,
  block,
  code: CODE,
  dungeonCodes: DUNGEON_CODES,
  expression,
  items: ITEMS,
  list,
  methods: METHODS,
  numbers: WORLD_NUMBERS,
  prefix: "dr",
  regionId: drRegionId,
  statement,
  world: WORLD,
};

/**
 * DR's rules, translated.
 * @param {(file: string) => string} read - A file of the checkout
 * @param {{ regions: readonly { name: string, locations: readonly string[], exits: readonly string[] }[], dungeons: readonly { name: string, boss: string | null }[], doors: readonly (Record<string, unknown> & { name: string })[] }} world
 * @param {readonly { name: string, region: string, kind: string, pot?: { block: boolean }, flag: { memory: string, room?: number } }[]} extras
 *   The locations DR adds (src/door-rando/locations.json): pots, drops, shops
 *   Stage A's regions and dungeons
 */
export function importDrRules(read, world, extras) {
  rulesSource = read("Rules.py");
  const bossesSource = read("Bosses.py");
  const baseSource = read("BaseClasses.py");
  const dungeonsSource = read("Dungeons.py");
  const itemListSource = read("ItemList.py");
  const regionsSource = read("Regions.py");
  /** @type {Map<unknown, unknown> | Set<unknown>} */ for (const k of Object.keys(
    found,
  ))
    found[/** @type {keyof typeof found} */ (k)].clear();

  /** @type {Map<string, string>} */
  const regionOfLocation = new Map();
  /** @type {Map<string, string>} */
  const regionOfEntrance = new Map();
  locationsOf.clear();
  doorsByName.clear();
  for (const door of world.doors) doorsByName.set(door.name, door);
  typeOf.clear();
  blockPots.clear();
  for (const region of world.regions) {
    locationsOf.set(region.name, [...region.locations]);
    for (const location of region.locations) {
      regionOfLocation.set(location, region.name);
      typeOf.set(location, "Normal");
    }
    for (const exit of region.exits) regionOfEntrance.set(exit, region.name);
  }
  // DR's own locations (adjust_locations, Regions.py:1165-1215): a pot is
  // a Pot, an enemy's drop a Drop, a key drop either by key_drop_data
  const keyDrops = /** @type {Record<string, [string, unknown]>} */ (
    assigned(read("PotShuffle.py"), "key_drop_data", "PotShuffle.py").value
  );
  /** @type {{ name: string, region: string, room: number, index: number }[]} */
  const dropLocations = [];
  for (const [name, [type, at]] of Object.entries(keyDrops)) {
    typeOf.set(name, type);
    if (type === "Drop") {
      const [, room, index] = /** @type {number[]} */ (at);
      const region = regionOfLocation.get(name) ?? "";
      dropLocations.push({
        index: Number(index),
        name,
        region,
        room: Number(room),
      });
    }
  }
  for (const entry of extras) {
    if (
      typeOf.has(entry.name) &&
      entry.kind !== "pot" &&
      entry.kind !== "enemyDrop"
    )
      continue;
    if (!regionOfLocation.has(entry.name)) {
      regionOfLocation.set(entry.name, entry.region);
      locationsOf.set(entry.region, [
        ...(locationsOf.get(entry.region) ?? []),
        entry.name,
      ]);
    }
    if (entry.kind === "pot") {
      typeOf.set(entry.name, "Pot");
      if (entry.pot?.block) blockPots.add(entry.name);
    } else if (entry.kind === "enemyDrop") {
      typeOf.set(entry.name, "Drop");
      // '<region> Enemy #n': sprite n - 1 of its room (create_drop_location)
      const index = Number(entry.name.split("#")[1]) - 1;
      dropLocations.push({
        index,
        name: entry.name,
        region: entry.region,
        room: Number(entry.flag.room),
      });
    } else typeOf.set(entry.name, entry.kind === "shop" ? "Shop" : "Normal");
  }

  // Dungeons and their bosses (Dungeons.py create_dungeons, GT's three)
  /** @type {Map<string, string>} */
  const dungeonOfRegion = new Map();
  const create = body(dungeonsSource, "create_dungeons", "Dungeons.py");
  for (const m of dungeonsSource
    .slice(create.start, create.end)
    .matchAll(/make_dungeon\('([^']+)', \d+, [^,]+, (\w+),/g)) {
    const list = assigned(dungeonsSource, m[2] ?? "", "Dungeons.py").value;
    for (const region of /** @type {string[]} */ (list))
      dungeonOfRegion.set(region, m[1] ?? "");
  }
  const bossOfDungeon = new Map(
    world.dungeons.map((dungeon) => [dungeon.name, dungeon.boss]),
  );
  /** @type {Map<string, string>} */
  const towerBosses = new Map();
  for (const m of dungeonsSource.matchAll(
    /GT\.bosses\['(\w+)'\] = BossFactory\('([^']+)', player\)/g,
  ))
    towerBosses.set(m[1] ?? "", m[2] ?? "");

  // The shops' unlimited stock (Regions.py shop_table)
  shopsSelling.clear();
  // shop_table's entries hold enum members, so each is read by its shape:
  // (room, ShopType.X, keeper, custom, locked, inventory, sram)
  const shopTable = /^shop_table = \{([\s\S]*?)^\}/m.exec(regionsSource)?.[1];
  if (shopTable === undefined) throw new Error("Regions.py: no shop_table");
  for (const m of shopTable.matchAll(
    /'([^']+)': \(0x[0-9A-Fa-f]+, ShopType\.\w+, 0x[0-9A-Fa-f]+, \w+, \w+,\s*(\w+|\[[^\]]*\]), \d+\)/g,
  )) {
    const stock = m[2] ?? "";
    const list = stock.startsWith("[")
      ? pythonLiteral(stock)
      : assigned(regionsSource, stock, "Regions.py").value;
    for (const [item] of /** @type {[string, number][]} */ (list))
      shopsSelling.set(item, [...(shopsSelling.get(item) ?? []), m[1] ?? ""]);
  }
  if (shopsSelling.size === 0) throw new Error("Regions.py: no shop read");

  // The events: items generate_itempool places at locations it locks
  const pool = body(itemListSource, "generate_itempool", "ItemList.py");
  /** @type {Map<string, { item: string, location: string, line: number }>} */
  const placed = new Map();
  const within = itemListSource.slice(pool.start + 1, pool.end);
  const offset = itemListSource.slice(0, pool.start + 1).split("\n").length - 1;
  for (const m of within.matchAll(
    /world\.push_item\(world\.get_location\('([^']+)', player\), ItemFactory\('([^']+)', player\), False\)/g,
  )) {
    const item = m[2] ?? "";
    if (ITEMS[item] !== undefined || ["Triforce", "Nothing"].includes(item))
      continue;
    placed.set(item, {
      item,
      line: offset + within.slice(0, m.index).split("\n").length,
      location: m[1] ?? "",
    });
  }
  const events = new Map(
    [...placed.keys()].map((item) => [item, drRegionId(item)]),
  );

  /** @param {string} name */
  const methodLine = (name) => {
    const at = baseSource.indexOf(`    def ${name}(`);
    if (at < 0) throw new Error(`BaseClasses.py: no def ${name}`);
    return baseSource.slice(0, at).split("\n").length;
  };

  /**
   * The vanilla boss a region's dungeon fights (at `level` in Ganon's
   * Tower): boss shuffle is not read.
   * @param {string} region
   * @param {string} [level]
   */
  const bossOfRegion = (region, level) => {
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
  };

  /** @type {DrContext} */
  const ctx = {
    bossHelper: (region, level) =>
      `drDefeat${pascal(bossOfRegion(region, level))}`,
    bossOfRegion,
    derived: new Map(),
    dialect: DR,
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
    potionShop: any(
      buyableAtom(drRegionId, shopsSelling.get("Green Potion") ?? []),
      buyableAtom(drRegionId, shopsSelling.get("Blue Potion") ?? []),
      all(
        setting("invertedMode"),
        atom(`reach(${drRegionId("Dark Lake Hylia Shop")})`),
      ),
    ),
    potionShops: [],
    reachedEntrances: new Set(),
    reachedLocations: new Set(),
    regionOfEntrance,
    regionOfLocation,
  };

  // Every boss's rule, a helper of its own; the Ice variants, which boss
  // shuffle puts at GT's bottom (Bosses.py:322), beside them
  const table =
    /** @type {Record<string, [string, { name: string }, { name: string }]>} */ (
      assigned(bossesSource, "boss_table", "Bosses.py").value
    );
  for (const [boss, [, normal, ice]] of Object.entries(table)) {
    for (const [name, rule] of /** @type {const} */ ([
      [`drDefeat${pascal(boss)}`, normal],
      [`drDefeatIce${pascal(boss)}`, ice],
    ])) {
      if (name.startsWith("drDefeatIce") && ice.name === normal.name) continue;
      const { line, rule: req } = bossFunction(ctx, bossesSource, rule.name);
      ctx.helpers.set(name, { req: print(req), source: `Bosses.py:${line}` });
    }
  }

  // The enemy logic, through DR's methods
  hyruleCastleRegions = /** @type {string[]} */ (
    assigned(dungeonsSource, "hyrule_castle_regions", "Dungeons.py").value
  );
  enemies = {
    dropLocations,
    drops: new Map(),
    keyDrops: new Map(),
    kill: new Map(),
    rules: enemyRules(readEnemyData(read), enemyLib(ctx), (region) => ({
      dark: derive(ctx, `darkWorld_${drRegionId(region)}`, {
        kind: "darkWorld",
        region,
        source: "Regions.py:1113",
      }),
      light: derive(ctx, `lightWorld_${drRegionId(region)}`, {
        kind: "lightWorld",
        region,
        source: "Regions.py:1113",
      }),
    })),
  };

  const { bombShop, fill, spots, unported } = walkRules(rulesSource, ctx);

  // A spot reached (can_reach(…, 'Location' or 'Entrance')): its region,
  // and its rule
  for (const [kind, names, prefix] of /** @type {const} */ ([
    ["location", ctx.reachedLocations, "drAt"],
    ["entrance", ctx.reachedEntrances, "drThrough"],
  ])) {
    for (const name of names) {
      const spot = spots.get(`${kind}:${name}`);
      const region = regionOf(ctx, { kind, name });
      ctx.helpers.set(`${prefix}${pascal(name)}`, {
        req: print(
          all(atom(`reach(${drRegionId(region)})`), spot?.rule ?? TRUE),
        ),
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

  const sortedOf = (/** @type {Map<string, unknown>} */ map) =>
    Object.fromEntries(
      [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  // The bunny's lists (set_bunny_rules, Rules.py:2039), which the world
  // ports: two local to the function, two of the module
  const bunny = body(rulesSource, "set_bunny_rules", "Rules.py");
  const bunnySource = rulesSource.slice(bunny.start + 1, bunny.end);
  const bunnyLine = rulesSource.slice(0, bunny.start + 1).split("\n").length;
  /** @param {string} name @param {boolean} local */
  const bunnyList = (name, local) => {
    if (!local) return assigned(rulesSource, name, "Rules.py");
    const { line, value } = assigned(bunnySource, name, "Rules.py", "\\s+");
    return { line: bunnyLine + line - 1, value };
  };

  return {
    bombShop,
    bunny: {
      accessibleLocations: bunnyList("bunny_accessible_locations", true),
      impassableCaves: bunnyList("bunny_impassable_caves", true),
      impassableDoors: bunnyList("bunny_impassible_doors", false),
      impassableIfTrapped: bunnyList("bunny_impassible_if_trapped", false),
    },
    crystal: [...found.crystal.values()].sort((a, b) =>
      `${a.region}:${a.color}` < `${b.region}:${b.color}` ? -1 : 1,
    ),
    derived: sortedOf(ctx.derived),
    doorData: sortedOf(found.doorData),
    doorsOpen: [...found.doorsOpen].sort(),
    drops: sortedOf(enemies.drops),
    entrances: rulesOf("entrance"),
    events: Object.fromEntries(
      [...placed.values()]
        .filter(({ item }) => ctx.heldEvents.has(item))
        .map(({ item, line, location }) => [
          drRegionId(item),
          { item, location, source: `ItemList.py:${line}` },
        ]),
    ),
    // The lines alone: no key model reads DR's yet
    fill: [
      ...new Set(
        [...fill.forbid, ...fill.always, ...fill.itemRules].map(({ source }) =>
          Number(source.slice("Rules.py:".length)),
        ),
      ),
    ].sort((a, b) => a - b),
    helpers: sortedOf(ctx.helpers),
    kill: sortedOf(enemies.kill),
    locations: rulesOf("location"),
    negatedEvents: [...found.negatedEvents].sort(),
    newItems: NEW_ITEMS,
    ties: enemies.rules.ties.map((names) => names.join(" ")),
    uncalledMethods: [...found.uncalled].sort(),
    unported,
  };
}

/**
 * Reaching any of `regions`.
 * @param {(name: string) => string} id
 * @param {readonly string[]} regions
 */
const buyableAtom = (id, regions) =>
  any(...regions.map((region) => atom(`reach(${id(region)})`)));

/**
 * @typedef {{ keys: number, bigKeyIn?: string[], withBigKey?: number, smallKeyIn?: string, withSmallKey?: number }} StaticDoor
 */

/**
 * The static key logic's tables (`key_logic_algorithm` static, 1.5.7 on:
 * source/dungeon/StaticKeyLogic.py): each dungeon's key doors and the keys
 * each asks, counted as the entrance randomizer counts them, chests alone
 * (DOOR_RULES), each spec as static_door_rules reads it (a number is its
 * `keys`, a lone `big_key_in` a list of one), and the chests its location
 * rules name (GT_RANDOMIZER, GT_COMPASS, TR_EYE_BRIDGE). The rules
 * themselves are code, ported in src/door-world/static.ts.
 * @param {(file: string) => string} read
 */
export function importStaticKeyLogic(read) {
  const file = "source/dungeon/StaticKeyLogic.py";
  const source = read(file);
  /** @param {string} name */
  const names = (name) => {
    const { value } = assigned(source, name, file);
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
      throw new Error(`${file}: ${name} is no list of names`);
    return /** @type {string[]} */ (value);
  };
  /** @param {unknown} value @param {string} what */
  const count = (value, what) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      throw new Error(`${file}: ${what} is no number of keys`);
    return value;
  };
  /**
   * @param {string} door
   * @param {unknown} value
   * @returns {StaticDoor}
   */
  const spec = (door, value) => {
    if (typeof value === "number") return { keys: count(value, door) };
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${file}: ${door} is no spec`);
    const {
      big_key_in: bigKeyIn,
      keys,
      small_key_in: smallKeyIn,
      with_big_key: withBigKey,
      with_small_key: withSmallKey,
      ...rest
    } = /** @type {Record<string, unknown>} */ (value);
    if (Object.keys(rest).length > 0)
      throw new Error(`${file}: ${door} asks ${Object.keys(rest).join(", ")}`);
    /** @type {StaticDoor} */
    const out = { keys: count(keys, door) };
    if (bigKeyIn !== undefined) {
      const list = typeof bigKeyIn === "string" ? [bigKeyIn] : bigKeyIn;
      if (!Array.isArray(list) || !list.every((l) => typeof l === "string"))
        throw new Error(`${file}: ${door}'s big_key_in`);
      out.bigKeyIn = /** @type {string[]} */ (list);
      out.withBigKey = count(withBigKey, `${door}'s with_big_key`);
    }
    if (smallKeyIn !== undefined) {
      if (typeof smallKeyIn !== "string")
        throw new Error(`${file}: ${door}'s small_key_in`);
      out.smallKeyIn = smallKeyIn;
      out.withSmallKey = count(withSmallKey, `${door}'s with_small_key`);
    }
    return out;
  };
  const table = assigned(source, "DOOR_RULES", file);
  /** @type {Record<string, Record<string, StaticDoor>>} */
  const doors = {};
  for (const [dungeon, list] of Object.entries(
    /** @type {Record<string, Record<string, unknown>>} */ (table.value),
  ))
    doors[dungeon] = Object.fromEntries(
      Object.entries(list).map(([door, value]) => [door, spec(door, value)]),
    );
  return {
    doors,
    gtCompass: names("GT_COMPASS"),
    gtRandomizer: names("GT_RANDOMIZER"),
    source: `${file}:${table.line}`,
    trEyeBridge: names("TR_EYE_BRIDGE"),
  };
}

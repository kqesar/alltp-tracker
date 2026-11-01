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
// set_always_allow) has no part in what Link can reach: it is `fill`, data
// for the key model (src/er-keys.ts), beside the dungeons' keys
// (Dungeons.py) and the spots filled before them (`dungeons`).
//
// The translation itself is rules-core.mjs's, which the Door Randomizer's
// port shares (dr-rules.mjs); this is its dialect for the entrance
// randomizer (the world vt hands it, its items and methods) and the import
// of its Rules.py, Bosses.py, Dungeons.py and ItemList.py.

import {
  assigned,
  body,
  callExpressions,
  expression,
  functionBody,
  tokens,
} from "./python.mjs";
import {
  all,
  any,
  atLeast,
  atom,
  bossFunction,
  canBuyUnlimited,
  derive,
  FALSE,
  itemNamed,
  key,
  method,
  negate,
  numberOf,
  pascal,
  print,
  regionId,
  regionOf,
  SHOP_RECORDS,
  setting,
  TRUE,
  Untranslatable,
  walkRules,
} from "./rules-core.mjs";

export { print, regionId };

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {import("./python.mjs").Statement} Statement
 * @typedef {import("./rules-core.mjs").Rule} Rule
 * @typedef {import("./rules-core.mjs").Context} Context
 * @typedef {import("./rules-core.mjs").Dialect} Dialect
 * @typedef {import("./rules-core.mjs").RetroShops} RetroShops
 */

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
 * The world's settings a rule reads, on vt's path: an attribute's value by
 * what it is compared with, or a flag. `false` is a value vt never gives
 * this world (logic other than No Glitches, Inverted, the retro world, the
 * triforce goals the pack does not model); the dungeon items are
 * keysanity only when vt passes --keysanity, for its `full` dungeon items
 * (vt app/EntranceRandomizer.php:69-71), which alone make big keys wild.
 * @type {Readonly<Record<string, Readonly<Record<string, Rule>> | Rule>>}
 */
export const WORLD = {
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
 * The state's methods the rules call (BaseClasses.py, CollectionState), as
 * helpers named after them: `has_Boots` is `@erHasBoots`. An argument other
 * than the default goes into the name: `can_kill_most_things(player, 8)` is
 * `@erCanKillMostThings8`.
 * @type {Readonly<Record<string, (ctx: Context, args: Expr[]) => Rule>>}
 */
export const METHODS = {
  can_avoid_lasers: (ctx) =>
    method(ctx, "can_avoid_lasers", "", () =>
      any(atom("shield >= 3"), atom("caneOfByrna"), atom("cape")),
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
    const count = Number(numberOf(ctx, enemies, 5));
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
  // The retro world's arrows are bought (BaseClasses.py:379-381): its
  // world.retro is vt's Retro world, whose rupee bow is `rupeeBow`
  can_shoot_arrows: (ctx) =>
    method(ctx, "can_shoot_arrows", "", () =>
      all(
        atom("bow"),
        any(negate(setting("rupeeBow")), canBuyUnlimited(ctx, "Single Arrow")),
      ),
    ),
  has_Boots: (ctx) => method(ctx, "has_Boots", "", () => atom("pegasusBoots")),
  has_beam_sword: (ctx) =>
    method(ctx, "has_beam_sword", "", () => atom("sword >= 2")),
  has_blunt_weapon: (ctx) =>
    method(ctx, "has_blunt_weapon", "", () =>
      any(METHODS.has_sword?.(ctx, []) ?? FALSE, atom("hammer")),
    ),
  has_bottle: (ctx) => method(ctx, "has_bottle", "", () => atom("bottle")),
  has_crystals: (ctx, [count]) => {
    const n = numberOf(ctx, count, 7);
    return atom(
      `count(crystal) >= ${typeof n === "number" ? n : `setting(${n})`}`,
    );
  },
  has_fire_source: (ctx) =>
    method(ctx, "has_fire_source", "", () =>
      any(atom("fireRod"), atom("lamp")),
    ),
  // heart_count: the 3 hearts Link starts with, the containers and a heart
  // per 4 pieces (BaseClasses.py:411-419). The state holds the 3 as heart
  // containers, as vt pre-collects them (the pack's PRE_COLLECTED_STATE),
  // so the containers count them. Each found item is capped by the item
  // pool's difficulty, at 2 containers and 8 pieces at the lowest
  // (ItemList.py difficulties): no cap binds while 2 hearts or fewer are
  // found. Hearts are no advancement items, so a seed's fill never counts
  // them, but the randomizer's tests collect them as such
  // (TestMiseryMire.py:72): the rule stands as it is written
  has_hearts: (ctx, [, count]) => {
    const wanted = Number(numberOf(ctx, count, 0));
    const found = wanted - 3;
    if (found > 2) throw new Untranslatable(`${found} hearts, past a cap`);
    return method(ctx, "has_hearts", `${wanted}`, () =>
      any(
        ...Array.from({ length: found + 1 }, (_, pieces) =>
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
 * can_extend_magic: Link's whole magic is at least `small` (BaseClasses.py
 * 423-436). 8, 16 with half magic, 32 with quarter magic; with a potion
 * shop in reach (`ctx.potionShop`, else one of `ctx.potionShops`), each bottle refills it all, or a half with hard item
 * functionality and a quarter with expert, unless `refill` asks for full
 * bottles (the halves round down). The pack's bottle magic flags are those
 * functionalities (settings.ts).
 * @param {Context} ctx
 * @param {number} small
 * @param {boolean} refill
 */
export function extendMagic(ctx, small, refill) {
  const shop =
    ctx.potionShop ??
    any(...ctx.potionShops.map((r) => atom(`reach(${regionId(r)})`)));
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

/** Rule functions that are code rather than rules, by what they do. */
const CODE = {
  set_bunny_rules:
    "the bunny's paths, by which regions the entrances make dark",
};

/** @type {Dialect} */
const ER = {
  code: CODE,
  dungeonCodes: DUNGEON_CODES,
  items: ITEMS,
  methods: METHODS,
  numbers: WORLD_NUMBERS,
  prefix: "er",
  world: WORLD,
};

/**
 * A dungeon as the key model reads it (Dungeons.py make_dungeon): its
 * regions, the code of its keys, how many small keys it holds, whether it
 * has a big key, and its maps and compasses, which no rule reads.
 * @typedef {{ code: string, regions: string[], smallKeys: number, bigKey: boolean, items: string[], source: string }} ErDungeon
 */

/**
 * The item names an `ItemFactory(…)` argument makes: a name, a list of
 * names, a list times a count.
 * @param {Expr | undefined} expr
 * @returns {string[]}
 */
function namesOf(expr) {
  if (expr?.t === "const" && typeof expr.value === "string")
    return [expr.value];
  if (expr?.t === "seq") return expr.items.flatMap(namesOf);
  if (
    expr?.t === "op" &&
    expr.op === "*" &&
    expr.right.t === "const" &&
    typeof expr.right.value === "number"
  )
    return Array.from({ length: expr.right.value }, () =>
      namesOf(expr.left),
    ).flat();
  throw new Error("Dungeons.py: an item list of no literals");
}

/**
 * The items a make_dungeon argument makes: None, `ItemFactory(…)`, or a list
 * of such calls.
 * @param {Expr | undefined} expr
 * @returns {string[]}
 */
function factoryItems(expr) {
  if (expr === undefined || (expr.t === "const" && expr.value === null))
    return [];
  if (expr.t === "seq") return expr.items.flatMap(factoryItems);
  if (
    expr.t === "call" &&
    expr.fn.t === "name" &&
    expr.fn.name === "ItemFactory"
  )
    return namesOf(expr.args[0]);
  throw new Error("Dungeons.py: dungeon items other than ItemFactory");
}

/**
 * A dungeon of make_dungeon(name, boss, regions, big_key, small_keys,
 * dungeon_items).
 * @param {Extract<Expr, { t: "seq" }>} members
 * @param {Expr | undefined} bigKey
 * @param {Expr | undefined} smallKeys
 * @param {Expr | undefined} items
 * @param {string} source
 * @returns {ErDungeon}
 */
function dungeonOf(members, bigKey, smallKeys, items, source) {
  const big = factoryItems(bigKey);
  const small = factoryItems(smallKeys);
  const ids = [...big, ...small].map(
    (name) => itemNamed(DUNGEON_CODES, name).id,
  );
  const codes = new Set(ids.map((id) => id?.replace(/^(big)?[kK]ey/, "")));
  if (ids.includes(undefined) || codes.size > 1)
    throw new Error(`${source}: keys of no one dungeon`);
  return {
    bigKey: big.length > 0,
    code: [...codes][0] ?? "",
    items: factoryItems(items),
    regions: members.items.map((m) => String(m.t === "const" ? m.value : "")),
    smallKeys: small.length,
    source,
  };
}

/**
 * The bosses can_place_boss (Bosses.py) refuses at a slot, by running its
 * statements on their expression trees for each boss: with the swords of
 * any world (`refuses`), and the more it refuses swordless (`swordless`).
 * Anything but names, the world's swords, literals, comparisons, `if` and
 * `return` stops the import.
 * @param {string} source - Bosses.py
 * @param {readonly string[]} bosses - boss_table's
 * @param {string} dungeon
 * @param {string | null} level
 */
function refusals(source, bosses, dungeon, level) {
  const fn = functionBody(source, "can_place_boss", "Bosses.py");
  const [world, boss, dungeonName, levelName] = fn.params;
  /**
   * @param {Expr} expr
   * @param {ReadonlyMap<string, unknown>} env
   * @returns {unknown}
   */
  const value = (expr, env) => {
    switch (expr.t) {
      case "const":
        return expr.value;
      case "name":
        if (env.has(expr.name)) return env.get(expr.name);
        break;
      case "attr":
        if (
          expr.of.t === "name" &&
          expr.of.name === world &&
          expr.name === "swords"
        )
          return env.get("swords");
        break;
      case "seq":
        return expr.items.map((item) => value(item, env));
      case "not":
        return !value(expr.of, env);
      case "and":
        return expr.args.every((arg) => value(arg, env));
      case "or":
        return expr.args.some((arg) => value(arg, env));
      case "compare": {
        const left = value(expr.left, env);
        const right = value(expr.right, env);
        if (expr.op === "==") return left === right;
        if (expr.op === "!=") return left !== right;
        if (Array.isArray(right) && expr.op === "in")
          return right.includes(left);
        if (Array.isArray(right) && expr.op === "not in")
          return !right.includes(left);
        break;
      }
    }
    throw new Error(`Bosses.py:${fn.line}: can_place_boss reads more`);
  };
  /**
   * @param {readonly Statement[]} statements
   * @param {ReadonlyMap<string, unknown>} env
   * @returns {boolean | undefined} What it returns, if it does
   */
  const run = (statements, env) => {
    for (const statement of statements) {
      const { line, text } = statement;
      const stream = tokens(text, 0, "Bosses.py", line);
      if (text.startsWith("return ")) {
        stream.next();
        const returned = value(expression(stream), env);
        if (typeof returned !== "boolean")
          throw new Error(`Bosses.py:${line}: a return of no boolean`);
        return returned;
      }
      if (!text.startsWith("if ") || !statement.block)
        throw new Error(`Bosses.py:${line}: can_place_boss does more`);
      stream.next();
      if (!value(expression(stream), env)) continue;
      const returned = run(statement.body, env);
      if (returned !== undefined) return returned;
    }
    return undefined;
  };
  /** @param {string} swords */
  const refused = (swords) =>
    bosses.filter(
      (name) =>
        !run(
          fn.body,
          new Map([
            ["swords", swords],
            [boss ?? "", name],
            [dungeonName ?? "", dungeon],
            [levelName ?? "", level],
          ]),
        ),
    );
  const refuses = refused("randomized");
  return {
    refuses,
    swordless: refused("swordless").filter((name) => !refuses.includes(name)),
  };
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
  /** @type {Map<string, ErDungeon>} */
  const dungeonItems = new Map();
  for (const { call, line } of callExpressions(
    dungeonsSource,
    "make_dungeon",
    "Dungeons.py",
    create.start,
    create.end,
  )) {
    const [name, boss, members, bigKey, smallKeys, items] = call.args;
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
    dungeonItems.set(
      name.value,
      dungeonOf(members, bigKey, smallKeys, items, `Dungeons.py:${line}`),
    );
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
  /** @param {unknown} stock - A shop's, or the name of a list of it */
  const itemsSold = (stock) =>
    /** @type {[string, number][]} */ (
      stock !== null && typeof stock === "object" && "name" in stock
        ? assigned(regionsSource, String(stock.name), "Regions.py").value
        : stock
    ).map(([item]) => item);
  const potionShops = Object.entries(contents)
    .filter(([, stock]) =>
      itemsSold(stock).some((item) =>
        ["Green Potion", "Blue Potion"].includes(item),
      ),
    )
    .map(([region]) => region);

  // The retro world's shops (set_up_shops): one shop's stock it extends
  // with an item, and those it draws among the replaceable shops of
  // shop_table, each selling the same items. Read as written, or not at all
  const shops = body(itemListSource, "set_up_shops", "ItemList.py");
  const shopsText = itemListSource.slice(shops.start, shops.end);
  const extended =
    /(\w+) = world\.get_region\('([^']+)', player\)\.shop\n\s+\1\.active = True\n\s+\1\.add_inventory\(\d, '([^']+)', \d+\)/.exec(
      shopsText,
    );
  const drawnShops =
    /for shop in random\.sample\(\[s for s in world\.shops if s\.replaceable and s\.type == ShopType\.Shop and s\.region\.player == player\], (\d+)\):((?:\n {12}shop\..*)+)/.exec(
      shopsText,
    );
  if (extended === null || drawnShops === null)
    throw new Error("ItemList.py: set_up_shops reads otherwise");
  const shopTable = /** @type {Record<string, unknown>} */ (
    assigned(regionsSource, "shop_table", "Regions.py").value
  );
  const drawnItems = [
    ...(drawnShops[2] ?? "").matchAll(
      /shop\.add_inventory\(\d, '([^']+)', \d+\)/g,
    ),
  ].map((m) => m[1] ?? "");
  // No shop sells an arrow or a key by default: only what it adds
  const retroItems = [...drawnItems, extended[3] ?? ""].filter(
    (item) => item in SHOP_RECORDS,
  );
  if (
    Object.values(contents).some((stock) =>
      itemsSold(stock).some((item) => retroItems.includes(item)),
    )
  )
    throw new Error("Regions.py: a shop sells a retro item by default");
  /** @type {RetroShops} */
  const retroShops = {
    drawn: {
      count: Number(drawnShops[1]),
      items: drawnItems,
      regions: Object.entries(shopTable)
        .filter(([, row]) => Array.isArray(row) && row[2] === true)
        .map(([region]) => region),
    },
    fixed: new Map([[extended[3] ?? "", [extended[2] ?? ""]]]),
  };

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

  // Where the dungeons' items go (the key model, src/er-keys.ts): the spots
  // filled before them, which take none of them (generate_itempool's locked
  // items, the prizes fill_prizes draws among), and the key placed first
  // (fill_dungeons_restrictive's Pinball Room)
  /** @param {string} text @param {number} index @param {number} first */
  const lineAt = (text, index, first) =>
    first + text.slice(0, index).split("\n").length - 1;
  const prefilled = [
    ...within.matchAll(
      /world\.push_item\(world\.get_location\('((?:[^'\\]|\\.)+)', player\)/g,
    ),
  ].map((m) => ({
    location: (m[1] ?? "").replaceAll("\\'", "'"),
    source: `ItemList.py:${lineAt(within, m.index, offset + 1)}`,
  }));
  const prizes = body(itemListSource, "fill_prizes", "ItemList.py");
  const prizesText = itemListSource.slice(prizes.start, prizes.end);
  const prizesLine = lineAt(itemListSource, prizes.start, 1);
  const crystals = /crystal_locations = \[([^\]]+)\]/.exec(prizesText);
  if (crystals === null)
    throw new Error("ItemList.py: fill_prizes reads otherwise");
  const listed = crystals.index + "crystal_locations = [".length;
  for (const m of (crystals[1] ?? "").matchAll(
    /world\.get_location\('((?:[^'\\]|\\.)+)', player\)/g,
  ))
    prefilled.push({
      location: (m[1] ?? "").replaceAll("\\'", "'"),
      source: `ItemList.py:${lineAt(prizesText, listed + m.index, prizesLine)}`,
    });
  const restrictive = body(
    dungeonsSource,
    "fill_dungeons_restrictive",
    "Dungeons.py",
  );
  const restrictiveText = dungeonsSource.slice(
    restrictive.start,
    restrictive.end,
  );
  const pinball =
    /(\w+) = world\.get_location\('([^']+)', player\)\n\s+if world\.retro:\n\s+world\.push_item\(\1, ItemFactory\('Small Key \(Universal\)', player\), False\)\n\s+else:\n\s+(world\.push_item\(\1, ItemFactory\('([^']+)', player\), False\))/.exec(
      restrictiveText,
    );
  if (pinball === null)
    throw new Error("Dungeons.py: fill_dungeons_restrictive reads otherwise");
  const restrictiveLine = lineAt(dungeonsSource, restrictive.start, 1);
  const preplaced = [
    {
      ...itemNamed(DUNGEON_CODES, pinball[4] ?? ""),
      location: pinball[2] ?? "",
      source: `Dungeons.py:${lineAt(restrictiveText, pinball.index + pinball[0].indexOf(pinball[3] ?? ""), restrictiveLine)}`,
    },
  ];
  // The retro world's dungeons hold no small key: its keys are universal
  const retroKeys = "[] if world.retro else small_keys";
  if (!dungeonsSource.includes(retroKeys))
    throw new Error(`Dungeons.py no longer says ${retroKeys}`);
  const retroSmallKeys = `Dungeons.py:${lineAt(dungeonsSource, dungeonsSource.indexOf(retroKeys), 1)}`;

  /** @param {string} name */
  const methodLine = (name) => {
    const at = baseSource.indexOf(`    def ${name}(`);
    if (at < 0) throw new Error(`BaseClasses.py: no def ${name}`);
    return baseSource.slice(0, at).split("\n").length;
  };

  // The slots boss shuffle fills (Bosses.py place_bosses), the Open and
  // Standard worlds' list: a rule reads its dungeon's boss through the
  // slot's helper, which the world defines (er-world.ts), its vanilla boss
  // without boss shuffle. Agahnim and Agahnim 2 never move.
  const slotList = assigned(
    bossesSource,
    "boss_locations",
    "Bosses.py",
    " {8}",
  );
  const slotLines = bossesSource.split("\n");
  const bossNames = Object.keys(
    /** @type {Record<string, unknown>} */ (
      assigned(bossesSource, "boss_table", "Bosses.py").value
    ),
  );
  /**
   * @type {Map<string, { boss: string, place: string, refuses: string[],
   *   swordless: string[], source: string, vanilla: string }>}
   */
  const bossSlots = new Map();
  for (const [i, entry] of /** @type {unknown[]} */ (
    slotList.value
  ).entries()) {
    const [dungeon, level] = Array.isArray(entry) ? entry : [];
    if (
      typeof dungeon !== "string" ||
      (level !== null && typeof level !== "string") ||
      dungeon.startsWith("Inverted ")
    )
      throw new Error(`Bosses.py: a boss_locations entry of no dungeon`);
    const boss =
      level === null ? bossOfDungeon.get(dungeon) : towerBosses.get(level);
    if (typeof boss !== "string")
      throw new Error(`Bosses.py: no boss in ${dungeon} ${level ?? ""}`);
    const line = slotList.line + 1 + i;
    if (!slotLines[line - 1]?.includes(`'${dungeon}'`))
      throw new Error(`Bosses.py: boss_locations is not one entry a line`);
    bossSlots.set(`${dungeon}/${level ?? ""}`, {
      boss,
      place: regionId(`${dungeon} ${level ?? ""}`),
      ...refusals(bossesSource, bossNames, dungeon, level),
      source: `Bosses.py:${line}`,
      vanilla: `erDefeat${pascal(boss)}`,
    });
  }
  /** @type {Set<string>} */
  const slotsRead = new Set();

  /** @type {Context} */
  const ctx = {
    bossHelper: (region, level) => {
      const dungeon = dungeonOfRegion.get(region);
      const boss =
        dungeon === undefined
          ? undefined
          : level === undefined
            ? bossOfDungeon.get(dungeon)
            : towerBosses.get(level);
      if (dungeon === undefined || boss === undefined || boss === null)
        throw new Untranslatable(`no boss in ${region}`);
      const slot = `${dungeon}/${level ?? ""}`;
      if (!bossSlots.has(slot)) return `erDefeat${pascal(boss)}`;
      slotsRead.add(slot);
      return `erDefeat${pascal(dungeon)}${pascal(level ?? "")}Boss`;
    },
    derived: new Map(),
    dialect: ER,
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
    retroShops,
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
    bossSlots: Object.fromEntries(
      [...bossSlots.entries()]
        .filter(([slot]) => slotsRead.has(slot))
        .map(([slot, rule]) => {
          const [dungeon = "", level = ""] = slot.split("/");
          return [`erDefeat${pascal(dungeon)}${pascal(level)}Boss`, rule];
        })
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ),
    bunny: {
      accessibleLocations: bunnyList("bunny_accessible_locations"),
      impassableCaves: bunnyList("bunny_impassable_caves"),
    },
    derived: Object.fromEntries(
      [...ctx.derived.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    dungeons: {
      byName: Object.fromEntries(dungeonItems),
      prefilled,
      preplaced,
      retroSmallKeys,
    },
    entrances: final,
    events: Object.fromEntries(
      [...placed.values()]
        .filter(({ item }) => ctx.heldEvents.has(item))
        .map(({ item, line, location }) => [
          regionId(item),
          { item, location, source: `ItemList.py:${line}` },
        ]),
    ),
    fill,
    helpers: Object.fromEntries(
      [...ctx.helpers.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    locations: rulesOf("location"),
    unported,
  };
}

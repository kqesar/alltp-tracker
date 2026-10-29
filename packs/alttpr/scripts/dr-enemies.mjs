/// <reference types="node" />
// DR's enemy logic, ported (import-dr.mjs, with dr-rules.mjs): the rules
// of its kill rooms, of its enemy drops and of the vulnerability they read,
// from source/enemizer/EnemyLogic.py over the data it reads: the vanilla
// sprites and the stats of each kind (source/dungeon/EnemyList.py), and the
// damage table (source/enemizer/damage_table.yaml, read with js-yaml). DR's
// Rules.py builds these rules in code (challenge_room_rules :906,
// get_challenge_rule :927, drop_rules :994), so they are computed here, as
// the code computes them, and handed to the walk as rules.
//
// EnemyLogic's rules are RuleFactory's (source/logic/Rule.py:91-147): a
// static true or false, folded the way conj and disj fold them, which this
// keeps (a disjunction of nothing but static falses is true, as written).
// Where defeat_rule_multiple breaks a tie between equally good clears with
// random.choice (EnemyLogic.py:133), every choice is followed and their
// rules anded: never more yes than any choice DR may have made. Each tie is
// reported. An enemy whose health depends on the world it is in (a tuple,
// EnemyList.py:285) in a region whose side the data does not say (a cave)
// gets the rule of both sides, anded, for the same reason.

import { load } from "js-yaml";
import { assigned, body, callExpressions } from "./python.mjs";
import { all, any, FALSE, negate, TRUE } from "./rules-core.mjs";

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {import("./rules-core.mjs").Rule} Rule
 * @typedef {{ kind: number, overlord: boolean, region: string | null, keyDrop: boolean, fix: boolean, embed: boolean, neverDrop: boolean, line: number, tileX: number }} Sprite
 * @typedef {{ health: number | number[] | null, ignore: boolean, line: number }} Stats
 * @typedef {{ light: boolean, dark: boolean }} Where
 *   Which sides of the world a sprite's region lies in (is_light_world,
 *   is_dark_world): its health, when a tuple, by them
 * @typedef {{ static: boolean } | { rule: Rule }} Factory
 *   A RuleFactory rule: a static one, or any other
 * @typedef {{
 *   has: (item: string, count?: number) => Rule,
 *   extendMagic: (magic: number, full: boolean) => Rule,
 *   canUseBombs: () => Rule,
 *   normalArrows: () => Rule,
 *   silverArrows: () => Rule,
 * }} Lib
 *   What the rules read of the state, through DR's translation
 */

const ENEMIES = "source/dungeon/EnemyList.py";
/** A region whose side no rule reads. @type {Where} */
const NOWHERE = { dark: false, light: false };
const LOGIC = "source/enemizer/EnemyLogic.py";

/**
 * Stops the import.
 * @param {string} what
 * @returns {never}
 */
function fail(what) {
  throw new Error(what);
}

/** `Enum.Member` as the member's name. @param {Expr | undefined} e @param {string} of */
export const member = (e, of) =>
  e?.t === "attr" && e.of.t === "name" && e.of.name === of
    ? e.name
    : fail(`expected ${of}.<member>, read ${JSON.stringify(e)}`);

/** A constant's value. @param {Expr | undefined} e */
export const constant = (e) =>
  e?.t === "const"
    ? e.value
    : fail(`expected a constant: ${JSON.stringify(e)}`);

/**
 * `class Name(FastEnum):` members, `Member = value`, by name.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 */
export function enumOf(source, name, file) {
  const start = source.indexOf(`\nclass ${name}(`);
  if (start === -1) fail(`${file}: no class ${name}`);
  const end = /\n\S/g;
  end.lastIndex = start + 1;
  const stop = end.exec(source)?.index ?? source.length;
  /** @type {Map<string, number>} */
  const members = new Map();
  for (const m of source
    .slice(start, stop)
    .matchAll(/^ {4}(\w+) = (0x[0-9a-fA-F]+|\d+)/gm)) {
    members.set(m[1], Number(m[2]));
  }
  return members;
}

/**
 * DR's vanilla sprites and the stats of each kind (source/dungeon/EnemyList.py):
 * init_vanilla_sprites' create_sprite calls, room by room in order
 * (EnemyList.py:579-592 for the arguments), and init_enemy_stats' entries.
 * @param {string} enemies - EnemyList.py
 */
export function readSprites(enemies) {
  const kindsOf = enumOf(enemies, "EnemySprite", ENEMIES);
  const nameOfKind = assigned(enemies, "enemy_names", ENEMIES).value;
  const spritesFn = body(enemies, "init_vanilla_sprites", ENEMIES);
  const PARAMS = [
    "super_tile",
    "kind",
    "sub_type",
    "layer",
    "tile_x",
    "tile_y",
    "region",
    "drops_item",
    "drop_item_kind",
    "fix",
    "water",
    "embed",
    "never_drop",
  ];
  /** @type {Map<number, Sprite[]>} */
  const spritesByRoom = new Map();
  for (const { call, line } of callExpressions(
    enemies,
    "create_sprite",
    ENEMIES,
    spritesFn.start,
    spritesFn.end,
  )) {
    /** @type {Record<string, Expr>} */
    const arg = {};
    call.args.forEach((a, i) => {
      arg[PARAMS[i]] = a;
    });
    Object.assign(arg, call.keywords);
    const room = Number(constant(arg.super_tile));
    // SpriteType.Overlord is 0x07 (EnemyList.py:280-282)
    const sub = arg.sub_type;
    const overlord =
      sub.t === "attr"
        ? member(sub, "SpriteType") === "Overlord"
        : constant(sub) === 0x07;
    const kindExpr = arg.kind;
    const kind =
      kindExpr.t === "attr"
        ? (kindsOf.get(member(kindExpr, "EnemySprite")) ??
          fail(`${ENEMIES}:${line}: unknown sprite`))
        : Number(constant(kindExpr));
    const flagOf = (/** @type {string} */ k) =>
      arg[k] === undefined ? false : constant(arg[k]) === true;
    const dropKind =
      arg.drop_item_kind === undefined ? null : constant(arg.drop_item_kind);
    const list = spritesByRoom.get(room) ?? [];
    list.push({
      embed: flagOf("embed"),
      fix: flagOf("fix"),
      // A key drop's sprite (valid_drop_location, EnemyList.py:2250-2252)
      keyDrop: flagOf("drops_item") && (dropKind === 0xe4 || dropKind === 0xe5),
      kind,
      line,
      neverDrop: flagOf("never_drop"),
      overlord,
      region:
        arg.region === undefined
          ? null
          : /** @type {string | null} */ (constant(arg.region)),
      tileX: Number(constant(arg.tile_x)),
    });
    spritesByRoom.set(room, list);
  }
  // init_enemy_stats' dict: the last entry of a kind wins, as in a Python
  // dict (EnemyStats(sprite, static, drop_flag=False, ...), EnemyList.py:20-22)
  const statsFn = body(enemies, "init_enemy_stats", ENEMIES);
  /** @type {Map<number, boolean>} */
  const dropFlag = new Map();
  /** @type {Map<number, Stats>} */
  const stats = new Map();
  for (const { call, line } of callExpressions(
    enemies,
    "EnemyStats",
    ENEMIES,
    statsFn.start,
    statsFn.end,
  )) {
    const kind =
      kindsOf.get(member(call.args[0], "EnemySprite")) ??
      fail(`${ENEMIES}:${line}: unknown sprite`);
    const flag = call.args[2] ?? call.keywords.drop_flag;
    dropFlag.set(kind, flag === undefined ? false : constant(flag) === true);
    // health=, ignore= (EnemyStats.__init__, EnemyList.py:21-22)
    const health = call.keywords.health ?? call.args[5];
    const ignore = call.keywords.ignore ?? call.args[6];
    stats.set(kind, {
      health:
        health === undefined
          ? null
          : health.t === "seq"
            ? health.items.map((h) => Number(constant(h)))
            : /** @type {number | null} */ (constant(health)),
      ignore: ignore === undefined ? false : constant(ignore) === true,
      line,
    });
  }
  return { dropFlag, kindsOf, nameOfKind, spritesByRoom, stats };
}

// ---------------------------------------------------------------------------
// RuleFactory (source/logic/Rule.py)

/** @param {boolean} v @returns {Factory} */
const staticRule = (v) => ({ static: v });
/** @param {Rule} rule @returns {Factory} */
const ruleOf = (rule) => ({ rule });

/**
 * RuleFactory.disj (Rule.py:125-147): one rule is itself; a static true
 * wins, a static false is dropped, and nothing left is true.
 * @param {Factory[]} rules
 * @returns {Factory}
 */
function disj(rules) {
  if (rules.length === 1) return /** @type {Factory} */ (rules[0]);
  /** @type {Rule[]} */
  const kept = [];
  for (const r of rules) {
    if ("static" in r) {
      if (r.static) return r;
      continue;
    }
    kept.push(r.rule);
  }
  return ruleOf(kept.length === 0 ? TRUE : any(...kept));
}

/**
 * RuleFactory.conj (Rule.py:101-122): a static false wins, a static true is
 * dropped, and nothing left is true.
 * @param {Factory[]} rules
 * @returns {Factory}
 */
function conj(rules) {
  if (rules.length === 1) return /** @type {Factory} */ (rules[0]);
  /** @type {Rule[]} */
  const kept = [];
  for (const r of rules) {
    if ("static" in r) {
      if (!r.static) return r;
      continue;
    }
    kept.push(r.rule);
  }
  return ruleOf(kept.length === 0 ? TRUE : all(...kept));
}

/** @param {Factory} r @returns {Rule} */
export const finalRule = (r) =>
  "static" in r ? (r.static ? TRUE : FALSE) : r.rule;

// ---------------------------------------------------------------------------
// EnemyLogic.py

/** EnemyLogic.py:61-66 */
const DAMAGE_COST = {
  Bomb: 1,
  Bombos: 2,
  Bow: 1,
  Byrna: 1.125,
  Ether: 2,
  FireRod: 1,
  IceRod: 1,
  Powder: 0.5,
  Quake: 2,
  Silvers: 1,
  Somaria: 0.5,
};

/** -1 incinerated, -2 blobbed, -3 fairied (EnemyLogic.py:524) */
const SPECIAL_CLASSES = { 249: -3, 250: -2, 253: -1 };

/**
 * The enemy logic over DR's data and the state's rules.
 * @param {{ kindsOf: Map<string, number>, stats: Map<number, Stats>, damage: { DamageSource: Record<string, { class: number, subclass: number[] }>, SubClassTable: Record<string, number[]> } }} data
 * @param {Lib} lib
 */
export function enemyLogic(data, lib) {
  const kind = (/** @type {string} */ name) =>
    data.kindsOf.get(name) ?? fail(`${ENEMIES}: no EnemySprite.${name}`);
  const K = {
    Buzzblob: kind("Buzzblob"),
    HardhatBeetle: kind("HardhatBeetle"),
    RedBari: kind("RedBari"),
    Stalfos: kind("Stalfos"),
    StalfosKnight: kind("StalfosKnight"),
    Tektite: kind("Tektite"),
    Terrorpin: kind("Terrorpin"),
  };
  /** @param {string} item @returns {Factory} */
  const has = (item) => ruleOf(lib.has(item));
  const hasSword = () =>
    disj([
      has("Fighter Sword"),
      has("Master Sword"),
      has("Tempered Sword"),
      has("Golden Sword"),
    ]);
  const hasBeamSword = () =>
    disj([has("Master Sword"), has("Tempered Sword"), has("Golden Sword")]);
  const hasBluntWeapon = () => disj([hasSword(), has("Hammer")]);
  // 'Red_Boomerang' as written (EnemyLogic.py:419): no item bears it
  const hasBoomerang = () =>
    disj([has("Blue Boomerang"), has("Red_Boomerang")]);
  const hasClass2 = () => disj([hasBeamSword(), has("Hammer")]);
  const buzzblob = () =>
    disj([
      has("Golden Sword"),
      conj([
        hasBluntWeapon(),
        disj([hasBoomerang(), has("Hookshot"), has("Ice Rod")]),
      ]),
      conj([has("Ether"), hasSword()]),
      conj([has("Quake"), hasSword()]),
    ]);
  /** @param {number} magic @param {boolean} [full] */
  const extendMagic = (magic, full = false) =>
    ruleOf(lib.extendMagic(magic, full));
  const canUseBombs = () => ruleOf(lib.canUseBombs());

  /** @param {number} hits */
  const somaria = (hits) => {
    if (hits === -1) return has("Cane of Somaria");
    const magic = Math.ceil(hits / 64) * 8;
    return magic > 8
      ? conj([has("Cane of Somaria"), extendMagic(magic)])
      : has("Cane of Somaria");
  };
  /** @param {number} hits */
  const byrna = (hits) => {
    if (hits === -1) return has("Cane of Byrna");
    const magic = Math.ceil(hits / 7) * 8;
    return magic > 8
      ? conj([has("Cane of Byrna"), extendMagic(magic)])
      : has("Cane of Byrna");
  };
  /** @param {number} arrows */
  const bow = (arrows) =>
    arrows === -1 || (arrows > 0 && arrows <= 25)
      ? ruleOf(lib.normalArrows())
      : staticRule(false);
  /** @param {number} arrows */
  const silvers = (arrows) =>
    arrows === -1 || (arrows > 0 && arrows <= 25)
      ? ruleOf(lib.silverArrows())
      : staticRule(false);
  /** @param {number} bombs */
  const bombs = (bombs) =>
    bombs === -1 || (bombs > 0 && bombs <= 8)
      ? canUseBombs()
      : staticRule(false);
  /** @param {string} rod @param {number} shots */
  const rodRule = (rod, shots) => {
    if (shots === -1) return has(rod);
    return shots > 8 ? conj([has(rod), extendMagic(shots)]) : has(rod);
  };
  /** @param {number} shots */
  const powder = (shots) => {
    if (shots === -1) return has("Magic Powder");
    if (shots === -2)
      return conj([
        has("Magic Powder"),
        disj([hasBluntWeapon(), has("Hookshot")]),
      ]);
    const magic = Math.ceil(shots / 16) * 8;
    return magic > 8
      ? conj([has("Magic Powder"), extendMagic(shots)])
      : has("Magic Powder");
  };
  /** @param {string} medallion @param {number} shots */
  const medallion = (medallion, shots) => {
    if (shots === -1 || shots === -2) return conj([has(medallion), hasSword()]);
    return shots * 2 > 8
      ? conj([has(medallion), hasSword(), extendMagic(shots)])
      : conj([has(medallion), hasSword()]);
  };

  /**
   * number_of_hits (EnemyLogic.py:495-521).
   * @param {string} source
   * @param {number[]} subClasses
   * @param {Sprite} sprite
   * @param {Where} side
   */
  const numberOfHits = (source, subClasses, sprite, side) => {
    const damageSource =
      data.damage.DamageSource[source] ?? fail(`damage_table: ${source}`);
    const subClass = subClasses[damageSource.class] ?? 0;
    const amount = damageSource.subclass[subClass] ?? 0;
    if (amount === 0) return 0;
    if (amount <= 0x64) {
      let health = data.stats.get(sprite.kind)?.health;
      if (health === null || health === undefined)
        fail(`${ENEMIES}:${sprite.line}: no health`);
      if (Array.isArray(health)) {
        if (sprite.kind === K.Tektite || sprite.kind === K.HardhatBeetle)
          health = health[sprite.tileX & 1] ?? 0;
        else {
          const [light = 0, dark = 0] = health;
          health =
            side.light && side.dark
              ? Math.min(light, dark)
              : side.light
                ? light
                : side.dark
                  ? dark
                  : Math.max(light, dark);
        }
      }
      return Math.ceil(health / amount);
    }
    return (
      SPECIAL_CLASSES[/** @type {keyof typeof SPECIAL_CLASSES} */ (amount)] ?? 0
    );
  };

  /**
   * enemy_vulnerability (EnemyLogic.py:453-492): each damage type's hits,
   * the nonzero ones only, in the order set.
   * @param {Sprite} sprite
   * @param {Where} side
   * @returns {Map<string, number>}
   */
  const vulnerability = (sprite, side) => {
    const subClasses =
      data.damage.SubClassTable[String(sprite.kind)] ??
      fail(`damage_table: no subclass of ${sprite.kind}`);
    /** @type {Map<string, number>} */
    const vln = new Map();
    const hits = (/** @type {string} */ source) =>
      numberOfHits(source, subClasses, sprite, side);
    const c1 = hits("Sword1");
    if (c1 !== 0) {
      if (sprite.kind === K.Buzzblob) vln.set("Stun", -1);
      else {
        vln.set("Blunt", -1);
        vln.set("Master", -1);
      }
      vln.set("Somaria", c1);
      vln.set("Byrna", c1);
    } else if (hits("Sword3") !== 0) vln.set("Master", -1);
    const arrow = hits("Arrow");
    if (arrow !== 0) vln.set("Bow", arrow);
    const silver = hits("SilverArrow");
    if (silver !== 0) vln.set("Silvers", silver);
    for (const method of [
      "Bomb",
      "Hookshot",
      "FireRod",
      "IceRod",
      "Boomerang",
      "Powder",
      "Bombos",
      "Ether",
      "Quake",
    ]) {
      const n = hits(method);
      if (n === -3) {
        if (sprite.kind !== K.Buzzblob) vln.set(method, -1);
      } else if (n !== 0) vln.set(method, n);
    }
    return vln;
  };
  /** @param {Map<string, number>} vln @param {string} k */
  const v = (vln, k) => vln.get(k) ?? 0;

  /**
   * defeat_rule_single (EnemyLogic.py:11-58).
   * @param {Sprite} sprite
   * @param {Where} side
   * @returns {Factory}
   */
  const defeatSingle = (sprite, side) => {
    if (sprite.kind === K.Terrorpin) return has("Hammer");
    if (sprite.kind === K.RedBari)
      return disj([has("Fire Rod"), conj([hasSword(), has("Bombos")])]);
    const vln = vulnerability(sprite, side);
    /** @type {Factory[]} */
    const rules = [];
    if (v(vln, "Blunt") !== 0) rules.push(hasBluntWeapon());
    if (v(vln, "Stun") !== 0) rules.push(buzzblob());
    if (v(vln, "Somaria") !== 0) rules.push(somaria(v(vln, "Somaria")));
    if (v(vln, "Byrna") !== 0) rules.push(byrna(v(vln, "Byrna")));
    if (v(vln, "Master") !== 0) rules.push(hasClass2());
    if (v(vln, "Bow") !== 0) rules.push(bow(v(vln, "Bow")));
    if (v(vln, "Silvers") !== 0) rules.push(silvers(v(vln, "Silvers")));
    if (v(vln, "Bomb") !== 0) rules.push(bombs(v(vln, "Bomb")));
    if (v(vln, "Hookshot") !== 0) rules.push(has("Hookshot"));
    if (v(vln, "IceRod") !== 0)
      rules.push(rodRule("Ice Rod", v(vln, "IceRod")));
    if (v(vln, "FireRod") !== 0)
      rules.push(rodRule("Fire Rod", v(vln, "FireRod")));
    if (v(vln, "Boomerang") !== 0) rules.push(hasBoomerang());
    if (![0, -3].includes(v(vln, "Powder")))
      rules.push(powder(v(vln, "Powder")));
    for (const m of ["Bombos", "Ether", "Quake"])
      if (v(vln, m) !== 0 && v(vln, "Blunt") === 0)
        rules.push(medallion(m, v(vln, m)));
    if (sprite.kind === K.StalfosKnight)
      return conj([canUseBombs(), disj(rules)]);
    return disj(rules);
  };

  /**
   * needed_resources (EnemyLogic.py:215-216).
   * @param {string} type
   * @param {Map<string, number>[]} vlns
   */
  const needed = (type, vlns) =>
    vlns.reduce((sum, vln) => {
      const n = v(vln, type);
      return n === 0 ? sum : sum + (n >= 0 ? n : 1);
    }, 0);

  /**
   * find_possible_rules (EnemyLogic.py:150-212): the clears, by the set of
   * enemies each kills (its indexes, as a key), in the order DR makes them.
   * @param {Map<string, number>[]} vlns
   * @param {Record<string, number>} used
   * @returns {Map<string, { set: number[], rules: [Factory, Record<string, number>][] }>}
   */
  const possible = (vlns, used) => {
    /** @type {Map<string, { set: number[], rules: [Factory, Record<string, number>][] }>} */
    const clears = new Map();
    /** @type {Set<string>} */
    const blunt = new Set();
    /** @param {number[]} set @param {Factory} rule @param {Record<string, number>} res */
    const add = (set, rule, res) => {
      const key = set.join(",");
      const entry = clears.get(key) ?? { rules: [], set };
      entry.rules.push([rule, res]);
      clears.set(key, entry);
    };
    /** @param {string} type */
    const subset = (type) =>
      vlns.flatMap((vln, i) => (v(vln, type) !== 0 ? [i] : []));
    for (const type of ["Blunt", "Stun", "Master", "Boomerang", "Hookshot"]) {
      const set = subset(type);
      if (set.length === 0) continue;
      const key = set.join(",");
      if (type === "Blunt") {
        add(set, hasBluntWeapon(), {});
        blunt.add(key);
      }
      if (type === "Stun") add(set, buzzblob(), {});
      if (type === "Master" && !blunt.has(key)) add(set, hasClass2(), {});
      // As written: Boomerang's clear is the hookshot, Hookshot's the
      // boomerang (EnemyLogic.py:162-165)
      if (type === "Boomerang") add(set, has("Hookshot"), {});
      else if (type === "Hookshot") add(set, hasBoomerang(), {});
    }
    {
      const set = subset("Bomb");
      if (set.length > 0) {
        const hits = needed("Bomb", vlns);
        if (hits + (used.Bomb ?? 0) <= 8)
          add(set, bombs(hits + (used.Bomb ?? 0)), { Bomb: hits });
      }
    }
    for (const type of ["Bow", "Silvers"]) {
      const set = subset(type);
      if (set.length === 0) continue;
      const hits = needed(type, vlns);
      const total = hits + (used.Arrow ?? 0);
      if (total <= 25)
        add(set, type === "Bow" ? bow(total) : silvers(total), { Arrow: hits });
    }
    for (const type of [
      "Powder",
      "Somaria",
      "Byrna",
      "FireRod",
      "IceRod",
      "Bombos",
      "Ether",
      "Quake",
    ]) {
      const set = subset(type);
      if (set.length === 0) continue;
      const hits = needed(type, vlns);
      const magic = used.Magic ?? 0;
      const res = {
        Magic:
          DAMAGE_COST[/** @type {keyof typeof DAMAGE_COST} */ (type)] * hits,
      };
      const least = () => Math.min(...vlns.map((vln) => v(vln, type)));
      /** @param {number} f */
      const flagOr = (f) => {
        const low = least();
        return low < 0 ? low : f;
      };
      // An if/elif chain: a type whose own test fails falls to the last
      // branch, the medallions' (EnemyLogic.py:186-211)
      if (type === "Powder" && Math.ceil(hits / 16) * 8 + magic <= 160)
        add(set, powder(flagOr(hits + magic * 2)), res);
      else if (type === "Somaria" && Math.ceil(hits / 64) * 8 + magic <= 160)
        add(set, somaria(flagOr(hits + magic * 8)), res);
      else if (type === "Byrna" && Math.ceil(hits / 7) * 8 + magic <= 160)
        add(set, byrna(flagOr(hits + (magic * 7) / 8)), res);
      else if (type === "FireRod" && hits + magic <= 160)
        add(set, rodRule("Fire Rod", hits + magic), res);
      else if (type === "IceRod" && hits + magic <= 160)
        add(set, rodRule("Ice Rod", flagOr(hits + magic)), res);
      else if (hits * 2 + magic <= 160 && !blunt.has(set.join(",")))
        add(set, medallion(type, flagOr(hits + magic / 2)), res);
    }
    return clears;
  };

  /** Ties met, by the enemies' sprites. @type {string[][]} */
  const ties = [];

  /**
   * The rest of defeat_rule_multiple's loop (EnemyLogic.py:111-145) from
   * `vlns` with `used`: every tied choice followed, the results anded.
   * @param {Map<string, number>[]} vlns
   * @param {Record<string, number>} used
   * @param {string[]} names - The sprites, for the tie report
   * @returns {Factory}
   */
  const clearAll = (vlns, used, names) => {
    if (vlns.length === 0) return staticRule(true);
    const clears = possible(vlns, used);
    if (clears.size === 0)
      fail(`${LOGIC}:116: kill rules insufficient for ${names.join(", ")}`);
    let best = 0;
    /** @type {{ set: number[], rules: [Factory, Record<string, number>][] }[]} */
    let bests = [];
    for (const clear of clears.values()) {
      if (clear.set.length > best) {
        best = clear.set.length;
        bests = [clear];
      } else if (clear.set.length === best) bests.push(clear);
    }
    if (bests.length > 1) ties.push(names);
    const choices = bests.map(({ rules, set }) => {
      const next = { ...used };
      for (const [, res] of rules)
        for (const [k, n] of Object.entries(res)) next[k] = (next[k] ?? 0) + n;
      const left = vlns.filter((_, i) => !set.includes(i));
      const leftNames = names.filter((_, i) => !set.includes(i));
      return conj([
        disj(rules.map(([rule]) => rule)),
        clearAll(left, next, leftNames),
      ]);
    });
    return choices.length === 1
      ? /** @type {Factory} */ (choices[0])
      : ruleOf(all(...choices.map(finalRule)));
  };

  /**
   * defeat_rule_multiple (EnemyLogic.py:71-146).
   * @param {{ sprite: Sprite, side: Where }[]} pairs
   * @returns {Factory}
   */
  const defeatMultiple = (pairs) => {
    /** @type {Factory[]} */
    const required = [];
    const used = { Arrow: 0, Bomb: 0, Magic: 0 };
    let hammer = false;
    let bombsNeeded = false;
    /** @type {Map<string, number>[]} */
    const left = [];
    /** @type {string[]} */
    const names = [];
    for (const { sprite, side } of pairs) {
      const vln = vulnerability(sprite, side);
      if (sprite.kind === K.Terrorpin) {
        if (!hammer) required.push(has("Hammer"));
        hammer = true;
        continue;
      }
      if (sprite.kind === K.StalfosKnight) {
        if (!bombsNeeded) required.push(bombs(1));
        bombsNeeded = true;
        used.Bomb += 1;
        continue;
      }
      const types = [...vln.keys()];
      if (types.length === 1) {
        const type = /** @type {string} */ (types[0]);
        required.push(defeatSingle(sprite, side));
        const cost =
          DAMAGE_COST[/** @type {keyof typeof DAMAGE_COST} */ (type)];
        if (cost !== undefined) {
          if (type === "Bomb") used.Bomb += cost;
          else if (type === "Bow" || type === "Silvers") used.Arrow += cost;
          else used.Magic += cost;
        }
        continue;
      }
      left.push(vln);
      names.push(`${ENEMIES}:${sprite.line}`);
    }
    required.push(clearAll(left, used, names));
    return conj(required);
  };

  return { defeatMultiple, defeatSingle, hasBoomerang, K, ties };
}

// ---------------------------------------------------------------------------
// The rules Rules.py builds from the enemy logic

/**
 * DR's enemy data: the sprites, the stats, the damage table and the
 * special rules' table.
 * @param {(file: string) => string} read
 */
export function readEnemyData(read) {
  const { kindsOf, spritesByRoom, stats } = readSprites(read(ENEMIES));
  const damage =
    /** @type {{ DamageSource: Record<string, { class: number, subclass: number[] }>, SubClassTable: Record<string, number[]> }} */ (
      load(read("source/enemizer/damage_table.yaml"))
    );
  const logic = read(LOGIC);
  const special = assigned(logic, "special_rules_check", LOGIC);
  return {
    damage,
    kindsOf,
    special: /** @type {Record<string, number[] | null>} */ (special.value),
    specialLine: special.line,
    spritesByRoom,
    stats,
  };
}

/**
 * Every way the regions of tuple-health sprites may lie (light, dark, both
 * or neither), each with its condition on the world's derived settings.
 * @param {readonly Sprite[]} sprites
 * @param {Map<number, Stats>} stats
 * @param {{ Tektite: number, HardhatBeetle: number }} K
 * @param {(region: string) => { light: Rule, dark: Rule }} sides
 * @returns {{ when: Rule, where: Map<string, Where> }[]}
 */
function placements(sprites, stats, K, sides) {
  const regions = new Set(
    sprites
      .filter(
        (s) =>
          Array.isArray(stats.get(s.kind)?.health) &&
          s.kind !== K.Tektite &&
          s.kind !== K.HardhatBeetle,
      )
      .map((s) => s.region ?? ""),
  );
  /** @type {{ when: Rule, where: Map<string, Where> }[]} */
  let out = [{ when: TRUE, where: new Map() }];
  for (const region of regions) {
    const { dark, light } = sides(region);
    out = out.flatMap(({ when, where }) =>
      [
        [true, true],
        [true, false],
        [false, true],
        [false, false],
      ].map(([l, d]) => ({
        when: all(when, l ? light : negate(light), d ? dark : negate(dark)),
        where: new Map([
          ...where,
          [region, { dark: Boolean(d), light: Boolean(l) }],
        ]),
      })),
    );
  }
  return out;
}

/**
 * The rules of kill rooms and enemy drops.
 * @param {ReturnType<typeof readEnemyData>} data
 * @param {Lib} lib
 * @param {(region: string) => { light: Rule, dark: Rule }} sides
 *   Whether a region lies in the light world, and in the dark world: the
 *   world's derived settings (mark_light_dark_world_regions)
 */
export function enemyRules(data, lib, sides) {
  const logic = enemyLogic(data, lib);
  /** @param {number} room */
  const spritesOf = (room) =>
    data.spritesByRoom.get(room) ?? fail(`${ENEMIES}: no sprites in ${room}`);

  /**
   * get_challenge_rule (Rules.py:927-938) with stalfos_spawn_exception
   * (:941-946): the room's listed sprites, but those ignored for a kill
   * room, defeated together.
   * @param {number} room
   * @param {readonly number[]} enemyList
   * @param {string} region
   */
  const challenge = (room, enemyList, region) => {
    const list = spritesOf(room);
    /** @type {Sprite[]} */
    const sprites = [];
    enemyList.forEach((index) => {
      const sprite =
        list[index] ?? fail(`${ENEMIES}: no sprite ${index} in ${room}`);
      if (!data.stats.get(sprite.kind)?.ignore) sprites.push(sprite);
    });
    if (region === "Eastern Stalfos Spawn") {
      const stalfos = logic.K.Stalfos;
      const health = data.stats.get(stalfos)?.health;
      if (typeof health === "number" && health * 4 > 40)
        for (let k = 0; k < 4; k++)
          sprites.push({
            embed: false,
            fix: false,
            keyDrop: false,
            kind: stalfos,
            line: 0,
            neverDrop: false,
            overlord: false,
            region: "Eastern Stalfos Spawn",
            tileX: 0,
          });
    }
    if (sprites.length === 0) return { rule: TRUE, sprites };
    for (const s of sprites)
      if (s.region === null) fail(`${ENEMIES}:${s.line}: no region`);
    const rules = placements(sprites, data.stats, logic.K, sides).map(
      ({ when, where }) =>
        all(
          when,
          finalRule(
            logic.defeatMultiple(
              sprites.map((sprite) => ({
                side: where.get(sprite.region ?? "") ?? NOWHERE,
                sprite,
              })),
            ),
          ),
        ),
    );
    return { rule: any(...rules), sprites };
  };

  /**
   * drop_rules (Rules.py:994-1006) for the drop of sprite `index` of `room`
   * in `region`, its location `name`: defeat_rule_single, then
   * special_rules_for_region (EnemyLogic.py:238-283) where the table names
   * the region.
   * @param {number} room
   * @param {number} index
   * @param {string} region
   * @param {string} name
   */
  const drop = (room, index, region, name) => {
    const sprite =
      spritesOf(room)[index] ??
      fail(`${ENEMIES}: no sprite ${index} in ${room}`);
    const single = any(
      ...placements([{ ...sprite, region }], data.stats, logic.K, sides).map(
        ({ when, where }) =>
          all(
            when,
            finalRule(logic.defeatSingle(sprite, where.get(region) ?? NOWHERE)),
          ),
      ),
    );
    return { rule: special(region, name, single), sprite };
  };

  const hasBoomerang = () => finalRule(logic.hasBoomerang());
  const hookshot = () => lib.has("Hookshot");
  /**
   * special_rules_for_region (EnemyLogic.py:238-283).
   * @param {string} region
   * @param {string} name
   * @param {Rule} rule
   */
  const special = (region, name, rule) => {
    if (!(region in data.special)) return rule;
    const listed = data.special[region];
    const number = Number(name.split("#")[1]);
    /** @param {Rule} extra */
    const listedOnly = (extra) =>
      listed === null || listed === undefined || listed.includes(number)
        ? all(rule, extra)
        : rule;
    if (region === "Swamp Waterway") {
      // The medallions, each with a sword (EnemyLogic.py:240-243)
      const sword = finalRule(
        disj(
          [
            "Fighter Sword",
            "Master Sword",
            "Tempered Sword",
            "Golden Sword",
          ].map((item) => ruleOf(lib.has(item))),
        ),
      );
      return any(
        ...["Quake", "Ether", "Bombos"].map((m) => all(lib.has(m), sword)),
      );
    }
    if (region === "Mimic Cave") {
      if ([4, 5].includes(number)) return all(rule, lib.has("Hammer"));
      return listedOnly(hasBoomerang());
    }
    if (["Hera Back", "GT Petting Zoo"].includes(region))
      return listedOnly(hasBoomerang());
    if (
      ["TR Hub Ledges", "Ice Hookshot Ledge", "TR Dark Ride"].includes(region)
    )
      return listedOnly(any(hasBoomerang(), hookshot()));
    if (region === "Death Mountain Return Cave (left)")
      return [1, 5].includes(number)
        ? all(rule, any(hasBoomerang(), hookshot()))
        : all(rule, hookshot());
    return listedOnly(hookshot());
  };

  return { challenge, drop, ties: logic.ties };
}

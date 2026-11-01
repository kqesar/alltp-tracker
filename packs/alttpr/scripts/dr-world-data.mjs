/// <reference types="node" />
// The Door Randomizer's world as data (stage A of import-dr.mjs): its
// regions, its doors and the tables that wire them, read from DR's source
// at the release upstream.json pins. Nothing here is run: python.mjs reads
// the literals, calls and statements, and anything else stops the import
// with its file and line.
//
// - Regions.py: every region create_regions and create_dungeon_regions make
//   (Regions.py:9-1070), with its type, terrain, locations and exits, its
//   dungeon (Dungeons.py's make_dungeon lists) and whether it holds a
//   crystal switch. A list that differs by mode (`… if not std_flag else …`)
//   is read for open, standard and inverted: what one mode alone has is
//   listed under `locationModes`.
// - Doors.py: every door create_doors makes, its builder chain read
//   (`create_door(...).dir(...).small_key()…`) and the statements after the
//   list applied (barriers, events, dead ends, dungeon links, controllers,
//   paired doors, portals). A statement under an `if` is kept with its
//   condition in `conditional`, for the world to read per setting. A door's
//   layout bytes (ss, edge, toggler, trap's flag) are no logic and are
//   never written; its index in its room's door list (`pos`) is, with the
//   kind RoomData.py gives it there (Room.kind, RoomData.py:278-279: a key,
//   bombable, dashable or trap door...), which the door shuffle reassigns.
// - RoomData.py: each room's door list (create_rooms, :5-258), the swaps
//   it makes after, and what a door shuffle deletes there (:248-249).
// - The connection tables of OverworldShuffle.py, EntranceShuffle2.py and
//   DoorShuffle.py, each as it is written, with its line: the world builder
//   links them as link_overworld, link_entrances_new and link_doors_prep do.

import { regionId } from "./er-rules.mjs";
import {
  assigned,
  body,
  callExpressions,
  functionBody,
  literal,
  pythonExpression,
  tokens,
} from "./python.mjs";

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {import("./python.mjs").Statement} Statement
 * @typedef {"open" | "standard" | "inverted"} Mode
 */

const REGIONS = "Regions.py";
const DOORS = "Doors.py";
const DUNGEONS = "Dungeons.py";
const OVERWORLD = "OverworldShuffle.py";
const ENTRANCES = "source/overworld/EntranceShuffle2.py";
const DOOR_SHUFFLE = "DoorShuffle.py";
const ENTRANCE_DATA = "source/overworld/EntranceData.py";

/** @type {readonly Mode[]} */
export const MODES = ["open", "standard", "inverted"];

/** create_<kind>_region's arguments after the name (Regions.py:1072-1093). */
const REGION_PARAMS = {
  cave: ["hint", "locations", "exits"],
  dungeon: ["hint", "locations", "exits"],
  dw: ["locations", "exits", "hint", "terrain"],
  lw: ["locations", "exits", "hint", "terrain"],
  menu: ["locations", "exits"],
};

/** The tables the world is wired with, by file. */
export const TABLES = {
  [DOOR_SHUFFLE]: [
    "logical_connections",
    "vanilla_logical_connections",
    "spiral_staircases",
    "straight_staircases",
    "open_edges",
    "falldown_pits",
    "dungeon_warps",
    "ladders",
    "interior_doors",
    "default_door_connections",
    "default_one_way_connections",
    "portal_map",
    "multiple_portal_map",
  ],
  [ENTRANCES]: [
    "mandatory_connections",
    "drop_map",
    "linked_drop_map",
    "entrance_map",
    "single_entrance_map",
    "inverted_sub_table",
    "default_connections",
    "open_default_connections",
    "inverted_default_connections",
    "default_dungeon_connections",
    "open_default_dungeon_connections",
    "inverted_default_dungeon_connections",
    "modes",
    "default_lw",
    "default_dw",
    "exit_ids",
  ],
  [ENTRANCE_DATA]: ["door_addresses"],
  [OVERWORLD]: [
    "mandatory_connections",
    "open_mandatory_connections",
    "inverted_mandatory_connections",
    "default_connections",
    "mirror_connections",
  ],
};

/**
 * The tables the Overworld fork's world is wired with (OWR's own
 * OverworldShuffle.py and EntranceShuffle2.py: Inverted is a flip of every
 * tile there, `ow_connections` each tile's links as it stands or flipped,
 * no `open_`/`inverted_` lists), by file.
 */
export const OWR_TABLES = {
  [DOOR_SHUFFLE]: TABLES[DOOR_SHUFFLE],
  [ENTRANCES]: [
    "mandatory_connections",
    "drop_map",
    "linked_drop_map",
    "sw_linked_drop_map",
    "entrance_map",
    "single_entrance_map",
    "default_connections",
    "open_default_connections",
    "inverted_default_connections",
    "modes",
    "exit_ids",
  ],
  [ENTRANCE_DATA]: ["door_addresses"],
  [OVERWORLD]: [
    "mandatory_connections",
    "default_connections",
    "ow_connections",
    "mirror_connections",
    "default_whirlpool_connections",
  ],
  "source/overworld/FluteShuffle.py": ["default_flute_connections"],
};

/** @typedef {"dr" | "owr"} Flavor */

/**
 * A DR region's engine id: regionId of each part around " - ", joined by
 * "_". DR names "Mire Conveyor Crystal" and "Mire Conveyor - Crystal" apart,
 * which regionId alone would merge.
 * @param {string} name
 */
export const drRegionId = (name) => name.split(" - ").map(regionId).join("_");

/**
 * Stops the import.
 * @param {string} what
 * @returns {never}
 */
function fail(what) {
  throw new Error(what);
}

/**
 * A literal argument's value, the names a region list reads (`std_flag`,
 * `inv_flag`) taken from `env`.
 * @param {Expr | undefined} e
 * @param {Readonly<Record<string, unknown>>} env
 * @param {string} where
 * @returns {unknown}
 */
function evaluate(e, env, where) {
  if (e === undefined) return undefined;
  switch (e.t) {
    case "const":
      return e.value;
    case "seq":
      return e.items.map((item) => evaluate(item, env, where));
    case "name":
      if (e.name in env) return env[e.name];
      return fail(`${where}: the name ${e.name}`);
    case "attr":
      // Terrain.Water, Direction.West, CrystalBarrier.Blue: the member
      if (e.of.t === "name") return `${e.of.name}.${e.name}`;
      return fail(`${where}: an attribute`);
    case "not":
      return !evaluate(e.of, env, where);
    case "ifelse":
      return evaluate(e.test, env, where)
        ? evaluate(e.then, env, where)
        : evaluate(e.otherwise, env, where);
    default:
      return fail(`${where}: an expression (${e.t})`);
  }
}

/**
 * A string list (or None) of an argument.
 * @param {unknown} value
 * @param {string} where
 * @returns {string[]}
 */
function names(value, where) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
    return fail(`${where}: no list of names`);
  return /** @type {string[]} */ (value);
}

/**
 * The items an argument of make_dungeon makes: None, `[]`,
 * `ItemFactory('X', player)`, `[ItemFactory('X', player)]` or
 * `ItemFactory(['X'] * n, player)`.
 * @param {Expr | undefined} e
 * @param {string} where
 * @returns {string[]}
 */
function itemsOf(e, where) {
  if (e === undefined || (e.t === "const" && e.value === null)) return [];
  if (e.t === "seq") return e.items.flatMap((item) => itemsOf(item, where));
  if (e.t === "call" && e.fn.t === "name" && e.fn.name === "ItemFactory") {
    const [arg] = e.args;
    if (arg?.t === "const" && typeof arg.value === "string") return [arg.value];
    if (arg?.t === "seq") return arg.items.flatMap((i) => itemsOf(i, where));
    if (
      arg?.t === "op" &&
      arg.op === "*" &&
      arg.left.t === "seq" &&
      arg.right.t === "const" &&
      typeof arg.right.value === "number"
    ) {
      const one = arg.left.items.flatMap((i) => itemsOf(i, where));
      return Array.from({ length: arg.right.value }, () => one).flat();
    }
  }
  if (e.t === "const" && typeof e.value === "string") return [e.value];
  return fail(`${where}: a dungeon's items`);
}

/**
 * Each region Dungeons.py puts in a dungeon (create_dungeons' make_dungeon,
 * its fourth argument a module list), and each dungeon's boss.
 * @param {string} source
 */
function readDungeons(source) {
  const create = body(source, "create_dungeons", DUNGEONS);
  /** @type {Map<string, string>} */
  const dungeonOf = new Map();
  /** @type {{ name: string, boss: string | null, bigKey: string | null, smallKeys: string[], prize?: string | null, source: string }[]} */
  const dungeons = [];
  for (const { call, line } of callExpressions(
    source,
    "make_dungeon",
    DUNGEONS,
    create.start,
    create.end,
  )) {
    const [name, , boss, list, bigKey, smallKeys] = call.args;
    if (
      name?.t !== "const" ||
      typeof name.value !== "string" ||
      boss?.t !== "const" ||
      list?.t !== "name"
    )
      fail(`${DUNGEONS}:${line}: a make_dungeon of no literals`);
    const regions = assigned(source, list.name, DUNGEONS).value;
    if (!Array.isArray(regions)) fail(`${DUNGEONS}: ${list.name} is no list`);
    for (const region of regions) {
      if (dungeonOf.has(String(region)))
        fail(`${DUNGEONS}: ${region} in two dungeons`);
      dungeonOf.set(String(region), name.value);
    }
    dungeons.push({
      bigKey: itemsOf(bigKey, `${DUNGEONS}:${line}`)[0] ?? null,
      boss: typeof boss.value === "string" ? boss.value : null,
      name: name.value,
      smallKeys: itemsOf(smallKeys, `${DUNGEONS}:${line}`),
      source: `${DUNGEONS}:${line}`,
    });
  }
  // Each dungeon's prize location (dungeon_table, DungeonInfo's eighth
  // argument), which restrict_boss_items reads (Rules.py:810-825)
  const table = /^dungeon_table = \{$/m.exec(source);
  if (table === null) fail(`${DUNGEONS}: no dungeon_table`);
  const tableLine = source.slice(0, table.index).split("\n").length;
  const rows = source.slice(table.index).split("\n");
  for (let i = 1; i < rows.length && rows[i] !== "}"; i++) {
    const row = /^ {4}'([^']+)': (DungeonInfo\(.*\)),$/.exec(rows[i] ?? "");
    if (row === null) fail(`${DUNGEONS}:${tableLine + i}: a dungeon_table row`);
    const info = pythonExpression(row[2] ?? "");
    const prize = info.t === "call" ? info.args[7] : undefined;
    const dungeon = dungeons.find((d) => d.name === row[1]);
    if (dungeon === undefined) fail(`${DUNGEONS}: no dungeon ${row[1]}`);
    // DR names the prize's location; the Overworld fork lists the ROM's
    // addresses of a prize instead, its location being the dungeon's
    // `- Prize` (owr:Rules.py:978-981, Thieves' Town spelled so)
    dungeon.prize =
      prize?.t === "const" && prize.value === null
        ? null
        : prize?.t === "const" && typeof prize.value === "string"
          ? prize.value
          : prize?.t === "seq"
            ? `${row[1]?.startsWith("Thieves") ? "Thieves' Town" : row[1]} - Prize`
            : fail(`${DUNGEONS}:${tableLine + i}: a prize`);
  }
  return { dungeonOf, dungeons };
}

/**
 * Every region, in the order Regions.py makes them.
 * @param {string} source - Regions.py
 * @param {ReadonlyMap<string, string>} dungeonOf
 */
function readRegions(source, dungeonOf) {
  const regions = [];
  for (const fn of ["create_regions", "create_dungeon_regions"]) {
    const { start, end } = body(source, fn, REGIONS);
    for (const [kind, params] of Object.entries(REGION_PARAMS)) {
      for (const { call, line } of callExpressions(
        source,
        `create_${kind}_region`,
        REGIONS,
        start,
        end,
      )) {
        const where = `${REGIONS}:${line}`;
        const [, nameArg, ...rest] = call.args;
        const name = evaluate(nameArg, {}, where);
        if (typeof name !== "string") fail(`${where}: a region of no name`);
        if (Object.keys(call.keywords).length > 0)
          fail(`${where}: a keyword argument`);
        // Each argument, for each mode
        const byMode = MODES.map((mode) => {
          /** @type {Record<string, unknown>} */
          const args = {};
          const env = {
            inv_flag: mode === "inverted",
            std_flag: mode === "standard",
          };
          params.forEach((param, i) => {
            args[param] = evaluate(rest[i], env, where);
          });
          return args;
        });
        const [open = {}] = byMode;
        const lists = (/** @type {string} */ param) =>
          byMode.map((args) => names(args[param], where));
        const exits = lists("exits");
        if (exits.some((list) => list.join() !== exits[0]?.join()))
          fail(`${where}: exits that differ by mode`);
        const locations = lists("locations");
        const all = [...new Set(locations.flat())];
        /** @type {Record<string, Mode[]>} */
        const locationModes = {};
        for (const location of all) {
          const modes = MODES.filter((_, i) =>
            locations[i]?.includes(location),
          );
          if (modes.length < MODES.length) locationModes[location] = modes;
        }
        const terrain = open.terrain ?? "Terrain.Land";
        regions.push({
          dungeon: kind === "dungeon" ? (dungeonOf.get(name) ?? null) : null,
          exits: exits[0] ?? [],
          id: drRegionId(name),
          line,
          locations: all,
          ...(Object.keys(locationModes).length > 0 ? { locationModes } : {}),
          name,
          source: where,
          ...(kind === "lw" || kind === "dw"
            ? { terrain: String(terrain).replace("Terrain.", "").toLowerCase() }
            : {}),
          type: kind,
        });
      }
    }
  }
  regions.sort((a, b) => a.line - b.line);
  // world.get_region('X', player).crystal_switch = True
  const byName = new Map(regions.map((region) => [region.name, region]));
  const tail = body(source, "create_dungeon_regions", REGIONS);
  for (const m of source
    .slice(tail.start, tail.end)
    .matchAll(
      /world\.get_region\('((?:[^'\\]|\\.)*)', player\)\.crystal_switch = True/g,
    )) {
    const name = (m[1] ?? "").replace(/\\'/g, "'");
    const region = byName.get(name) ?? fail(`${REGIONS}: no region ${name}`);
    Object.assign(region, { crystalSwitch: true });
  }
  return regions.map(({ line: _, ...region }) => region);
}

/**
 * Doors.py's shortcuts (`Nrml = DoorType.Normal`, `We = Direction.West`).
 * @param {string} source
 */
function shortcuts(source) {
  /** @type {Map<string, string>} */
  const found = new Map();
  for (const m of source.matchAll(/^(\w+) = (DoorType|Direction)\.(\w+)$/gm))
    found.set(m[1] ?? "", `${m[2]}.${m[3]}`);
  return found;
}

/**
 * Every door of Doors.py, by name, with its logic flags.
 * @param {string} source - Doors.py
 */
function readDoors(source) {
  const short = shortcuts(source);
  /** @param {Expr | undefined} e @param {string} of @param {string} where */
  const member = (e, of, where) => {
    const value =
      e?.t === "name"
        ? short.get(e.name)
        : e?.t === "attr" && e.of.t === "name"
          ? `${e.of.name}.${e.name}`
          : undefined;
    if (value === undefined || !value.startsWith(`${of}.`))
      return fail(`${where}: no ${of}`);
    return value.slice(of.length + 1);
  };
  /** @param {Expr | undefined} e @param {string} where */
  const string = (e, where) =>
    e?.t === "const" && typeof e.value === "string"
      ? e.value
      : fail(`${where}: no string`);

  /** @type {Map<string, Record<string, unknown> & { name: string }>} */
  const doors = new Map();
  const create = body(source, "create_doors", DOORS);
  for (const { call, line } of callExpressions(
    source,
    "create_door",
    DOORS,
    create.start,
    create.end,
  )) {
    const where = `${DOORS}:${line}`;
    // The chain, from create_door outwards
    /** @type {Extract<Expr, { t: "call" }>[]} */
    const chain = [];
    /** @type {Expr} */
    let at = call;
    while (at.t === "call") {
      chain.unshift(at);
      if (at.fn.t !== "attr") break;
      at = at.fn.of;
    }
    const [head, ...methods] = chain;
    if (head?.fn.t !== "name" || head.fn.name !== "create_door")
      fail(`${where}: a door of no create_door`);
    const name = string(head.args[1], where);
    /** @type {Record<string, unknown> & { name: string }} */
    const door = {
      bigKey: false,
      crystal: null,
      dead: false,
      direction: null,
      event: null,
      listPos: null,
      name,
      portalAble: false,
      smallKey: false,
      source: where,
      stonewall: false,
      supertile: null,
      trapped: false,
      type: member(head.args[2], "DoorType", where),
    };
    for (const step of methods) {
      const method = step.fn.t === "attr" ? step.fn.name : "";
      switch (method) {
        case "dir": {
          door.direction = member(step.args[0], "Direction", where);
          const room = step.args[1];
          if (room?.t !== "const" || typeof room.value !== "number")
            fail(`${where}: dir of no room`);
          door.supertile = room.value;
          break;
        }
        case "small_key":
          door.smallKey = true;
          break;
        case "big_key":
          door.bigKey = true;
          break;
        case "no_exit":
          door.trapped = true;
          break;
        case "no_entrance":
          door.stonewall = true;
          break;
        case "kill":
          door.dead = true;
          break;
        case "c_switch":
          door.crystal = "either";
          break;
        case "barrier":
          door.crystal = member(
            step.args[0],
            "CrystalBarrier",
            where,
          ).toLowerCase();
          break;
        case "event":
          door.event = string(step.args[0], where);
          break;
        case "portal":
          door.portalAble = true;
          break;
        // Its index in its room's door list (RoomData.py), which says
        // its kind (Room.kind, :278-279)
        case "pos": {
          const at = step.args[0];
          if (at?.t !== "const" || typeof at.value !== "number")
            fail(`${where}: pos of no number`);
          door.listPos = at.value;
          break;
        }
        // Layout: where the door sits and how the room scrolls
        case "ss":
        case "edge":
        case "toggler":
        case "trap":
          break;
        default:
          fail(`${where}: the door method ${method}`);
      }
    }
    if (doors.has(name)) fail(`${where}: door ${name} twice`);
    doors.set(name, door);
  }

  /** @param {string} name @param {string} where */
  const door = (name, where) =>
    doors.get(name) ?? fail(`${where}: no door ${name}`);
  /**
   * A flag set on a door, under `when` if a branch's condition.
   * @param {string} name
   * @param {string} field
   * @param {unknown} value
   * @param {string | undefined} when
   * @param {string} where
   */
  const set = (name, field, value, when, where) => {
    const target = door(name, where);
    if (when === undefined) {
      target[field] = value;
      return;
    }
    const list = /** @type {unknown[]} */ (target.conditional ?? []);
    list.push({ field, source: where, value, when });
    target.conditional = list;
  };
  /** `world.get_door('X', player)` as X. @param {Expr | undefined} e */
  const gotDoor = (e) =>
    e?.t === "call" &&
    e.fn.t === "attr" &&
    e.fn.name === "get_door" &&
    e.args[0]?.t === "const"
      ? String(e.args[0].value)
      : undefined;
  /** Python literal values of a flag's assignment. */
  const FLAGS = {
    bk_shuffle_req: "bkShuffleReq",
    dungeonLink: "dungeonLink",
    lw_restricted: "lwRestricted",
    passage: "passage",
    rupee_bow_restricted: "rupeeBowRestricted",
    standard_restricted: "standardRestricted",
  };

  /** @type {{ name: string, door: string, source: string }[]} */
  const portals = [];
  /** @type {Map<string, string>} */
  const locals = new Map();
  /**
   * A name a branch binds to a string (the Overworld fork's
   * `zelda_location = 'Zelda Pickup'`): each value, with its branch's
   * condition.
   * @type {Map<string, { value: string, when: string | undefined }[]>}
   */
  const strings = new Map();
  /** Both conditions, as one. @param {string | undefined} outer @param {string} inner */
  const both = (outer, inner) =>
    outer === undefined ? inner : `(${outer}) and (${inner})`;
  /**
   * @param {Statement[]} statements
   * @param {string | undefined} when
   */
  const walk = (statements, when) => {
    /** The condition of the `if` an `else` follows. @type {string | undefined} */
    let previous;
    for (const statement of statements) {
      const { line, text } = statement;
      const where = `${DOORS}:${line}`;
      if (text.startsWith("if ")) {
        previous = text.slice(3).replace(/:$/, "");
        walk(statement.body, both(when, previous));
        continue;
      }
      if (text === "else" && previous !== undefined) {
        walk(statement.body, both(when, `not (${previous})`));
        previous = undefined;
        continue;
      }
      previous = undefined;
      if (/^(elif |else)/.test(text) || statement.block)
        fail(`${where}: a block`);
      const bound = /^(\w+) = '((?:[^'\\]|\\.)*)'$/.exec(text);
      if (bound !== null) {
        const list = strings.get(bound[1] ?? "") ?? [];
        list.push({ value: (bound[2] ?? "").replace(/\\'/g, "'"), when });
        strings.set(bound[1] ?? "", list);
        continue;
      }
      // name = world.get_door('X', player)
      const local =
        /^(\w+) = world\.get_door\('((?:[^'\\]|\\.)*)', player\)$/.exec(text);
      if (local !== null) {
        locals.set(local[1] ?? "", (local[2] ?? "").replace(/\\'/g, "'"));
        continue;
      }
      // controller_door(controller, world.get_door('X', player))
      const controlled =
        /^controller_door\((\w+), world\.get_door\('((?:[^'\\]|\\.)*)', player\)\)$/.exec(
          text,
        );
      if (controlled !== null) {
        const controller =
          locals.get(controlled[1] ?? "") ?? fail(`${where}: no controller`);
        door(controller, where);
        set(
          (controlled[2] ?? "").replace(/\\'/g, "'"),
          "controller",
          controller,
          when,
          where,
        );
        continue;
      }
      const flag =
        /^world\.get_door\(((?:'(?:[^'\\]|\\.)*')|(?:"[^"]*")), player\)\.(\w+)(?: = (.+)|\((.*)\))$/.exec(
          text,
        );
      if (flag !== null) {
        const [, quoted = "", attr = "", assignedValue, args] = flag;
        const name = quoted.slice(1, -1).replace(/\\'/g, "'");
        if (assignedValue !== undefined) {
          const field =
            FLAGS[/** @type {keyof typeof FLAGS} */ (attr)] ??
            fail(`${where}: the door flag ${attr}`);
          const value = /^'(.*)'$/.exec(assignedValue)?.[1];
          set(
            name,
            field,
            value ??
              (assignedValue === "True"
                ? true
                : assignedValue === "False"
                  ? false
                  : fail(`${where}: the value ${assignedValue}`)),
            when,
            where,
          );
          continue;
        }
        switch (attr) {
          case "barrier": {
            const crystal = /^CrystalBarrier\.(\w+)$/.exec(args ?? "")?.[1];
            if (crystal === undefined) fail(`${where}: a barrier`);
            set(name, "crystal", crystal.toLowerCase(), when, where);
            break;
          }
          case "c_switch":
            set(name, "crystal", "either", when, where);
            break;
          case "event": {
            const literal = /^'(.*)'$/.exec(args ?? "")?.[1];
            // An event a branch named: once per value, under its branch
            const values =
              literal !== undefined
                ? [{ value: literal, when }]
                : (strings.get(args ?? "") ?? fail(`${where}: an event`));
            for (const { value, when: named } of values)
              set(
                name,
                "event",
                value,
                // A binding under this statement's own branch holds it
                named === undefined ||
                  when === undefined ||
                  named === when ||
                  named.startsWith(`(${when}) and `)
                  ? (named ?? when)
                  : both(when, named),
                where,
              );
            break;
          }
          case "kill":
            set(name, "dead", true, when, where);
            break;
          case "dead_end":
            // dead_end(allowPassage=False) (BaseClasses.py Door.dead_end)
            set(name, "deadEnd", true, when, where);
            set(name, "passage", args === "allowPassage=True", when, where);
            break;
          default:
            fail(`${where}: the door call ${attr}`);
        }
        continue;
      }
      // What only builds DR's own structures
      if (
        /^(world\.doors \+= doors|world\.initialize_doors\(doors\)|assign_entrances\(world, player\)|doors = \[)/.test(
          text,
        )
      )
        continue;
      const sub =
        /^(create_paired_doors|create_portals|set_special_dungeon_links)\(world, player\)$/.exec(
          text,
        )?.[1];
      if (sub === "set_special_dungeon_links") {
        walk(functionBody(source, sub, DOORS).body, when);
        continue;
      }
      if (sub === "create_paired_doors") {
        const fn = body(source, sub, DOORS);
        for (const { call, line: at } of callExpressions(
          source,
          "PairedDoor",
          DOORS,
          fn.start,
          fn.end,
        )) {
          const a = string(call.args[0], `${DOORS}:${at}`);
          const b = string(call.args[1], `${DOORS}:${at}`);
          set(a, "paired", b, when, `${DOORS}:${at}`);
          set(b, "paired", a, when, `${DOORS}:${at}`);
        }
        continue;
      }
      if (sub === "create_portals") {
        const fn = body(source, sub, DOORS);
        for (const { call, line: at } of callExpressions(
          source,
          "create_portal",
          DOORS,
          fn.start,
          fn.end,
        )) {
          const portal = string(call.args[1], `${DOORS}:${at}`);
          const name =
            gotDoor(call.args[2]) ?? fail(`${DOORS}:${at}: a portal's door`);
          // create_portal sets the door's entranceFlag (Doors.py:1662)
          set(name, "portal", portal, when, `${DOORS}:${at}`);
          set(name, "entranceFlag", true, when, `${DOORS}:${at}`);
          portals.push({ door: name, name: portal, source: `${DOORS}:${at}` });
        }
        continue;
      }
      fail(`${where}: the statement ${text.slice(0, 60)}`);
    }
  };
  walk(functionBody(source, "create_doors", DOORS).body, undefined);
  // A flag at its default (False, None) is left out; `passage` defaults to
  // True (BaseClasses.py Door), so it is kept when set
  /** @param {Record<string, unknown> & { name: string }} entry */
  const leanOf = (entry) =>
    /** @type {Record<string, unknown> & { name: string }} */ (
      Object.fromEntries(
        Object.entries(entry).filter(
          ([k, v]) => k === "passage" || (v !== false && v !== null),
        ),
      )
    );
  const lean = [...doors.values()].map(leanOf);
  return { doors: lean, portals };
}

const ROOMS = "RoomData.py";

/**
 * Each room's door kinds, in its door list's order (RoomData.py
 * create_rooms, :5-258): the list as built, the swaps applied, and the
 * index a door shuffle deletes (`shuffled`). What an enemy shuffle changes
 * (:254-256) is left out: the tracker does not model it.
 * @param {string} source - RoomData.py
 * @returns {Map<number, { kinds: string[], shuffled: Set<number> }>}
 */
function readRooms(source) {
  const fn = body(source, "create_rooms", ROOMS);
  /** @type {Map<number, { kinds: string[], shuffled: Set<number> }>} */
  const rooms = new Map();
  for (const { call, line } of callExpressions(
    source,
    "Room",
    ROOMS,
    fn.start,
    fn.end,
  )) {
    const where = `${ROOMS}:${line}`;
    /** @type {Extract<Expr, { t: "call" }>[]} */
    const chain = [];
    /** @type {Expr} */
    let at = call;
    while (at.t === "call") {
      chain.unshift(at);
      if (at.fn.t !== "attr") break;
      at = at.fn.of;
    }
    const [head, ...doors] = chain;
    const index = head?.args[1];
    if (index?.t !== "const" || typeof index.value !== "number")
      fail(`${where}: a room of no index`);
    /** @type {string[]} */
    const kinds = [];
    for (const step of doors) {
      const kind = step.args[1];
      if (
        step.fn.t !== "attr" ||
        step.fn.name !== "door" ||
        kind?.t !== "attr" ||
        kind.of.t !== "name" ||
        kind.of.name !== "DoorKind"
      )
        fail(`${where}: a room's door of no DoorKind`);
      kinds.push(kind.name);
    }
    if (rooms.has(index.value)) fail(`${where}: room ${index.value} twice`);
    rooms.set(index.value, { kinds, shuffled: new Set() });
  }
  const room = (/** @type {string} */ hex, /** @type {string} */ where) =>
    rooms.get(Number.parseInt(hex, 16)) ?? fail(`${where}: no room ${hex}`);
  /** @param {Statement[]} statements @param {string | undefined} when */
  const walk = (statements, when) => {
    for (const { body: inner, line, text } of statements) {
      const where = `${ROOMS}:${line}`;
      if (text.startsWith("world.rooms += [")) continue;
      if (/^if world\.doorShuffle\[player\] != 'vanilla':?$/.test(text)) {
        walk(inner, "doorShuffle");
        continue;
      }
      // Enemy shuffle's kill rooms: not modelled
      if (/^if world\.enemy_shuffle\[player\] != 'none':?$/.test(text))
        continue;
      const call =
        /^world\.get_room\(0x([0-9a-f]+), player\)\.(swap|delete)\((\d+)(?:, (\d+))?\)$/.exec(
          text,
        );
      if (call === null) fail(`${where}: the statement ${text.slice(0, 60)}`);
      const [, hex = "", what, a = "", b] = call;
      const { kinds, shuffled } = room(hex, where);
      if (what === "swap" && when === undefined && b !== undefined) {
        const i = Number(a);
        const j = Number(b);
        [kinds[i], kinds[j]] = [kinds[j] ?? "", kinds[i] ?? ""];
      } else if (what === "delete" && when === "doorShuffle")
        shuffled.add(Number(a));
      else fail(`${where}: the statement ${text.slice(0, 60)}`);
    }
  };
  walk(functionBody(source, "create_rooms", ROOMS).body, undefined);
  return rooms;
}

/**
 * Each door's kind in its room's list (Room.kind): the vanilla kind, and,
 * where a door shuffle deletes its entry, `FF` then (`shuffledKind`).
 * @param {(Record<string, unknown> & { name: string })[]} doors
 * @param {Map<number, { kinds: string[], shuffled: Set<number> }>} rooms
 */
function withKinds(doors, rooms) {
  return doors.map((door) => {
    const { listPos, supertile } = door;
    if (typeof listPos !== "number") return door;
    const room = rooms.get(/** @type {number} */ (supertile));
    const kind = room?.kinds[listPos];
    if (room === undefined || kind === undefined)
      fail(`${door.source}: no kind at ${listPos} of room ${supertile}`);
    return {
      ...door,
      kind,
      ...(room.shuffled.has(listPos) ? { shuffledKind: "FF" } : {}),
    };
  });
}

/**
 * What a table keeps of each entry where it is more than the world needs:
 * of door_addresses, a door's slot of the game's door table or a hole's
 * addresses of its hole table (the layout bytes after them are left out);
 * of exit_ids, the entrance number a target loads.
 * @type {Readonly<Record<string, (entry: unknown) => unknown>>}
 */
const LEAN = {
  door_addresses: (entry) => (Array.isArray(entry) ? entry[0] : entry),
  exit_ids: (entry) => (Array.isArray(entry) ? entry[0] : entry),
};

/**
 * The connection tables, each with its line.
 * @param {(file: string) => string} read
 * @param {Readonly<Record<string, readonly string[]>>} [wanted]
 */
function readTables(read, wanted = TABLES) {
  /** @type {Record<string, Record<string, { line: number, value: unknown }>>} */
  const tables = {};
  for (const [file, list] of Object.entries(wanted)) {
    const source = read(file);
    tables[file] = Object.fromEntries(
      list.map((name) => {
        const { line, value } = assigned(source, name, file);
        const lean = LEAN[name];
        return [
          name,
          {
            line,
            value:
              lean === undefined
                ? value
                : Object.fromEntries(
                    Object.entries(
                      /** @type {Record<string, unknown>} */ (value),
                    ).map(([key, entry]) => [key, lean(entry)]),
                  ),
          },
        ];
      }),
    );
  }
  return tables;
}

const OW_EDGES = "OWEdges.py";
const FLUTE = "source/overworld/FluteShuffle.py";

/**
 * A dict a module wraps in bidict (`OWTileRegions = bidict({…})`), and its
 * line.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 */
function bidictOf(source, name, file) {
  const match = new RegExp(`^${name} = bidict\\(`, "m").exec(source);
  if (match === null) fail(`${file}: no ${name} = bidict(…)`);
  const stream = tokens(source, match.index + match[0].length, file);
  const line = stream.peek().line;
  const value = literal(stream);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail(`${file}:${line}: ${name} is no dict`);
  return { line, value: /** @type {Record<string, unknown>} */ (value) };
}

/** create_owedge's shortcuts (OWEdges.py:17-23). */
const EDGE_NAMES = {
  Ea: "east",
  Ld: "land",
  No: "north",
  So: "south",
  We: "west",
  Wr: "water",
};

/**
 * What the Overworld fork adds to the world, as data (owr: files):
 * - `tiles`: each overworld region's screen (OWEdges.py OWTileRegions),
 *   which `is_tile_swapped` reads (BaseClasses.py:331-332: a screen is
 *   flipped in Inverted, or in Mixed when its tile swaps);
 * - `edges`: each screen edge create_owedges makes (name, screen,
 *   direction, terrain; layout bytes left out) and its parallel in the
 *   other world (parallel_links);
 * - `flute`: each flute spot's screen, its region as the screen stands or
 *   flipped and its slot, which orders the spots (FluteShuffle.py
 *   flute_data: the rest of a row is layout);
 * - `bonk`: the bonk drops (Regions.py bonk_prize_table): the region, the
 *   overworld flag (screen, mask: MultiClient.py:978-987 reads
 *   SAVEDATA_START + 0x280 + screen), whether Agahnim must fall first, and
 *   where the fork's own world map draws it (`map`, the 4096-pixel world's
 *   x and y: ow_loc_prize_table, OverworldShuffle.py, else its screen's
 *   middle as Rom.py's map code falls back to it; none for a drop in a
 *   cave, which no screen holds).
 * @param {(file: string) => string} read
 */
function readOverworld(read) {
  const edgesSource = read(OW_EDGES);
  const tiles = bidictOf(edgesSource, "OWTileRegions", OW_EDGES);
  const parallel = bidictOf(edgesSource, "parallel_links", OW_EDGES);
  const fn = body(edgesSource, "create_owedges", OW_EDGES);
  /** @param {Expr | undefined} e @param {string} where */
  const short = (e, where) =>
    e?.t === "name" && e.name in EDGE_NAMES
      ? EDGE_NAMES[/** @type {keyof typeof EDGE_NAMES} */ (e.name)]
      : fail(`${where}: an edge's direction or terrain`);
  const edges = callExpressions(
    edgesSource,
    "create_owedge",
    OW_EDGES,
    fn.start,
    fn.end,
  ).map(({ call: chain, line }) => {
    const where = `${OW_EDGES}:${line}`;
    // The chain's root: create_owedge(...).coordInfo(...)… (layout bytes)
    /** @type {Expr} */
    let call = chain;
    while (call.t === "call" && call.fn.t === "attr") call = call.fn.of;
    if (call.t !== "call") fail(`${where}: an edge`);
    const [, name, screen, direction, terrain] = call.args;
    if (name?.t !== "const" || typeof name.value !== "string")
      fail(`${where}: an edge of no name`);
    if (screen?.t !== "const" || typeof screen.value !== "number")
      fail(`${where}: an edge of no screen`);
    const other = parallel.value[name.value];
    return {
      direction: short(direction, where),
      name: name.value,
      ...(typeof other === "string" ? { parallel: other } : {}),
      screen: screen.value,
      source: where,
      terrain: short(terrain, where),
    };
  });
  const named = new Set(edges.map((edge) => edge.name));
  if (named.size !== edges.length) fail(`${OW_EDGES}: an edge twice`);
  for (const [a, b] of Object.entries(parallel.value))
    if (!named.has(a) || !named.has(String(b)))
      fail(`${OW_EDGES}:${parallel.line}: parallel_links' ${a}`);
  const fluteSource = read(FLUTE);
  const flute = assigned(fluteSource, "flute_data", FLUTE);
  const regionsSource = read(REGIONS);
  const bonk = assigned(regionsSource, "bonk_prize_table", REGIONS);
  const bonkStart = regionsSource.indexOf("\nbonk_prize_table = {");
  const overworldSource = read(OVERWORLD);
  const prizes = assigned(overworldSource, "ow_loc_prize_table", OVERWORLD);
  const prizesStart = overworldSource.indexOf("\now_loc_prize_table = {");
  /**
   * Where the fork's map draws a location of a screen's region: its row of
   * ow_loc_prize_table, else the screen's middle, a large screen's at its
   * centre (Rom.py's map code, :1494-1501).
   * @param {string} name @param {number | undefined} screen
   */
  const mapOf = (name, screen) => {
    const row = /** @type {Record<string, unknown>} */ (prizes.value)[name];
    if (Array.isArray(row)) {
      const [x, y] = row;
      if (typeof x !== "number" || typeof y !== "number")
        fail(`${OVERWORLD}:${prizes.line}: ${name}'s place`);
      const at = overworldSource.indexOf(`'${name}'`, prizesStart);
      return {
        source: `${OVERWORLD}:${overworldSource.slice(0, at).split("\n").length}`,
        x,
        y,
      };
    }
    if (screen === undefined) return undefined;
    const tile = screen % 0x40;
    const large = [0x00, 0x03, 0x05, 0x18, 0x1b, 0x1e, 0x30, 0x35];
    const shift = large.includes(tile) ? 0x100 : 0;
    return {
      source: "Rom.py:1494-1501",
      x: 0x200 * (tile % 0x08) + 0x100 + shift,
      y: 0x200 * Math.floor(tile / 0x08) + 0x100 + shift,
    };
  };
  return {
    bonk: Object.entries(
      /** @type {Record<string, unknown[]>} */ (bonk.value),
    ).map(([name, row]) => {
      const at = regionsSource.indexOf(`'${name}'`, bonkStart);
      const where = `${REGIONS}:${regionsSource.slice(0, at).split("\n").length}`;
      const [, mask, aga, , region] = row;
      const screen = tiles.value[String(region)];
      if (
        typeof mask !== "number" ||
        typeof aga !== "boolean" ||
        typeof region !== "string"
      )
        fail(`${where}: a bonk drop's row`);
      const map = mapOf(name, typeof screen === "number" ? screen : undefined);
      return {
        aga,
        // MultiClient.py:980-985: only a drop of a screen's region is read
        ...(typeof screen === "number" ? { flag: { mask, screen } } : {}),
        ...(map === undefined ? {} : { map }),
        name,
        region,
        source: where,
      };
    }),
    edges,
    flute: Object.fromEntries(
      Object.entries(
        /** @type {Record<string, unknown[]>} */ (flute.value),
      ).map(([screen, row]) => {
        const [regions, slot] = row;
        if (
          !Array.isArray(regions) ||
          regions.length !== 2 ||
          regions.some((r) => typeof r !== "string") ||
          typeof slot !== "number"
        )
          fail(`${FLUTE}:${flute.line}: flute_data's ${screen}`);
        // The slot orders the spots (sort_flute_spots, :655-657)
        return [screen, { regions, slot }];
      }),
    ),
    source: {
      bonk: `${REGIONS}:${bonk.line}`,
      flute: `${FLUTE}:${flute.line}`,
      map: `${OVERWORLD}:${prizes.line}`,
      parallel: `${OW_EDGES}:${parallel.line}`,
      tiles: `${OW_EDGES}:${tiles.line}`,
    },
    tiles: tiles.value,
  };
}

/**
 * Stage A: DR's regions, doors and connection tables; the Overworld fork's
 * own (`flavor` "owr") with what it adds to the overworld.
 * @param {(file: string) => string} read - A file of the checkout
 * @param {Flavor} [flavor]
 */
export function importDrWorld(read, flavor = "dr") {
  const { dungeonOf, dungeons } = readDungeons(read(DUNGEONS));
  const regions = readRegions(read(REGIONS), dungeonOf);
  const ids = new Set(regions.map((region) => region.id));
  if (ids.size !== regions.length) {
    const seen = new Map();
    for (const r of regions) {
      if (seen.has(r.id))
        fail(`${REGIONS}: ${seen.get(r.id)} and ${r.name} share an id`);
      seen.set(r.id, r.name);
    }
  }
  for (const name of dungeonOf.keys())
    if (!regions.some((region) => region.name === name))
      fail(`${DUNGEONS}: no region ${name}`);
  const { doors, portals } = readDoors(read(DOORS));
  return {
    connections: readTables(read, flavor === "owr" ? OWR_TABLES : TABLES),
    doors: withKinds(doors, readRooms(read(ROOMS))),
    dungeons,
    ...(flavor === "owr" ? { overworld: readOverworld(read) } : {}),
    portals,
    regions,
  };
}

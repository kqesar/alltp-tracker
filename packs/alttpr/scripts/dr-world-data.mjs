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
//   layout bytes (pos, ss, edge, toggler, trap's flag) are no logic and are
//   never written.
// - The connection tables of OverworldShuffle.py, EntranceShuffle2.py and
//   DoorShuffle.py, each as it is written, with its line: the world builder
//   links them as link_overworld, link_entrances_new and link_doors_prep do.

import { regionId } from "./er-rules.mjs";
import { assigned, body, callExpressions, functionBody } from "./python.mjs";

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
    const row = /^ {4}'([^']+)': DungeonInfo\((.*)\),$/.exec(rows[i] ?? "");
    if (row === null) fail(`${DUNGEONS}:${tableLine + i}: a dungeon_table row`);
    const args = (row[2] ?? "").split(/, (?=(?:[^"']|"[^"]*"|'[^']*')*$)/);
    const prize = args[7]?.trim() ?? "";
    const dungeon = dungeons.find((d) => d.name === row[1]);
    if (dungeon === undefined) fail(`${DUNGEONS}: no dungeon ${row[1]}`);
    dungeon.prize =
      prize === "None"
        ? null
        : (/^(['"])(.*)\1$/.exec(prize)?.[2] ??
          fail(`${DUNGEONS}:${tableLine + i}: a prize`));
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
        // Layout: where the door sits and how the room scrolls
        case "pos":
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
   * @param {Statement[]} statements
   * @param {string | undefined} when
   */
  const walk = (statements, when) => {
    for (const statement of statements) {
      const { line, text } = statement;
      const where = `${DOORS}:${line}`;
      if (text.startsWith("if ")) {
        if (when !== undefined) fail(`${where}: an if within an if`);
        walk(statement.body, text.slice(3).replace(/:$/, ""));
        continue;
      }
      if (/^(elif |else)/.test(text) || statement.block)
        fail(`${where}: a block`);
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
          case "event":
            set(
              name,
              "event",
              /^'(.*)'$/.exec(args ?? "")?.[1] ?? fail(`${where}: an event`),
              when,
              where,
            );
            break;
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
 */
function readTables(read) {
  /** @type {Record<string, Record<string, { line: number, value: unknown }>>} */
  const tables = {};
  for (const [file, list] of Object.entries(TABLES)) {
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

/**
 * Stage A: DR's regions, doors and connection tables.
 * @param {(file: string) => string} read - A file of the checkout
 */
export function importDrWorld(read) {
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
    connections: readTables(read),
    doors,
    dungeons,
    portals,
    regions,
  };
}

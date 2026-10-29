#!/usr/bin/env node
/// <reference types="node" />
// Imports the entrance randomizer's tables as JSON.
//
//   node scripts/import-er.mjs <er-checkout> --rom <base.sfc>
//
// vt hands a seed with shuffled entrances to the entrance randomizer
// (cassidoxa/ALttPEntranceRandomizer, MIT, (c) 2017 LLCoolDave), at the
// commit vt's composer.json pins. The checkout is untrusted data: this
// script only reads its files, and never runs Python or anything else from
// it. It reads the Python literals it needs (lists, tuples, dicts, sets,
// strings, numbers) with a small tokenizer (python.mjs), from where the
// source assigns or passes them; anything else there stops the import with
// the file and line.
//
// What comes out: src/entrances/er.json, the tables below;
// src/entrances/rules.json, the randomizer's access rules in the engine's
// language (er-rules.mjs); test/er-upstream/, its own tests' cases
// (er-tests.mjs).
//
// From EntranceShuffle.py: the module's entrance tables, the holes and their
// targets of scramble_holes, Skull Woods' of skull_woods_shuffle, each
// door's slot in the game's door table and its exit position in
// door_addresses (its overworld area and where Link stands outside it), and
// the entrance and exit numbers of exit_ids. From Regions.py: every region
// create_regions makes, with its kind, locations and exits, and its engine
// id (regionId). The output is deterministic; the repository's Biome then
// sorts its keys and formats it, as the checks want it.
//
// A hole has no position in door_addresses, only the addresses where the
// randomizer writes its entrance: one byte of the game's hole table, whose
// positions and areas sit beside it (zelda3 overworld.c,
// Overworld_GetPitDestination). Those are read from the base ROM, the
// Japanese 1.0 one alttpr.com asks for, given with --rom and checked by its
// MD5, as is the room each exit of the game leaves from. The ROM is read,
// never copied: four small tables of it.
//
// Autotracking reads which door Link went through from memory as numbers
// (src/autotrack/entrances.ts): src/autotrack/entrance-tables.json is what
// it needs of these tables, small enough to load with the session.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importErRules, regionId } from "./er-rules.mjs";
import { importErTests } from "./er-tests.mjs";
import { readCommit } from "./import-upstream-tests.mjs";
import { assigned, body, calls } from "./python.mjs";

export const ER_REPO = "cassidoxa/ALttPEntranceRandomizer";

/** The module-level tables imported from EntranceShuffle.py. */
export const TABLES = [
  "LW_Dungeon_Entrances",
  "LW_Dungeon_Entrances_Must_Exit",
  "DW_Dungeon_Entrances",
  "DW_Dungeon_Entrances_Must_Exit",
  "Dungeon_Exits_Base",
  "DW_Entrances_Must_Exit",
  "Two_Door_Caves_Directional",
  "Two_Door_Caves",
  "Old_Man_Entrances",
  "Old_Man_House_Base",
  "Cave_Exits_Base",
  "Cave_Three_Exits_Base",
  "LW_Entrances",
  "DW_Entrances",
  "Bomb_Shop_Multi_Cave_Doors",
  "Blacksmith_Multi_Cave_Doors",
  "LW_Single_Cave_Doors",
  "DW_Single_Cave_Doors",
  "Blacksmith_Single_Cave_Doors",
  "Bomb_Shop_Single_Cave_Doors",
  "Single_Cave_Doors",
  "Single_Cave_Targets",
  "mandatory_connections",
  "default_connections",
  "default_dungeon_connections",
];

const REGION_KINDS = { cave: "cave", dungeon: "dungeon", dw: "dw", lw: "lw" };

/** The Japanese 1.0 ROM's MD5, the base every alttpr.com seed patches. */
export const BASE_ROM_MD5 = "03a63945398191337e896e5771f77173";

/**
 * The game's hole table, PC offsets: 19 positions (words), 19 areas
 * (words), 19 entrances (bytes). A position is a map16 index within its
 * area: row * 128 + column * 2 (Overworld_GetPitDestination). Its rows run
 * 7 above the tiles the overworld draws: the Pyramid's hole is at row 0 in
 * the table and drawn at rows 7 to 9 (CreatePyramidHole, overworld.c:
 * 3539-3547). With those 7 rows, every hole lands within a point of the
 * legacy map's marker of what lies under it (entrances.spec.ts).
 */
const HOLE_ROWS_ABOVE = 7;
const HOLE_POSITIONS = 0xdb800;
const HOLE_AREAS = 0xdb826;
const HOLE_ENTRANCES = 0xdb84c;
export const HOLES = 19;

/**
 * The game's door table: the entrance each overworld door loads, by its
 * slot (Rom.py:539, z3randomizer doorframefixes.asm:11).
 */
const DOOR_TABLE = 0xdbb73;

/**
 * The room each of the game's 79 exits leaves from, words (zelda3
 * overworld.c:1788-1789, kExitDataRooms): the exit's area follows them, the
 * table Rom.py:500 writes at 0x15B8C. The randomizer leaves them as they
 * are ("room id is deliberately not written", Rom.py:497).
 */
const EXIT_ROOMS = 0x15aee;
const EXITS = 79;

/**
 * Rooms the game leaves without its exit table: a cave of one door brings
 * Link back to the door he came in by, but Link's House (zelda3
 * overworld.c:1784-1785, LoadCachedEntranceProperties).
 * @param {number} room
 */
const leftByCache = (room) => room >= 0x100 && room < 0x180 && room !== 0x104;

/** Entries of exit_ids for the Inverted world, whose tables are not ported. */
const INVERTED = /^Inverted /;

/**
 * Where a hole lies, by the first address door_addresses gives for it: its
 * entry of the hole table. Its area and where Link falls, in the world's
 * pixels, as a door's exit.
 * @param {Uint8Array} rom
 * @param {number} address
 */
export function holeAt(rom, address) {
  const index = address - HOLE_ENTRANCES;
  if (index < 0 || index >= HOLES)
    throw new Error(`${address.toString(16)} is no entry of the hole table`);
  /** @param {number} at */
  const word = (at) => (rom[at] ?? 0) | ((rom[at + 1] ?? 0) << 8);
  const pos = word(HOLE_POSITIONS + 2 * index);
  const area = word(HOLE_AREAS + 2 * index);
  // An area's top-left screen, in a world of 8 by 8 screens of 512 pixels
  const screen = area & 0x3f;
  // The middle of the tile
  return {
    area,
    x: (screen & 7) * 512 + ((pos & 0x7e) >> 1) * 16 + 8,
    y: (screen >> 3) * 512 + ((pos >> 7) + HOLE_ROWS_ABOVE) * 16 + 8,
  };
}

/**
 * What autotracking needs to tell the door Link came out by: the door
 * table's size, and the entrance each room's exit is, for the rooms the game
 * looks up in its exit table (the last exit of the room, as zelda3
 * overworld.c:1788-1789 searches). Cross-checked against the base ROM: each
 * door's slot of the door table loads a target whose exit leaves from the
 * room door_addresses gives that door, so slots, exit numbers and rooms all
 * agree with the game.
 * @param {Uint8Array} rom - The base ROM
 * @param {[string, [number | number[], number[] | null]][]} doorAddresses
 * @param {Record<string, { entrance: number | null, exit?: number }>} exits
 */
export function autotrackTables(rom, doorAddresses, exits) {
  /** @param {number} at */
  const word = (at) => (rom[at] ?? 0) | ((rom[at + 1] ?? 0) << 8);
  const rooms = Array.from({ length: EXITS }, (_, k) =>
    word(EXIT_ROOMS + 2 * k),
  );
  /** The entrance of each exit number, of the worlds ported. */
  const entranceOfExit = new Map();
  /** The exit numbers of each entrance. */
  const exitsOf = new Map();
  for (const [name, { entrance, exit }] of Object.entries(exits)) {
    if (INVERTED.test(name) || entrance === null || exit === undefined)
      continue;
    const known = entranceOfExit.get(exit);
    if (known !== undefined && known !== entrance)
      throw new Error(`exit_ids: exit ${exit} loads two entrances`);
    entranceOfExit.set(exit, entrance);
    exitsOf.set(entrance, [...(exitsOf.get(entrance) ?? []), exit]);
  }
  let slots = 0;
  for (const [name, [slot, exit]] of doorAddresses) {
    if (exit === null || INVERTED.test(name)) continue;
    const door = /** @type {number} */ (slot);
    slots = Math.max(slots, door + 1);
    for (const k of exitsOf.get(rom[DOOR_TABLE + door] ?? -1) ?? []) {
      if (rooms[k] !== exit[0])
        throw new Error(
          `${name}: the base ROM's exit ${k} leaves room ${rooms[k]?.toString(16)}, door_addresses says ${exit[0]?.toString(16)}`,
        );
    }
  }
  /** @type {Record<number, number>} */
  const exitRooms = {};
  rooms.forEach((room, k) => {
    if (leftByCache(room)) return;
    // The room's last exit is the game's, even one no door loads
    const entrance = entranceOfExit.get(k);
    if (entrance === undefined) delete exitRooms[room];
    else exitRooms[room] = entrance;
  });
  return { doors: slots, exitRooms, holes: HOLES };
}

/**
 * The retro world's take-any caves (ItemList.py set_up_take_anys): the
 * regions it makes, the old man's sword cave and the take-anys, and the
 * caves whose doors it draws for them (`take_any_locations`), each such
 * door then leading to one of its regions instead. Read as written, or the
 * import stops.
 * @param {string} source - ItemList.py
 */
export function takeAnys(source) {
  const file = "ItemList.py";
  const { end, start } = body(source, "set_up_take_anys", file);
  const text = source.slice(start, end);
  const line = source.slice(0, start + 1).split("\n").length;
  const old = /= Region\("([^"]+)", RegionType\.Cave/.exec(text);
  const loop =
    /for num in range\((\d+)\):\n\s+take_any = Region\("([^"#]*#)\{\}"\.format\(num\+1\), RegionType\.Cave/.exec(
      text,
    );
  const drawn = /regions = random\.sample\(take_any_locations, (\d+)\)/.exec(
    text,
  );
  if (old === null || loop === null || drawn === null)
    throw new Error(`${file}:${line}: set_up_take_anys reads otherwise`);
  const regions = [
    old[1] ?? "",
    ...Array.from(
      { length: Number(loop[1]) },
      (_, i) => `${loop[2] ?? ""}${i + 1}`,
    ),
  ];
  if (Number(drawn[1]) !== regions.length)
    throw new Error(`${file}:${line}: a take-any cave for each door drawn`);
  return {
    caves: assigned(source, "take_any_locations", file),
    line,
    regions: regions.map((name) => ({ id: regionId(name), name })),
  };
}

/**
 * Everything the tracker reads of the entrance randomizer.
 * @param {string} checkout
 * @param {string} romFile - The base ROM
 */
export function importEr(checkout, romFile) {
  const rom = readFileSync(romFile);
  const md5 = createHash("md5").update(rom).digest("hex");
  if (md5 !== BASE_ROM_MD5)
    throw new Error(`${romFile} is not the base ROM (MD5 ${md5})`);
  const shuffleFile = "EntranceShuffle.py";
  const shuffle = readFileSync(join(checkout, shuffleFile), "utf8");
  const regionsFile = "Regions.py";
  const regionsSource = readFileSync(join(checkout, regionsFile), "utf8");
  const license = readFileSync(join(checkout, "LICENSE"), "utf8");
  const copyright = license.split("\n").find((l) => l.startsWith("Copyright"));
  if (copyright === undefined) throw new Error("No copyright line in LICENSE");

  const tables = Object.fromEntries(
    TABLES.map((name) => [name, assigned(shuffle, name, shuffleFile)]),
  );

  const holes = body(shuffle, "scramble_holes", shuffleFile);
  const within = shuffle.slice(holes.start, holes.end);
  /** @param {string} name */
  const local = (name) => {
    const found = assigned(within, name, shuffleFile, "\\s+");
    // Lines within the function, back to the file's
    const offset = shuffle.slice(0, holes.start).split("\n").length - 1;
    return { line: found.line + offset, value: found.value };
  };
  const skull = body(shuffle, "skull_woods_shuffle", shuffleFile);
  const [skullHoles, skullDoors] = calls(
    shuffle,
    "connect_random",
    shuffleFile,
    skull.start,
    skull.end,
  );
  if (skullHoles === undefined || skullDoors === undefined)
    throw new Error(`${shuffleFile}: skull_woods_shuffle's two calls`);

  // door_addresses: name -> (slot, (room, area, vram, scroll y, scroll x,
  // link y, link x, …)) for a door; (addresses, None) for a hole
  const addresses = assigned(shuffle, "door_addresses", shuffleFile);
  const doorAddresses = Object.entries(
    /** @type {Record<string, [number | number[], number[] | null]>} */ (
      addresses.value
    ),
  );
  const doors = Object.fromEntries(
    doorAddresses.map(([name, [slot, exit]]) => {
      if (exit !== null) {
        return [name, { area: exit[1], slot, x: exit[6], y: exit[5] }];
      }
      const bytes = /** @type {number[]} */ (slot);
      return [
        name,
        {
          ...holeAt(rom, bytes[0] ?? 0),
          hole: true,
          // Its bytes of the hole table; the Inverted Pyramid's last lies
          // elsewhere (Rom.py writes it for the Inverted world only)
          slots: bytes
            .map((address) => address - HOLE_ENTRANCES)
            .filter((slot) => slot >= 0 && slot < HOLES),
        },
      ];
    }),
  );

  // exit_ids: name -> entrance for a place of one door, (entrance, exit)
  // for the side of a cave or a dungeon; the entrance is None for an exit no
  // door loads
  const exitIds = assigned(shuffle, "exit_ids", shuffleFile);
  const exits = Object.fromEntries(
    Object.entries(
      /** @type {Record<string, number | [number | null, number]>} */ (
        exitIds.value
      ),
    ).map(([name, value]) => [
      name,
      typeof value === "number"
        ? { entrance: value }
        : { entrance: value[0], exit: value[1] },
    ]),
  );
  const autotrack = autotrackTables(rom, doorAddresses, exits);

  const regions = [];
  const create = body(regionsSource, "create_regions", regionsFile);
  for (const kind of Object.keys(REGION_KINDS)) {
    for (const { args, line } of calls(
      regionsSource,
      `create_${kind}_region`,
      regionsFile,
      create.start,
      create.end,
    )) {
      // (player, name, locations, exits); caves and dungeons put a hint
      // before the locations
      const [, name, ...rest] = args;
      const [locations, exits] =
        kind === "cave" || kind === "dungeon" ? rest.slice(1) : rest;
      if (
        typeof name !== "string" ||
        !Array.isArray(locations ?? []) ||
        !Array.isArray(exits ?? [])
      )
        throw new Error(`${regionsFile}:${line}: a region of no literals`);
      regions.push({
        exits: /** @type {string[]} */ (exits ?? []),
        id: regionId(name),
        kind,
        line,
        locations: /** @type {string[]} */ (locations ?? []),
        name,
      });
    }
  }
  regions.sort((a, b) => a.line - b.line);
  const ids = new Set(regions.map((region) => region.id));
  if (ids.size !== regions.length)
    throw new Error(`${regionsFile}: two regions share an engine id`);
  const upstream = {
    commit: readCommit(checkout),
    copyright,
    license: "MIT",
    repo: ER_REPO,
  };

  return {
    // Written apart, for autotracking (main)
    autotrack,
    doors: { line: addresses.line, value: doors },
    exits: { line: exitIds.line, value: exits },
    generated:
      "By packs/alttpr/scripts/import-er.mjs from the entrance randomizer. Re-import, never edit.",
    holes: {
      entrances: local("hole_entrances"),
      targets: local("hole_targets"),
    },
    regions,
    skullWoods: {
      doors: { line: skullDoors.line, value: skullDoors.args.slice(1, 3) },
      holes: { line: skullHoles.line, value: skullHoles.args.slice(1, 3) },
    },
    tables,
    takeAnys: takeAnys(readFileSync(join(checkout, "ItemList.py"), "utf8")),
    upstream,
  };
}

/** @param {string[]} argv */
function main(argv) {
  const args = [...argv];
  const romAt = args.indexOf("--rom");
  const romFile = romAt < 0 ? undefined : args.splice(romAt, 2)[1];
  const pack = join(dirname(fileURLToPath(import.meta.url)), "..");
  const checkout = args[0];
  if (checkout === undefined || romFile === undefined || args.length !== 1) {
    process.stderr.write(
      "Usage: import-er.mjs <er-checkout> --rom <base.sfc>\n",
    );
    process.exit(2);
  }
  /** @param {string} file */
  const read = (file) => readFileSync(join(resolve(checkout), file), "utf8");
  const { autotrack, ...er } = importEr(resolve(checkout), resolve(romFile));
  const { regions, upstream } = er;
  const rules = {
    generated: er.generated,
    upstream,
    ...importErRules(read, regions),
  };
  /** @type {[string, unknown][]} */
  const outputs = [
    ["src/entrances/er.json", er],
    ["src/entrances/rules.json", rules],
    [
      "src/autotrack/entrance-tables.json",
      { generated: er.generated, upstream, ...autotrack },
    ],
    ...importErTests(read).map(
      (fixture) =>
        /** @type {[string, unknown]} */ ([
          `test/er-upstream/${basename(fixture.file, ".py")}.json`,
          { generated: er.generated, upstream, ...fixture },
        ]),
    ),
  ];
  mkdirSync(join(pack, "test/er-upstream"), { recursive: true });
  for (const [file, data] of outputs)
    writeFileSync(join(pack, file), `${JSON.stringify(data, null, 1)}\n`);
  // As the repository checks them: keys sorted, Biome's format
  execFileSync(join(pack, "../../node_modules/.bin/biome"), [
    "check",
    "--write",
    ...outputs.map(([file]) => join(pack, file)),
  ]);
  process.stdout.write(
    `${upstream.repo}@${upstream.commit}: ${Object.keys(er.tables).length} tables, ${Object.keys(er.doors.value).length} doors, ${regions.length} regions; ${Object.keys(rules.entrances).length + Object.keys(rules.locations).length} rules, ${rules.unported.length} unported; ${outputs.length - 3} test files; door table of ${autotrack.doors} slots, ${Object.keys(autotrack.exitRooms).length} exit rooms\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}

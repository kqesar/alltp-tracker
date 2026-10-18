#!/usr/bin/env node
/// <reference types="node" />
// Imports the entrance randomizer's tables as JSON.
//
//   node scripts/import-er.mjs <er-checkout> --rom <base.sfc> [--out <dir>]
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
// Two files come out: er.json, the tables below, and rules.json, the
// randomizer's access rules in the engine's language (er-rules.mjs).
//
// From EntranceShuffle.py: the module's entrance tables, the holes and their
// targets of scramble_holes, Skull Woods' of skull_woods_shuffle, and each
// door's exit position in door_addresses (its overworld area and where Link
// stands outside it). From Regions.py: every region create_regions makes,
// with its kind, locations and exits, and its engine id (regionId). The
// output is deterministic; the repository's Biome then sorts its keys and
// formats it, as the checks want it.
//
// A hole has no position in door_addresses, only the addresses where the
// randomizer writes its entrance: one byte of the game's hole table, whose
// positions and areas sit beside it (zelda3 overworld.c,
// Overworld_GetPitDestination). Those are read from the base ROM, the
// Japanese 1.0 one alttpr.com asks for, given with --rom and checked by its
// MD5. The ROM is read, never copied: three small tables of it.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importErRules, regionId } from "./er-rules.mjs";
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
  "default_connections",
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
const HOLES = 19;

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

  // door_addresses: name -> (entrance, (room, area, vram, scroll y, scroll x,
  // link y, link x, …)) for a door; (addresses, None) for a hole
  const addresses = assigned(shuffle, "door_addresses", shuffleFile);
  const doors = Object.fromEntries(
    Object.entries(
      /** @type {Record<string, [number | number[], number[] | null]>} */ (
        addresses.value
      ),
    ).map(([name, [entrance, exit]]) => [
      name,
      exit !== null
        ? { area: exit[1], x: exit[6], y: exit[5] }
        : {
            ...holeAt(rom, /** @type {number[]} */ (entrance)[0] ?? 0),
            hole: true,
          },
    ]),
  );

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
    doors: { line: addresses.line, value: doors },
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
    upstream,
  };
}

/** @param {string[]} argv */
function main(argv) {
  const args = [...argv];
  const romAt = args.indexOf("--rom");
  const romFile = romAt < 0 ? undefined : args.splice(romAt, 2)[1];
  const outAt = args.indexOf("--out");
  const here = dirname(fileURLToPath(import.meta.url));
  const out =
    outAt < 0
      ? join(here, "../src/entrances")
      : resolve(args.splice(outAt, 2)[1] ?? "");
  const checkout = args[0];
  if (checkout === undefined || romFile === undefined || args.length !== 1) {
    process.stderr.write(
      "Usage: import-er.mjs <er-checkout> --rom <base.sfc> [--out <dir>]\n",
    );
    process.exit(2);
  }
  const er = importEr(resolve(checkout), resolve(romFile));
  const { regions, upstream } = er;
  const rules = {
    generated: er.generated,
    upstream,
    ...importErRules(
      (file) => readFileSync(join(resolve(checkout), file), "utf8"),
      regions,
    ),
  };
  const files = [join(out, "er.json"), join(out, "rules.json")];
  writeFileSync(files[0] ?? "", `${JSON.stringify(er, null, 1)}\n`);
  writeFileSync(files[1] ?? "", `${JSON.stringify(rules, null, 1)}\n`);
  // As the repository checks them: keys sorted, Biome's format
  execFileSync(join(here, "../../../node_modules/.bin/biome"), [
    "check",
    "--write",
    ...files,
  ]);
  process.stdout.write(
    `${upstream.repo}@${upstream.commit}: ${Object.keys(er.tables).length} tables, ${Object.keys(er.doors.value).length} doors, ${regions.length} regions; ${Object.keys(rules.entrances).length + Object.keys(rules.locations).length} rules, ${rules.unported.length} unported\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}

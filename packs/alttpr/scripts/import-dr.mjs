#!/usr/bin/env node
/// <reference types="node" />
// Imports the Door Randomizer's extra locations as JSON.
//
//   node scripts/import-dr.mjs <dr-checkout>
//
// aerinon/ALttPDoorRandomizer (MIT, (c) 2019 aerinon), at the release
// upstream.json pins (doorRandomizer), adds locations alttpr.com never had:
// the keys enemies and pots hold (key drops), the pots of its pottery modes,
// the enemies of its "underworld" drop shuffle, and the shops' items of its
// shopsanity and take-any options. The checkout is untrusted data: this
// script only reads its files, and never runs Python or anything else from
// it (python.mjs reads the literals and calls it needs; anything else stops
// the import with the file and line). The pots' RoomObject arguments, the
// ROM's bytes of each pot, are parsed past and never written.
//
// What comes out: src/door-rando/locations.json, one entry per location
// with DR's exact name, its dungeon, its region, and the bit of DR's base
// patch that says it was collected (src/door-rando/locations.ts reads it);
// src/door-rando/world/, DR's regions, doors and connection tables
// (dr-world-data.mjs) and its rules in the engine's language (dr-rules.mjs);
// test/dr-upstream/, its own tests and customizer seeds (dr-tests.mjs). Never edit those files by hand: run this script again.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { constant, member, readSprites } from "./dr-enemies.mjs";
import { importDrRules, importStaticKeyLogic } from "./dr-rules.mjs";
import { harnessFile, importDrTests, SUITES } from "./dr-tests.mjs";
import { importDrWorld } from "./dr-world-data.mjs";
import { readCommit } from "./import-upstream-tests.mjs";
import { assigned, expression, literal, tokens } from "./python.mjs";

export const DR_REPO = "aerinon/ALttPDoorRandomizer";
export const DR_VERSION = "1.5.8";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/door-rando/locations.json");
const WORLD = resolve(HERE, "../src/door-rando/world");

/**
 * A value as JSON, its object keys sorted: the files come out the same for
 * the same source.
 * @param {unknown} value
 * @returns {string}
 */
const sorted = (value) =>
  JSON.stringify(value, (_, v) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );

/**
 * A generated file of entries a line: `{ "upstream": …, "<list>": [\n …\n] }`.
 * @param {string} file
 * @param {Record<string, unknown>} head - Written first, a key a line
 * @param {Record<string, readonly unknown[] | Record<string, unknown>>} lists
 *   Each array an entry a line; each object a key a line
 */
function writeLines(file, head, lists) {
  const parts = [
    ...Object.entries(head).map(
      ([k, v]) => `  ${JSON.stringify(k)}: ${sorted(v)}`,
    ),
    ...Object.entries(lists).map(([k, list]) => {
      const lines = Array.isArray(list)
        ? list.map((entry) => `    ${sorted(entry)}`)
        : Object.entries(list).map(
            ([key, entry]) => `    ${JSON.stringify(key)}: ${sorted(entry)}`,
          );
      const [open, close] = Array.isArray(list) ? ["[", "]"] : ["{", "}"];
      return `  ${JSON.stringify(k)}: ${open}\n${lines.join(",\n")}\n  ${close}`;
    }),
  ];
  writeFileSync(file, `{\n${parts.join(",\n")}\n}\n`);
}

/**
 * DR's dungeons (Dungeons.py:16-29, make_dungeon's first argument) by the
 * pack's dungeon ids. Agahnims Tower is the pack's Castle Tower; the
 * sewers are Hyrule Castle's regions in DR as in the pack.
 */
const DUNGEON_IDS = {
  "Agahnims Tower": "castle-tower",
  "Desert Palace": "desert-palace",
  "Eastern Palace": "eastern-palace",
  "Ganons Tower": "ganons-tower",
  "Hyrule Castle": "hyrule-castle",
  "Ice Palace": "ice-palace",
  "Misery Mire": "misery-mire",
  "Palace of Darkness": "palace-of-darkness",
  "Skull Woods": "skull-woods",
  "Swamp Palace": "swamp-palace",
  "Thieves Town": "thieves-town",
  "Tower of Hera": "tower-of-hera",
  "Turtle Rock": "turtle-rock",
};

/** The base patch's tables hold a 16-bit word a room (sram.asm:390-391). */
const BITS_PER_ROOM = 16;
/** Rooms $000-$127 (sram.asm:390-391: 592 bytes, a word each). */
const ROOMS = 0x128;
/** PurchaseCounts' bytes (sram.asm:392). */
const PURCHASES = 96;

/**
 * @typedef {import("./python.mjs").Expr} Expr
 * @typedef {{ memory: "pot" | "drop", room: number, bit: number } | { memory: "purchase", index: number }} Flag
 * @typedef {{ name: string, kind: "keyDrop" | "pot" | "enemyDrop" | "shop" | "takeAny", region: string, flag: Flag, pot?: { content: string, block: boolean }, enemy?: string, key?: "small" | "big", bossRoom?: boolean, takeAny?: { sram: number }, source: string }} Entry
 */

/**
 * Stops the import.
 * @param {string} what
 * @returns {never}
 */
function fail(what) {
  throw new Error(what);
}

/**
 * A dict literal whose values are expressions (calls, attributes):
 * `name = { key: value, ... }`, each entry with its line.
 * @param {string} source
 * @param {string} name
 * @param {string} file
 */
function dictOf(source, name, file) {
  const match = new RegExp(`^${name} = \\{`, "m").exec(source);
  if (match === null) fail(`${file}: no ${name} = {`);
  const stream = tokens(source, match.index + match[0].length, file);
  /** @type {{ key: import("./python.mjs").Literal, value: Expr, line: number }[]} */
  const entries = [];
  while (stream.peek().value !== "}") {
    const line = stream.peek().line;
    const key = literal(stream);
    if (stream.next().value !== ":") stream.fail("expected :");
    entries.push({ key, line, value: expression(stream) });
    if (stream.peek().value === ",") stream.next();
  }
  return entries;
}

/** The line of `index` in `source`. @param {string} source @param {number} index */
const lineAt = (source, index) => source.slice(0, index).split("\n").length;

/**
 * Every region Regions.py creates, with its type (Regions.py:1072-1093:
 * create_cave_region is RegionType.Cave, create_dungeon_region Dungeon, the
 * lw/dw ones the overworld).
 * @param {string} source
 */
function regionKinds(source) {
  /** @type {Map<string, string>} */
  const kinds = new Map();
  const pattern =
    /create_(dungeon|cave|lw|dw|menu)_region\(player, (?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/g;
  for (const m of source.matchAll(pattern)) {
    const name = (m[2] ?? m[3]).replace(/\\'/g, "'");
    if (kinds.has(name)) fail(`Regions.py: region ${name} twice`);
    kinds.set(name, m[1]);
  }
  return kinds;
}

/**
 * Each DR region in a dungeon, by the pack's dungeon id: make_dungeon's
 * regions list (Dungeons.py:16-29, the lists from line 48 on).
 * @param {string} source
 */
function dungeonOfRegion(source) {
  /** @type {Map<string, string>} */
  const of = new Map();
  for (const m of source.matchAll(
    /make_dungeon\('([^']+)', \d+, [^,]+, (\w+),/g,
  )) {
    const id = DUNGEON_IDS[/** @type {keyof typeof DUNGEON_IDS} */ (m[1])];
    if (id === undefined) fail(`Dungeons.py: unknown dungeon ${m[1]}`);
    const regions = assigned(source, m[2], "Dungeons.py").value;
    if (!Array.isArray(regions)) fail(`Dungeons.py: ${m[2]} is no list`);
    for (const region of regions) of.set(String(region), id);
  }
  if (new Set(of.values()).size !== 13) fail("Dungeons.py: not 13 dungeons");
  return of;
}

/** @param {string} checkout */
export function importDr(checkout) {
  const read = (/** @type {string} */ file) =>
    readFileSync(join(checkout, file), "utf8");
  const POTS = "PotShuffle.py";
  const ENEMIES = "source/dungeon/EnemyList.py";
  const REGIONS = "Regions.py";
  const pots = read(POTS);
  const enemies = read(ENEMIES);
  const regions = read(REGIONS);
  const kinds = regionKinds(regions);
  const dungeons = dungeonOfRegion(read("Dungeons.py"));
  const version = /^version_number = '([^']+)'/m.exec(read("Main.py"))?.[1];
  if (version !== DR_VERSION)
    fail(`Main.py: version ${version}, not ${DR_VERSION}`);

  /** @type {Map<string, { cave: boolean, dungeon: string | null }>} */
  const regionsOut = new Map();
  /** Where a region lies: its dungeon, and whether it is a cave. @param {string} region @param {string} where */
  const place = (region, where) => {
    const kind = kinds.get(region) ?? fail(`${where}: no region ${region}`);
    const dungeon = dungeons.get(region) ?? null;
    if ((kind === "dungeon") !== (dungeon !== null))
      fail(`${where}: region ${region} is ${kind} but in dungeon ${dungeon}`);
    regionsOut.set(region, { cave: kind === "cave", dungeon });
    return { region };
  };

  // ---- Pots: vanilla_pots, a list of Pot(x, y, item, room, flags) a
  // supertile (PotShuffle.py:24), BaseClasses.py:3049 for the arguments.
  /** @type {Map<number, { content: string, region: string, block: boolean, line: number }[]>} */
  const potsByRoom = new Map();
  for (const { key, value, line } of dictOf(pots, "vanilla_pots", POTS)) {
    if (typeof key !== "number" || value.t !== "seq")
      fail(`${POTS}:${line}: a supertile's list of pots`);
    const list = [];
    for (const call of value.items) {
      if (call.t !== "call" || call.fn.t !== "name" || call.fn.name !== "Pot")
        fail(`${POTS}:${line}: a Pot(…)`);
      // The RoomObject (keyword obj) is the ROM's bytes: never read
      const flags = call.args[4] ?? call.keywords.flags;
      const flag = flags === undefined ? "Normal" : member(flags, "PotFlags");
      list.push({
        block: flag === "Block",
        content: member(call.args[2], "PotItem"),
        line,
        region: String(constant(call.args[3])),
      });
    }
    if (list.length > BITS_PER_ROOM)
      fail(`${POTS}:${line}: ${list.length} pots, more than a word's bits`);
    potsByRoom.set(key, list);
  }

  const { dropFlag, nameOfKind, spritesByRoom } = readSprites(enemies);
  /** A sprite's slot: its index less the overlords before it (EnemyList.py:2133-2139). @param {number} room @param {number} index */
  const slotOf = (room, index) => {
    const list =
      spritesByRoom.get(room) ?? fail(`${ENEMIES}: no sprites in ${room}`);
    if (list[index].overlord)
      fail(`${ENEMIES}: sprite ${index} of ${room} is an overlord`);
    const slot = list.slice(0, index).filter((s) => !s.overlord).length;
    if (slot >= BITS_PER_ROOM)
      fail(`${ENEMIES}: slot ${slot} of ${room} past a word's bits`);
    return slot;
  };
  // Rooms a shuffled boss rewrites the sprites of before locations are made
  // (Bossmizer.py:126-142, boss_room_remove_data at 208-211), and Thieves'
  // Town's basement, whose maiden a moved Blind deletes (Bossmizer.py:181-184)
  const bossRooms = new Set(
    Object.keys(
      /** @type {Record<string, unknown>} */ (
        assigned(
          read("source/enemizer/Bossmizer.py"),
          "boss_room_remove_data",
          "Bossmizer.py",
        ).value
      ),
    )
      .map(Number)
      .concat([0x45]),
  );

  /** @type {Entry[]} */
  const out = [];

  // ---- Key drops (PotShuffle.py:1001-1035): a 'Drop' is (address, room,
  // sprite index), a 'Pot' the room whose first Key pot holds it
  // (Regions.py:1168-1185); the item it replaces is datum[3].
  const keyData = assigned(pots, "key_drop_data", POTS).value;
  if (typeof keyData !== "object" || keyData === null || Array.isArray(keyData))
    fail(`${POTS}: key_drop_data is no dict`);
  const keyStart = pots.indexOf("\nkey_drop_data = {");
  for (const [name, datum] of Object.entries(keyData)) {
    if (!Array.isArray(datum)) fail(`${POTS}: ${name}`);
    const at = pots.indexOf(JSON.stringify(name).slice(1, -1), keyStart);
    const line = lineAt(pots, at === -1 ? keyStart : at);
    const item = String(datum[3]);
    const key = item.startsWith("Big Key")
      ? "big"
      : item.startsWith("Small Key")
        ? "small"
        : fail(`${POTS}:${line}: ${item}`);
    if (datum[0] === "Drop") {
      const [, room, index] = /** @type {number[]} */ (datum[1]);
      const sprite =
        spritesByRoom.get(room)?.[index] ?? fail(`${POTS}:${line}: no sprite`);
      if (!sprite.keyDrop || sprite.region === null)
        fail(`${POTS}:${line}: sprite ${index} of ${room} is no key drop`);
      out.push({
        ...place(sprite.region, `${POTS}:${line}`),
        enemy: String(
          /** @type {Record<string, unknown>} */ (nameOfKind)[sprite.kind],
        ),
        flag: { bit: slotOf(room, index), memory: "drop", room },
        key,
        kind: "keyDrop",
        name,
        source: `${POTS}:${line}`,
      });
    } else if (datum[0] === "Pot") {
      const room = Number(datum[1]);
      const list = potsByRoom.get(room) ?? fail(`${POTS}:${line}: no pots`);
      const bit = list.findIndex((pot) => pot.content === "Key");
      if (bit === -1) fail(`${POTS}:${line}: no Key pot in ${room}`);
      out.push({
        ...place(list[bit].region, `${POTS}:${line}`),
        flag: { bit, memory: "pot", room },
        key,
        kind: "keyDrop",
        name,
        pot: { block: list[bit].block, content: "Key" },
        source: `${POTS}:${line}`,
      });
    } else fail(`${POTS}:${line}: ${datum[0]}`);
  }
  // Each key drop sits where Regions.py lists it (_create_region's
  // locations, Regions.py:1104-1107): the sprite's or the pot's region
  for (const entry of out) {
    const quoted = [`'${entry.name.replace(/'/g, "\\'")}'`, `"${entry.name}"`];
    const at = quoted
      .map((q) => regions.indexOf(q))
      .find((index) => index !== -1);
    if (at === undefined) fail(`${REGIONS}: ${entry.name} in no region`);
    // The last region created before the name: a call may span lines
    const before = [
      ...regions
        .slice(0, at)
        .matchAll(
          /create_\w+_region\(player, (?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/g,
        ),
    ];
    const listed = before.at(-1);
    const region = (listed?.[1] ?? listed?.[2] ?? "").replace(/\\'/g, "'");
    if (region !== entry.region)
      fail(`${entry.name}: in ${entry.region}, Regions.py lists ${region}`);
  }

  // ---- Pots (Regions.py:1249-1272, create_pot_location): every pot but a
  // Key (a key drop's) or a Hole, named after its region, "Large Block" for
  // a block, else "Pot #<index + 1>"; a Switch pot only with potshuffle,
  // which locations.ts decides.
  for (const [room, list] of [...potsByRoom].sort(([a], [b]) => a - b)) {
    list.forEach((pot, index) => {
      if (pot.content === "Key" || pot.content === "Hole") return;
      out.push({
        ...place(pot.region, `${POTS}:${pot.line}`),
        flag: { bit: index, memory: "pot", room },
        kind: "pot",
        name: `${pot.region} ${pot.block ? "Large Block" : `Pot #${index + 1}`}`,
        pot: { block: pot.block, content: pot.content },
        source: `${POTS}:${pot.line}`,
      });
    });
  }

  // ---- Enemy drops (EnemyList.py:2248-2276): the underworld drop shuffle's
  // sprites with vanilla kinds, never an overlord, a key drop's sprite or
  // one that never drops; the kind's stats drop, and an embedded sprite only
  // when fixed. Named "<region> Enemy #<index + 1>", the index among all the
  // room's sprites.
  for (const [room, list] of [...spritesByRoom].sort(([a], [b]) => a - b)) {
    list.forEach((sprite, index) => {
      if (sprite.overlord || sprite.keyDrop || sprite.neverDrop) return;
      const drops = dropFlag.get(sprite.kind);
      if (drops === undefined)
        fail(`${ENEMIES}:${sprite.line}: no stats for sprite ${sprite.kind}`);
      if (!drops || (sprite.embed && !sprite.fix)) return;
      if (sprite.region === null)
        fail(`${ENEMIES}:${sprite.line}: a drop without a region`);
      out.push({
        ...place(sprite.region, `${ENEMIES}:${sprite.line}`),
        ...(bossRooms.has(room) ? { bossRoom: true } : {}),
        enemy: String(
          /** @type {Record<string, unknown>} */ (nameOfKind)[sprite.kind],
        ),
        flag: { bit: slotOf(room, index), memory: "drop", room },
        kind: "enemyDrop",
        name: `${sprite.region} Enemy #${index + 1}`,
        source: `${ENEMIES}:${sprite.line}`,
      });
    });
  }

  // ---- Shops (Regions.py:1279-1309): each shopsanity location's purchase
  // count, at its shop's sram index (shop_table's last field) plus its slot
  // (shopkeeper.asm:463-480 of the base patch).
  /** @type {Map<string, number>} */
  const sram = new Map();
  for (const { key, value, line } of dictOf(regions, "shop_table", REGIONS)) {
    if (value.t !== "seq") fail(`${REGIONS}:${line}: a shop's tuple`);
    sram.set(String(key), Number(constant(value.items.at(-1))));
  }
  const shopStart = regions.indexOf("\nshop_to_location_table = {");
  const shops = assigned(regions, "shop_to_location_table", REGIONS).value;
  for (const [shop, names] of Object.entries(
    /** @type {Record<string, unknown>} */ (shops),
  )) {
    const line = lineAt(regions, regions.indexOf(`'${shop}':`, shopStart));
    const base =
      sram.get(shop) ?? fail(`${REGIONS}:${line}: no sram for ${shop}`);
    /** @type {string[]} */ (names).forEach((name, slot) => {
      out.push({
        ...place(shop, `${REGIONS}:${line}`),
        flag: { index: base + slot, memory: "purchase" },
        kind: "shop",
        name,
        source: `${REGIONS}:${line}`,
      });
    });
  }

  // ---- Take-any caves (Regions.py:1311-1317; ItemList.py builds them):
  // the old man's sword cave at sram 32, the four take-anys at 33 + 2n
  // (ItemList.py:546, 573), each item at its slot. Their caves are chosen
  // per seed: no region of Regions.py.
  const items = read("ItemList.py");
  const oldMan = /Shop\(old_man_take_any, [^)]*, (\d+)\)/.exec(items);
  const takeAny = /Shop\(take_any, [^)]*, (\d+) \+ num\*(\d+)\)/.exec(items);
  if (oldMan === null || takeAny === null)
    fail("ItemList.py: no take-any shops");
  const retroStart = regions.indexOf("\nretro_shops = {");
  const retro = assigned(regions, "retro_shops", REGIONS).value;
  for (const [shop, names] of Object.entries(
    /** @type {Record<string, unknown>} */ (retro),
  )) {
    const line = lineAt(regions, regions.indexOf(`'${shop}':`, retroStart));
    const n = /^Take-Any #(\d+)$/.exec(shop);
    const base =
      shop === "Old Man Sword Cave"
        ? Number(oldMan[1])
        : n !== null
          ? Number(takeAny[1]) + (Number(n[1]) - 1) * Number(takeAny[2])
          : fail(`${REGIONS}:${line}: ${shop}`);
    /** @type {string[]} */ (names).forEach((name, slot) => {
      regionsOut.set(shop, { cave: true, dungeon: null });
      out.push({
        flag: { index: base + slot, memory: "purchase" },
        kind: "takeAny",
        name,
        region: shop,
        source: `${REGIONS}:${line}`,
        takeAny: { sram: base },
      });
    });
  }

  // Each name once; each flag within its table and once
  const names = new Set();
  const flags = new Set();
  for (const entry of out) {
    if (names.has(entry.name)) fail(`two locations named ${entry.name}`);
    names.add(entry.name);
    const { flag } = entry;
    const at =
      flag.memory === "purchase"
        ? `p${flag.index}`
        : `${flag.memory}${flag.room}.${flag.bit}`;
    if (flags.has(at)) fail(`two locations on flag ${at} (${entry.name})`);
    flags.add(at);
    if (
      flag.memory === "purchase" ? flag.index >= PURCHASES : flag.room >= ROOMS
    )
      fail(`${entry.name}: flag past its table`);
  }
  return {
    locations: out,
    regions: Object.fromEntries(
      [...regionsOut].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  };
}

/** @param {string[]} args */
function main(args) {
  const [checkout] = args;
  if (checkout === undefined) fail("usage: import-dr.mjs <dr-checkout>");
  const { locations, regions } = importDr(checkout);
  const upstream = {
    commit: readCommit(checkout),
    license: "MIT, Copyright (c) 2019 aerinon",
    repo: DR_REPO,
    version: DR_VERSION,
  };
  // A location a line: some 1,600 of them, which the app may load
  const lines = (/** @type {unknown[]} */ list) =>
    list.map((entry) => `    ${JSON.stringify(entry)}`).join(",\n");
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    `{\n  "upstream": ${JSON.stringify(upstream)},\n  "regions": ${JSON.stringify(regions)},\n  "locations": [\n${lines(locations)}\n  ]\n}\n`,
  );
  const count = /** @type {Record<string, number>} */ ({});
  for (const l of locations) count[l.kind] = (count[l.kind] ?? 0) + 1;
  process.stdout.write(`${OUT}: ${JSON.stringify(count)}\n`);

  // Stage A: the world's data
  const read = (/** @type {string} */ file) =>
    readFileSync(join(checkout, file), "utf8");
  const world = importDrWorld(read);
  const generated =
    "By packs/alttpr/scripts/import-dr.mjs from the Door Randomizer. Re-import, never edit.";
  mkdirSync(WORLD, { recursive: true });
  writeLines(
    join(WORLD, "regions.json"),
    { generated, upstream },
    { dungeons: world.dungeons, regions: world.regions },
  );
  writeLines(
    join(WORLD, "doors.json"),
    { generated, upstream },
    { doors: world.doors, portals: world.portals },
  );
  writeLines(
    join(WORLD, "connections.json"),
    { generated, upstream },
    Object.fromEntries(
      Object.entries(world.connections).map(([file, tables]) => [file, tables]),
    ),
  );
  process.stdout.write(
    `${WORLD}: ${world.regions.length} regions, ${world.doors.length} doors, ${world.portals.length} portals\n`,
  );

  // Stage B: the rules
  const {
    bombShop,
    bunny,
    crystal,
    doorsOpen,
    fill,
    negatedEvents,
    newItems,
    uncalledMethods,
    unported,
    ...tables
  } = importDrRules(read, world, locations);
  writeLines(
    join(WORLD, "rules.json"),
    {
      bombShop,
      bunny,
      doorsOpen,
      fill,
      generated,
      negatedEvents,
      newItems,
      staticKeyLogic: importStaticKeyLogic(read),
      uncalledMethods,
      upstream,
    },
    { ...tables, crystal, unported },
  );
  // Stage C: DR's own tests, with the harness upstream restored them by
  const pack = resolve(HERE, "..");
  const manifest = JSON.parse(
    readFileSync(join(pack, "upstream.json"), "utf8"),
  );
  const harnessCommit = manifest.doorRandomizer.testHarness.commit;
  /** @param {string} dir @param {RegExp} pattern */
  const filesIn = (dir, pattern) =>
    readdirSync(join(checkout, dir), { recursive: true })
      .map(String)
      .filter((name) => pattern.test(name))
      .sort();
  const tests = importDrTests(
    read,
    (file) => harnessFile(checkout, harnessCommit, file),
    harnessCommit,
    {
      suite: filesIn("test/suite", /\.yaml$/),
      tests: Object.fromEntries(
        Object.entries(SUITES).map(([suite, base]) => [
          suite,
          filesIn(`test/${suite}`, /^Test\w+\.py$/).filter(
            (name) => name !== `${base}.py`,
          ),
        ]),
      ),
    },
  );
  const harnessUpstream = {
    ...upstream,
    harness: {
      branch: manifest.doorRandomizer.testHarness.branch,
      commit: harnessCommit,
    },
  };
  const out = join(pack, "test/dr-upstream");
  /** @type {[string, unknown][]} */
  const fixtures = [
    ...tests.fixtures.map(
      (fixture) =>
        /** @type {[string, unknown]} */ ([
          join(out, fixture.suite, `${basename(fixture.file, ".py")}.json`),
          { generated, upstream: harnessUpstream, ...fixture },
        ]),
    ),
    [
      join(out, "pool.json"),
      { generated, upstream: harnessUpstream, ...tests.pool },
    ],
    [
      join(out, "vanilla-key-logic.json"),
      { generated, upstream, ...tests.vanillaKeyLogic },
    ],
    [
      join(out, "static-key-logic.json"),
      { generated, upstream, ...tests.staticKeyLogic },
    ],
    ...tests.suite.map(
      (seed) =>
        /** @type {[string, unknown]} */ ([
          join(
            out,
            "suite",
            seed.file.replace(/^test\/suite\//, "").replace(/\.yaml$/, ".json"),
          ),
          { generated, upstream, ...seed },
        ]),
    ),
  ];
  for (const [file, data] of fixtures) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
  }
  // As the repository checks them: keys sorted, Biome's format
  execFileSync(join(pack, "../../node_modules/.bin/biome"), [
    "check",
    "--write",
    ...fixtures.map(([file]) => file),
  ]);
  process.stdout.write(
    `tests: ${tests.fixtures.length} files, ${tests.fixtures.reduce((n, f) => n + f.tests.reduce((m, t) => m + /** @type {unknown[]} */ (t.cases).length, 0), 0)} cases; ${tests.suite.length} suite seeds\n`,
  );
  process.stdout.write(
    `rules: ${Object.keys(tables.entrances).length} entrances, ${Object.keys(tables.locations).length} locations, ${Object.keys(tables.helpers).length} helpers, ${unported.length} unported\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}

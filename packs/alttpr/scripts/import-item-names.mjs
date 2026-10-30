#!/usr/bin/env node
/// <reference types="node" />
// Imports the item names a spoiler log is written in.
//
//   node scripts/import-item-names.mjs --vt <vt-checkout> --er <er-checkout> \
//     --dr <door-randomizer-checkout>
//
// The checkouts are untrusted data: this script only reads their files, and
// never runs PHP, Python or anything else from them.
//
// alttpr.com writes two spoiler shapes (src/spoiler/README section of the
// pack's README). vt's own names an item by its class (`ProgressiveSword`),
// which the pack already keys on; the entrance randomizer's names it in
// English (`Progressive Sword`, `Small Key (Palace of Darkness)`), and the
// two programs share nothing but the code the ROM stores each item under.
// So the join is that code:
//
//   - vt's app/Item.php gives each class its code (`new Item('Hookshot',
//     [0x0A], …)`; a pendant or crystal carries a list: its sprite and
//     palette bytes, with vt's leading item code on a pendant);
//   - the entrance randomizer's Items.py `item_table` gives each English
//     name its code, or none for an event (`Beat Agahnim 1`), which has no
//     item of vt's to map to.
//
// What comes out, in src/spoiler/:
//   item-names.json  vt class -> its English name (resources/lang/en/item.php),
//                    for display and for the starting items by name;
//   er-items.json    the entrance randomizer's name -> vt class, or null for
//                    an event;
//   dr-items.json    the Door Randomizer's name -> vt class, or null for an
//                    event, and apart the names no vt item has (the Small
//                    Magic, Fairy or Bee Trap its pots and enemies drop),
//                    which a log shows by name. Its Items.py is the entrance
//                    randomizer's with a price after the code and a dungeon
//                    byte after a prize's sprite bytes (DR 1.5.8 Items.py:23).
// The output is deterministic; the repository's Biome then sorts its keys and
// formats it, as the checks want it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ENGLISH_NAMES_FILE,
  ITEMS_FILE,
  importItems,
  readCommit,
  tokenize,
} from "./import-upstream-tests.mjs";
import { assigned } from "./python.mjs";

export const VT_REPO = "sporchia/alttp_vt_randomizer";
export const ER_REPO = "cassidoxa/ALttPEntranceRandomizer";
export const ER_ITEMS_FILE = "Items.py";
export const DR_REPO = "aerinon/ALttPDoorRandomizer";
export const DR_ITEMS_FILE = "Items.py";

const GENERATED =
  "By packs/alttpr/scripts/import-item-names.mjs from the upstream item tables. Re-import, never edit.";

/**
 * The key two programs' codes for one item share. A single code is its
 * number; the list of a pendant or a crystal is its six bytes, without the
 * leading item code vt gives a pendant (`[0x37, 0x04, …]`) or the null it
 * gives a crystal (`[null, 0x02, …]`), and without the last byte: a pendant's
 * is the prize's item code, which the two programs number differently
 * (vt's Power is 0x39, the entrance randomizer's Red Pendant 0x38). The five
 * bytes before it (the bit the game sets, the palette, the sprite) tell the
 * ten prizes apart.
 *
 * @param {unknown} code - A number, or a list of numbers (and a null)
 * @returns {string | undefined}
 */
export function codeKey(code) {
  if (typeof code === "number") return String(code);
  if (!Array.isArray(code) || code.length === 0) return undefined;
  if (!code.every((byte) => typeof byte === "number" || byte === null)) {
    return undefined;
  }
  return code.length === 1
    ? String(code[0])
    : /** @type {unknown[]} */ (code)
        .slice(code.length - 6, code.length - 1)
        .join(",");
}

/**
 * Each item class of app/Item.php and the key of its code. A class whose
 * array is keyed (the medallions' texture bytes) is keyed by its first value.
 *
 * @param {string} itemSource app/Item.php
 * @returns {Map<string, string>}
 */
export function vtCodes(itemSource) {
  const tokens = tokenize(itemSource);
  /** @type {Map<string, string>} */
  const codes = new Map();
  for (let i = 2; i + 3 < tokens.length; i++) {
    const [name, comma, open] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    if (name?.type !== "string" || comma?.value !== "," || open?.value !== "[")
      continue;
    // `new Item\Sword(` or `new Item(`: a string after a `(` after a class
    if (tokens[i - 1]?.value !== "(" || tokens[i - 2]?.type !== "ident")
      continue;
    // The leading positional bytes: a medallion's array goes on with keyed
    // texture entries, which are no part of the code
    /** @type {(number | null)[]} */
    const bytes = [];
    for (let j = i + 3; ; j += 2) {
      const token = tokens[j];
      if (token?.type === "number") bytes.push(Number(token.value));
      else if (token?.type === "ident" && token.value === "null")
        bytes.push(null);
      else break;
      if (tokens[j + 1]?.value !== ",") break;
    }
    // A pendant or crystal: six sprite bytes (and vt's item code or null)
    const key = bytes.length >= 6 ? codeKey(bytes) : codeKey(bytes[0]);
    // An event (`[null]`) is no item in the ROM: no other program names it
    if (bytes.length === 1 && bytes[0] === null) continue;
    if (key === undefined) {
      throw new Error(`${ITEMS_FILE}:${name.line}: no code for ${name.value}`);
    }
    codes.set(String(name.value), key);
  }
  return codes;
}

/**
 * The entrance randomizer's items and the key of their codes: null for an
 * event, which has none.
 *
 * @param {string} source Items.py
 * @returns {Map<string, string | null>}
 */
export function erCodes(source) {
  const { value } = assigned(source, "item_table", ER_ITEMS_FILE);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${ER_ITEMS_FILE}: item_table is not a dict`);
  }
  /** @type {Map<string, string | null>} */
  const items = new Map();
  for (const [name, row] of Object.entries(value)) {
    if (!Array.isArray(row)) {
      throw new Error(`${ER_ITEMS_FILE}: ${name} is not a tuple`);
    }
    // (advancement, priority, type, code, …)
    const code = row[3];
    items.set(name, code === null ? null : (codeKey(code) ?? null));
  }
  return items;
}

/**
 * The entrance randomizer's name of each item -> vt's class, joined on the
 * ROM code. Throws when two classes share a code that an English name needs,
 * or a code has no class: the importer cannot guess which.
 *
 * @param {Map<string, string>} vt
 * @param {Map<string, string | null>} er
 * @returns {Record<string, string | null>}
 */
export function joinOnCode(vt, er) {
  /** @type {Map<string, string[]>} */
  const byCode = new Map();
  for (const [name, key] of vt) {
    byCode.set(key, [...(byCode.get(key) ?? []), name]);
  }
  /** @type {Record<string, string | null>} */
  const joined = {};
  for (const [name, key] of er) {
    if (key === null) {
      joined[name] = null;
      continue;
    }
    const classes = byCode.get(key) ?? [];
    if (classes.length !== 1) {
      throw new Error(
        `${ER_ITEMS_FILE}: "${name}" (code ${key}) matches ${
          classes.length === 0 ? "no vt item" : classes.join(", ")
        }`,
      );
    }
    joined[name] = /** @type {string} */ (classes[0]);
  }
  return joined;
}

/**
 * The Door Randomizer's items and the key of their codes: null for an event
 * (type `Event`, code 999). A prize's list ends with the dungeon byte DR
 * adds (`Green Pendant`: `[0x04, 0x38, 0x62, 0x00, 0x69, 0x37, 0x08]`), which
 * is dropped so the five sprite bytes before the prize's own code are the
 * key, as for the entrance randomizer's six.
 *
 * @param {string} source DR's Items.py
 * @returns {Map<string, string | null>}
 */
export function drCodes(source) {
  const { value } = assigned(source, "item_table", DR_ITEMS_FILE);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${DR_ITEMS_FILE}: item_table is not a dict`);
  }
  /** @type {Map<string, string | null>} */
  const items = new Map();
  for (const [name, row] of Object.entries(value)) {
    if (!Array.isArray(row)) {
      throw new Error(`${DR_ITEMS_FILE}: ${name} is not a tuple`);
    }
    // (advancement, priority, type, code, price, …)
    const [, , type, code] = row;
    if (type === "Event") {
      items.set(name, null);
      continue;
    }
    const key = codeKey(
      Array.isArray(code) && code.length === 7 ? code.slice(0, 6) : code,
    );
    if (key === undefined) {
      throw new Error(`${DR_ITEMS_FILE}: no code for ${name}`);
    }
    items.set(name, key);
  }
  return items;
}

/**
 * The Door Randomizer's name of each item -> vt's class, joined on the ROM
 * code as `joinOnCode` does, with two differences: an item whose code no vt
 * class has is listed apart (`unmatched`: DR's own pickups, Big Magic,
 * Fairy, Bee Trap…), and where two of DR's names share one code (`Nothing`
 * and `Arrows (5)`, 0x5A) only the name vt's English table gives that class
 * keeps it, the others going to `unmatched`. Throws when a code matches two
 * vt classes: the importer cannot guess which.
 *
 * @param {Map<string, string>} vt
 * @param {Record<string, string>} english vt class -> English name
 * @param {Map<string, string | null>} dr
 * @returns {{ items: Record<string, string | null>, unmatched: string[] }}
 */
export function joinDr(vt, english, dr) {
  /** @type {Map<string, string[]>} */
  const byCode = new Map();
  for (const [name, key] of vt) {
    byCode.set(key, [...(byCode.get(key) ?? []), name]);
  }
  /** @type {Map<string, string[]>} */
  const namesOfCode = new Map();
  for (const [name, key] of dr) {
    if (key !== null) {
      namesOfCode.set(key, [...(namesOfCode.get(key) ?? []), name]);
    }
  }
  /** @type {Record<string, string | null>} */
  const items = {};
  /** @type {string[]} */
  const unmatched = [];
  for (const [name, key] of dr) {
    if (key === null) {
      items[name] = null;
      continue;
    }
    const classes = byCode.get(key) ?? [];
    if (classes.length > 1) {
      throw new Error(
        `${DR_ITEMS_FILE}: "${name}" (code ${key}) matches ${classes.join(", ")}`,
      );
    }
    const itemClass = classes[0];
    const sharing = namesOfCode.get(key) ?? [];
    if (
      itemClass === undefined ||
      (sharing.length > 1 && english[itemClass] !== name)
    ) {
      unmatched.push(name);
      continue;
    }
    items[name] = itemClass;
  }
  return { items, unmatched: unmatched.sort() };
}

/**
 * @param {string} vtCheckout
 * @param {string} erCheckout
 * @param {string} drCheckout
 */
export function importItemNames(vtCheckout, erCheckout, drCheckout) {
  /** @param {string} file */
  const vt = (file) => readFileSync(join(vtCheckout, file), "utf8");
  const upstream = {
    er: { commit: readCommit(erCheckout), repo: ER_REPO },
    vt: { commit: readCommit(vtCheckout), repo: VT_REPO },
  };
  const itemSource = vt(ITEMS_FILE);
  const { english } = importItems(
    itemSource,
    vt(ENGLISH_NAMES_FILE),
    /** @type {never} */ ({}),
  );
  const erItems = joinOnCode(
    vtCodes(itemSource),
    erCodes(readFileSync(join(erCheckout, ER_ITEMS_FILE), "utf8")),
  );
  const drItems = joinDr(
    vtCodes(itemSource),
    english,
    drCodes(readFileSync(join(drCheckout, DR_ITEMS_FILE), "utf8")),
  );
  return {
    drItems: {
      files: [`${DR_REPO}: ${DR_ITEMS_FILE}`, `${VT_REPO}: ${ITEMS_FILE}`],
      generated: GENERATED,
      items: drItems.items,
      unmatched: drItems.unmatched,
      upstream: {
        dr: { commit: readCommit(drCheckout), repo: DR_REPO },
        vt: upstream.vt,
      },
    },
    erItems: {
      files: [`${ER_REPO}: ${ER_ITEMS_FILE}`, `${VT_REPO}: ${ITEMS_FILE}`],
      generated: GENERATED,
      items: erItems,
      upstream,
    },
    itemNames: {
      files: [ITEMS_FILE, ENGLISH_NAMES_FILE],
      generated: GENERATED,
      names: english,
      upstream: upstream.vt,
    },
  };
}

/** @param {string[]} argv */
function main(argv) {
  const args = [...argv];
  /** @param {string} flag */
  const take = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args.splice(at, 2)[1];
  };
  const vt = take("--vt");
  const er = take("--er");
  const dr = take("--dr");
  if (
    vt === undefined ||
    er === undefined ||
    dr === undefined ||
    args.length > 0
  ) {
    process.stderr.write(
      "Usage: import-item-names.mjs --vt <vt-checkout> --er <er-checkout> --dr <dr-checkout>\n",
    );
    process.exit(2);
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), "../src/spoiler");
  const { drItems, erItems, itemNames } = importItemNames(
    resolve(vt),
    resolve(er),
    resolve(dr),
  );
  mkdirSync(out, { recursive: true });
  for (const [file, data] of /** @type {[string, unknown][]} */ ([
    ["item-names.json", itemNames],
    ["er-items.json", erItems],
    ["dr-items.json", drItems],
  ])) {
    writeFileSync(join(out, file), `${JSON.stringify(data, null, 2)}\n`);
    process.stdout.write(`${file} written\n`);
  }
  const events = Object.values(erItems.items).filter((v) => v === null).length;
  process.stdout.write(
    `${Object.keys(itemNames.names).length} vt names, ${
      Object.keys(erItems.items).length
    } entrance randomizer items (${events} events), ${
      Object.keys(drItems.items).length
    } Door Randomizer items and ${drItems.unmatched.length} no vt item has\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}

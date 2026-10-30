#!/usr/bin/env node
/// <reference types="node" />
// Writes the entrance-randomizer seeds of test/er-seeds/ from real seeds.
//
//   node scripts/record-er-seeds.mjs [<hash>…]
//
// A seed's file on alttpr.com's S3 (see spoiler-fixtures.mjs) holds its
// `spoiler`: the shuffled `Entrances`, the item at every location, the
// playthrough's spheres. Each recording keeps that spoiler whole and nothing
// of the seed's patch: `test/er-seeds/<hash>.json` is
// `{ generated, hash, spoiler }`, `generated` saying how the file was made.
// `src/er-seeds.spec.ts` holds the entrance randomizer's world to each
// recording's spheres. A seed whose spoiler has no `Entrances` is refused (the
// vt layout is `spoiler-fixtures.mjs`'s); one whose meta carries free text is
// too.
//
// With no hash, every seed of `test/er-seeds/index.json` is recorded again.
// The index keeps where each came from: the address, when it was recorded,
// the file's own `generated` time, its size and SHA-256 and what its meta says
// of the seed's settings. Never edit a recording or the index by hand.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fetchSeedFile,
  HASH,
  readIndex,
  recordOf,
  spoilerOf,
  writeIndex,
} from "./spoiler-fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../test/er-seeds");

const GENERATED =
  "By packs/alttpr/scripts/record-er-seeds.mjs from the seed's file on alttpr.com (its spoiler, the patch left out). Record again, never edit.";

/** The settings of a seed the index states, as its meta spells them. */
const SETTINGS = [
  "mode",
  "shuffle",
  "dungeon_items",
  "enemizer.boss_shuffle",
  "item_pool",
  "item_functionality",
  "weapons",
  "goal",
  "logic",
  "entry_crystals_ganon",
  "entry_crystals_tower",
  "spoilers",
  "tournament",
];

/**
 * A recording of a seed's S3 file: its bytes, and its record.
 *
 * @param {string} hash
 * @param {unknown} file - The S3 file, parsed
 * @param {string} recorded - An ISO time
 */
export function recordingOf(hash, file, recorded) {
  const spoiler = spoilerOf(hash, file);
  if (!Array.isArray(spoiler.Entrances)) {
    throw new Error(`${hash}: no Entrances; not an entrance randomizer seed`);
  }
  const text = `${JSON.stringify({ generated: GENERATED, hash, spoiler }, null, 1)}\n`;
  const record = recordOf(hash, file, text, recorded);
  return {
    record: {
      ...record,
      meta: Object.fromEntries(
        SETTINGS.map((key) => [key, spoiler.meta?.[key] ?? null]),
      ),
    },
    text,
  };
}

/** @param {string[]} given */
async function main(given) {
  mkdirSync(out, { recursive: true });
  const index = readIndex(out);
  const hashes = given.length > 0 ? given : Object.keys(index);
  if (hashes.length === 0 || !hashes.every((hash) => HASH.test(hash))) {
    process.stderr.write("Usage: record-er-seeds.mjs [<seed hash>…]\n");
    process.exit(2);
  }
  for (const hash of hashes) {
    const { record, text } = recordingOf(
      hash,
      await fetchSeedFile(hash),
      new Date().toISOString(),
    );
    writeFileSync(join(out, `${hash}.json`), text);
    index[hash] = record;
    const { mode, shuffle, dungeon_items: items } = record.meta;
    process.stdout.write(
      `${hash}.json: ${record.bytes} bytes, ${mode} ${shuffle}, ${items} dungeon items\n`,
    );
  }
  writeIndex(out, GENERATED, index);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv.slice(2));
}

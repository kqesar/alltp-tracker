#!/usr/bin/env node
/// <reference types="node" />
// Writes the spoiler-log fixtures of test/spoilers/ from real seeds.
//
//   node scripts/spoiler-fixtures.mjs <hash>…
//
// alttpr.com keeps a seed's file on S3 (seed-link.ts `seedFileUrl`, readable
// by any origin). Its `spoiler` is what the seed page's "Save Spoiler" button
// saves, as `JSON.stringify(spoiler, null, 4)` in a `.txt` (vt
// resources/js/HashLoader.vue:199-204 at 219fcafd). So each fixture is the
// bytes a player's download holds, written to `test/spoilers/<hash>.txt`;
// the seed's patch, the rest of the S3 file, is left out. They are never
// edited by hand: run this again.
//
// `test/spoilers/index.json` records where each came from: the address, when
// it was recorded, the file's own `generated` time, its size and SHA-256 and
// what its meta says of the seed. A file is refused when its meta carries
// free text a player wrote (`notes`), so nothing personal is committed; a
// `name` is shown, to be looked at.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../test/spoilers");
const HASH = /^[A-Za-z0-9]{10,20}$/;

/** Where alttpr.com keeps a seed's file (src/seed-link.ts). */
const urlOf = (/** @type {string} */ hash) =>
  `https://alttpr-patch-data.s3.us-east-2.amazonaws.com/${hash}.json`;

/**
 * The fixture of a seed's S3 file: its bytes, and its record.
 *
 * @param {string} hash
 * @param {unknown} file - The S3 file, parsed
 * @param {string} recorded - An ISO time
 */
export function fixtureOf(hash, file, recorded) {
  if (
    file === null ||
    typeof file !== "object" ||
    !("hash" in file) ||
    file.hash !== hash ||
    !("spoiler" in file) ||
    file.spoiler === null ||
    typeof file.spoiler !== "object"
  ) {
    throw new Error(`${hash}: not a seed file of that hash`);
  }
  const spoiler = /** @type {Record<string, any>} */ (file.spoiler);
  const meta = spoiler.meta ?? {};
  if (meta.notes !== undefined) {
    throw new Error(`${hash}: meta.notes is free text; not committing it`);
  }
  const text = JSON.stringify(spoiler, null, 4);
  return {
    record: {
      address: urlOf(hash),
      bytes: Buffer.byteLength(text),
      generated: "generated" in file ? file.generated : null,
      layout: Array.isArray(spoiler.Entrances) ? "entrance randomizer" : "vt",
      meta: {
        goal: meta.goal ?? null,
        logic: meta.logic ?? null,
        mode: meta.mode ?? null,
        name: meta.name ?? null,
        spoilers: meta.spoilers ?? null,
        tournament: meta.tournament ?? null,
      },
      recorded,
      sha256: createHash("sha256").update(text).digest("hex"),
    },
    text,
  };
}

/** @param {string[]} hashes */
async function main(hashes) {
  if (hashes.length === 0 || !hashes.every((hash) => HASH.test(hash))) {
    process.stderr.write("Usage: spoiler-fixtures.mjs <seed hash>…\n");
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  const indexFile = join(out, "index.json");
  /** @type {Record<string, unknown>} */
  let index = {};
  try {
    index = JSON.parse(readFileSync(indexFile, "utf8")).seeds;
  } catch {
    // The first run
  }
  for (const hash of hashes) {
    const response = await fetch(urlOf(hash));
    if (!response.ok) throw new Error(`${hash}: HTTP ${response.status}`);
    const { record, text } = fixtureOf(
      hash,
      await response.json(),
      new Date().toISOString(),
    );
    writeFileSync(join(out, `${hash}.txt`), text);
    index[hash] = record;
    process.stdout.write(
      `${hash}.txt: ${record.bytes} bytes, ${record.layout}, meta.name ${JSON.stringify(record.meta.name)}\n`,
    );
  }
  const seeds = Object.fromEntries(
    Object.entries(index).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    indexFile,
    `${JSON.stringify(
      {
        generated:
          "By packs/alttpr/scripts/spoiler-fixtures.mjs from real seeds. Record again, never edit.",
        seeds,
      },
      null,
      2,
    )}\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv.slice(2));
}

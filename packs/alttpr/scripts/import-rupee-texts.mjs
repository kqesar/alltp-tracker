#!/usr/bin/env node
/// <reference types="node" />
// Imports the dialogue lines that state a paid check's price.
//
//   node scripts/import-rupee-texts.mjs <vt-checkout>
//
// The checkout is untrusted data: this script only reads app/Text.php, and
// never runs PHP or anything else from it. Each line of the file that is
// `'key' => $converter->convertDialogCompressed("…")` is read; the keys listed
// here are the vendors' offers, whose text names the price. What comes out,
// as test/upstream/rupee-texts.json, is each key's line and text, which
// src/rupee-costs.ts is held to. The output is deterministic.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCommit } from "./import-upstream-tests.mjs";

export const TEXT_FILE = "app/Text.php";

/** The text of each paid check's offer, by its key in app/Text.php. */
export const OFFER_KEYS = [
  "blacksmiths_paywall",
  "bomb_shop_big_bomb",
  "bottle_vendor_choice",
  "game_chest_village_of_outcasts",
  "game_digging_choice",
  "zora_tells_cost",
];

const GENERATED =
  "By packs/alttpr/scripts/import-rupee-texts.mjs from app/Text.php. Re-import, never edit.";

/**
 * The offers' lines of app/Text.php.
 *
 * @param {string} source app/Text.php
 * @returns {Record<string, { line: number, text: string }>}
 */
export function offersIn(source) {
  /** @type {Record<string, { line: number, text: string }>} */
  const found = {};
  source.split("\n").forEach((row, index) => {
    const match =
      /^\s*'([a-z0-9_]+)' => \$converter->convertDialogCompressed\("(.*)"(?:, false)?\),\s*$/.exec(
        row,
      );
    if (match?.[1] === undefined || !OFFER_KEYS.includes(match[1])) return;
    found[match[1]] = {
      line: index + 1,
      text: (match[2] ?? "").replaceAll("\\n", "\n"),
    };
  });
  const missing = OFFER_KEYS.filter((key) => found[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`${TEXT_FILE}: no line for ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    Object.entries(found).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** @param {string} checkout */
export function importRupeeTexts(checkout) {
  const upstream = JSON.parse(
    readFileSync(new URL("../upstream.json", import.meta.url), "utf8"),
  );
  return {
    file: TEXT_FILE,
    generated: GENERATED,
    texts: offersIn(readFileSync(join(checkout, TEXT_FILE), "utf8")),
    upstream: {
      commit: readCommit(checkout),
      logic: upstream.logic,
      repo: upstream.repo,
    },
  };
}

/** @param {string[]} argv */
function main(argv) {
  const [checkout] = argv;
  if (checkout === undefined || argv.length > 1) {
    process.stderr.write("Usage: import-rupee-texts.mjs <vt-checkout>\n");
    process.exit(2);
  }
  const out = join(
    dirname(fileURLToPath(import.meta.url)),
    "../test/upstream/rupee-texts.json",
  );
  const fixture = importRupeeTexts(resolve(checkout));
  writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
  process.stdout.write(
    `rupee-texts.json written: ${Object.keys(fixture.texts).length} texts\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}

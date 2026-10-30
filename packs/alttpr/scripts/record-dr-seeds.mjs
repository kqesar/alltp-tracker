/// <reference types="node" />
// Records the Door Randomizer seed fixtures the settings import is held to
// (test/dr-seeds/): what avianart.games and Hyrule Town Hall serve for a few
// real race seeds, cut to what the tracker reads, so no fixture holds where
// an item is.
// - An avianart permalink's JSON keeps its `response.type` and its spoiler's
//   `meta` alone (the permalink also holds the patch and the spoiler).
// - A Hyrule Town Hall patch is written again as a reduced BPS holding only
//   the bytes the settings decoder reads (the ROM header's title and layout,
//   DR's and OWR's tables, alttpr.com's settings bytes in bank $30 and the
//   initial save's two), each a TargetRead run, every other byte a
//   SourceRead: no item, no prize, no medallion. Its checksums are zeroed: it
//   is a fixture, never a patch to apply.
// Run: pnpm --filter @alltp/pack-alttpr record-dr-seeds
// Never edit the fixtures by hand: record them again.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../test/dr-seeds");
const AGENT = "RandoAtlas fixtures (github.com/KqesaR/alltp-tracker)";

/** Race seeds of the study (2026-10-29), by what they cover. */
const AVIANART = [
  // DR 1.5.6, Standard, all dungeons, keysanity, keydrop (drops and key pots)
  "C2BdrZOiV",
  // OWR 0.7.1.4 on DR 1.5.6, swapped entrances, overworld settings vanilla
  "u6BKiwo1E",
  // DR 1.5.6, vanilla doors, crossed entrances, lottery pots, every enemy
  "uv7P2Luey",
  // OWR 0.8.0.2 on DR 1.5.7 (the release the pack's OWR world reads),
  // avianart's Swapkeys: swapped entrances, every dungeon item wild
  "4kxBlrWuP",
];
const HTH = [
  // DR156_1_1_367825107: vanilla doors, mirror scroll, Hyrule Town Hall's
  // Crosskeys 2026
  "DR_78388fdd-435c-4961-8fae-0500424d5bf5.bps",
];

/**
 * The ROM bytes the settings decoder reads (src/autotrack/seed-settings.ts,
 * SEED_SETTINGS_RANGES but the prizes' and the pads' medallions, and the
 * header), as [PC offset, size]. src/door-rando/seed-import.spec.ts holds the
 * fixtures to them.
 */
export const KEPT = [
  [0x00_7fc0, 0x20], // rom-header
  [0x13_8000, 0x20], // door-settings
  [0x14_2a50, 6], // standing-items
  [0x15_0000, 0x20], // overworld-settings
  [0x18_003f, 3], // swordless-mode
  [0x18_0045, 1], // dungeon-item-menu
  [0x18_004a, 1], // inverted-mode
  [0x18_0167, 2], // goal-items
  [0x18_0172, 1], // generic-keys
  [0x18_019a, 1], // tower-crystals
  [0x18_01a6, 1], // ganon-crystals
  [0x18_01a8, 1], // ganon-vulnerable
  [0x18_0210, 1], // seed-type
  [0x18_32db, 1], // initial-pyramid
  [0x18_33c5, 1], // initial-progress
];

/** @param {string} url */
const get = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
};

/** A BPS number. */
/** @param {Uint8Array} bytes @param {{ i: number }} at */
const readNumber = (bytes, at) => {
  let value = 0;
  let shift = 1;
  for (;;) {
    const byte = bytes[at.i++];
    value += (byte & 0x7f) * shift;
    if (byte & 0x80) return value;
    shift *= 128;
    value += shift;
  }
};

/** @param {number[]} out @param {number} value */
const writeNumber = (out, value) => {
  let left = value;
  for (;;) {
    const x = left & 0x7f;
    left = Math.floor(left / 128);
    if (left === 0) {
      out.push(x | 0x80);
      return;
    }
    out.push(x);
    left--;
  }
};

/** The bytes a patch writes whatever its source, and which are known. */
/** @param {Uint8Array} patch */
const target = (patch) => {
  const at = { i: 4 };
  readNumber(patch, at);
  const size = readNumber(patch, at);
  // Read before adding: `at.i += readNumber(…)` would add to the old index
  const metadata = readNumber(patch, at);
  at.i += metadata;
  const bytes = new Uint8Array(size);
  const known = new Uint8Array(size);
  let out = 0;
  let relative = 0;
  while (at.i < patch.length - 12) {
    const data = readNumber(patch, at);
    const length = (data >>> 2) + 1;
    const command = data & 3;
    if (command === 1) {
      bytes.set(patch.subarray(at.i, at.i + length), out);
      known.fill(1, out, out + length);
      at.i += length;
    } else if (command === 2) {
      readNumber(patch, at);
    } else if (command === 3) {
      const offset = readNumber(patch, at);
      relative += (offset & 1 ? -1 : 1) * Math.floor(offset / 2);
      for (let k = 0; k < length; k++) {
        bytes[out + k] = bytes[relative];
        known[out + k] = known[relative];
        relative++;
      }
    }
    out += length;
  }
  return { bytes, known, size };
};

/** A BPS of the kept bytes alone: SourceRead between, TargetRead on them. */
/** @param {Uint8Array} patch */
const reduced = (patch) => {
  const at = { i: 4 };
  const sourceSize = readNumber(patch, at);
  const { bytes, known, size } = target(patch);
  const out = [..."BPS1"].map((c) => c.charCodeAt(0));
  writeNumber(out, sourceSize);
  writeNumber(out, size);
  writeNumber(out, 0);
  let position = 0;
  for (const [offset, length] of KEPT) {
    if (!known.subarray(offset, offset + length).every((b) => b === 1)) {
      throw new Error(
        `The patch leaves 0x${offset.toString(16)} to its source`,
      );
    }
    if (offset > position) writeNumber(out, ((offset - position - 1) << 2) | 0);
    writeNumber(out, ((length - 1) << 2) | 1);
    out.push(...bytes.subarray(offset, offset + length));
    position = offset + length;
  }
  if (size > position) writeNumber(out, ((size - position - 1) << 2) | 0);
  out.push(...new Array(12).fill(0));
  return Uint8Array.from(out);
};

/** Fetches every seed listed and writes its fixture. */
async function main() {
  await mkdir(OUT, { recursive: true });
  const recorded = new Date().toISOString().slice(0, 10);
  for (const hash of AVIANART) {
    const url = `https://avianart.games/api.php?action=permlink&hash=${hash}`;
    const json =
      /** @type {{ response: { type: string, spoiler: { meta: unknown } } }} */ (
        await (await get(url)).json()
      );
    const fixture = {
      provenance: `${url}, ${recorded}: response.type and response.spoiler.meta kept, nothing else (scripts/record-dr-seeds.mjs)`,
      response: {
        spoiler: { meta: json.response.spoiler.meta },
        type: json.response.type,
      },
    };
    await writeFile(
      join(OUT, `avianart-${hash}.json`),
      `${JSON.stringify(fixture, null, 2)}\n`,
    );
  }
  for (const name of HTH) {
    const url = `https://hyruletownhall.com/seed/${name}`;
    const patch = new Uint8Array(await (await get(url)).arrayBuffer());
    await writeFile(join(OUT, `hth-${name}`), reduced(patch));
    await writeFile(
      join(OUT, `hth-${name}.provenance.txt`),
      `${url}, ${recorded}: the settings decoder's bytes alone, re-encoded (scripts/record-dr-seeds.mjs); checksums zeroed\n`,
    );
  }
}

// Run as a script only: the settings import's spec imports `KEPT`, and a
// test never reaches the network nor writes a fixture
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}

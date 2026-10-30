#!/usr/bin/env node
/// <reference types="node" />
// Records the Door Randomizer spoiler logs the review is held to
// (test/dr-spoilers/): DR's own text log of real seeds, cut to what the
// parser reads.
//
//   pnpm --filter @alltp/pack-alttpr record-dr-spoilers
//
// Where they come from. An avianart permalink of a race seed keeps its
// spoiler's `meta` alone (`response.spoiler` has no other key: checked on
// every DR permalink of the study, 2026-10-29), and the study's permalinks
// are all race seeds'. A spoiler race is the one whose log is public: its
// racetime.gg room's bot (SahasrahBot, "Mudora") posts it as the race starts,
// as `…/seeds/<uuid>/DR_<seed>_Spoiler_<code>.json` (its own JSON), and DR's
// own text log, the file DR writes (`DR_<seed>_Spoiler.txt`, Main.py:428-432
// at DR 1.5.6), lies in the same folder. This script reads the room's chat
// log for that address, fetches DR's text beside it and keeps:
// - the first line (version, seed) and the header's settings, but `User
//   Notes` (free text a person wrote);
// - the sections the parser reads: Requirements, Locations, Shops, Bosses and
//   Playthrough, in their order; the rest (Bottle Refills, Entrances, Drops,
//   Prize Packs, In-Game Text, Unreachable Items, Paths) is dropped.
// `index.json` says, per file, the race, the address, the day it was
// recorded, the full file's SHA-256 and the sections kept. Never edit the
// fixtures by hand: record them again.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/dr-spoilers",
);
const AGENT = "RandoAtlas fixtures (KqesaR/alltp-tracker)";

/**
 * Spoiler races (racetime.gg's alttpr category), by what they cover. All
 * are Open, vanilla doors and entrances, no enemy or boss shuffle: what
 * DR's world holds at the port's step 4; the playthrough contract
 * (test/dr-playthrough.spec.ts) reads each.
 */
export const RACES = [
  // DR 1.5.6-u, keysanity, `static` key logic (an unstable build's, DR's from 1.5.7), no DR location
  "alttpr/saucy-birdtoss-3937",
  // DR 1.5.7-u, keysanity, key drops (enemies' and pots')
  "alttpr/snug-fireshield-5696",
  // DR 1.5.7-u, keysanity (small keys wild, the rest per its header)
  "alttpr/dynamax-quake-9156",
  "alttpr/scruffy-firerod-3556",
  "alttpr/sunken-herapot-2931",
  "alttpr/obedient-mearl-4724",
  "alttpr/curious-chestgame-8935",
  // DR 1.5.7-u / 1.5.8-u, keys in their dungeons
  "alttpr/zany-boots-3890",
  "alttpr/amused-beetorp-4727",
  "alttpr/wonderful-deathmountain-8176",
  "alttpr/lazy-mushroom-6764",
  "alttpr/wonderful-lumberjack-2747",
];

/** The sections of DR's text log the parser reads (src/spoiler/dr.ts). */
export const KEPT_SECTIONS = [
  "Requirements",
  "Locations",
  "Shops",
  "Bosses",
  "Playthrough",
];

const HEADING = /^([A-Z][^:]*):$/;

/**
 * DR's text log cut to what the parser reads: the header without its free
 * text, then the kept sections, each after a blank line as DR writes them.
 * @param {string} text
 */
export function cutLog(text) {
  const lines = text.split(/\r?\n/);
  if (!/^ALttP (?:Dungeon|Overworld) Randomizer/.test(lines[0] ?? "")) {
    throw new Error("not a Door Randomizer text log");
  }
  /** @type {string[]} */
  const out = [];
  let at = 0;
  for (; at < lines.length; at++) {
    const line = lines[at] ?? "";
    if (HEADING.test(line)) break;
    if (/^User Notes:/.test(line)) continue;
    out.push(line);
  }
  /** @type {string[]} */
  const kept = [];
  let keep = false;
  for (; at < lines.length; at++) {
    const line = lines[at] ?? "";
    const heading = HEADING.exec(line)?.[1];
    if (heading !== undefined && (lines[at - 1] ?? "") === "") {
      const name = heading.startsWith("Bosses") ? "Bosses" : heading;
      keep = KEPT_SECTIONS.includes(name);
      if (keep) {
        kept.push(heading);
        if (out.at(-1) !== "") out.push("");
      }
    }
    if (keep) out.push(line);
  }
  while (out.at(-1) === "") out.pop();
  return { kept, text: `${out.join("\n")}\n` };
}

/** @param {string} url */
const get = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};

const POSTED =
  /(https:\/\/botofmudora\.s3[^\s"<]*\/seeds\/[0-9a-f-]+\/)DR_(\d+)_Spoiler_[^\s"<]*\.json/;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const recorded = new Date().toISOString().slice(0, 10);
  /** @type {Record<string, unknown>} */
  const index = {};
  for (const race of RACES) {
    const log = await get(`https://racetime.gg/${race}/log`);
    const posted = POSTED.exec(log);
    if (posted === null) throw new Error(`${race}: no spoiler log posted`);
    const name = `DR_${posted[2]}_Spoiler.txt`;
    const url = `${posted[1]}${name}`;
    const full = await get(url);
    const { kept, text } = cutLog(full);
    writeFileSync(join(OUT, name), text);
    index[name] = {
      address: url,
      kept,
      race: `https://racetime.gg/${race}`,
      recorded,
      sha256: createHash("sha256").update(full).digest("hex"),
      version: full.split("\n")[0],
    };
    process.stdout.write(`${name}: ${text.length} of ${full.length} bytes\n`);
  }
  writeFileSync(
    join(OUT, "index.json"),
    `${JSON.stringify(
      {
        generated:
          "By packs/alttpr/scripts/record-dr-spoilers.mjs from real spoiler races. Record again, never edit.",
        logs: index,
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
  await main();
}

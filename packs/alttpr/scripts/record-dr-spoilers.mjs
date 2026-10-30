#!/usr/bin/env node
/// <reference types="node" />
// Records the Door Randomizer spoiler logs the review is held to
// (test/dr-spoilers/): DR's own text log of real seeds, cut to what the
// parser reads.
//
//   pnpm --filter @alltp/pack-alttpr record-dr-spoilers [vanilla|entrances|doors|owr|owr-crossed|owr-mixed]
//
// With no argument it records both sets; with one, that set alone.
//
// Where they come from. An avianart permalink of a race seed keeps its
// spoiler's `meta` alone (`response.spoiler` has no other key: checked on
// every DR permalink of the study, 2026-10-29), and the study's permalinks
// are all race seeds'. A spoiler race is the one whose log is public: its
// racetime.gg room's bot (SahasrahBot, "Mudora") posts it as the race starts,
// as `…/seeds/<uuid>/DR_<seed>_Spoiler_<code>.json` (its own JSON), and DR's
// own text log, the file DR writes (`DR_<seed>_Spoiler.txt`, Main.py:147,
// 360-383 at DR 1.5.8), lies in the same folder. This script reads the room's chat
// log for that address, fetches DR's text beside it and keeps:
// - the first line (version, seed) and the header's settings, but `User
//   Notes` (free text a person wrote);
// - the sections the parser reads: Requirements, Locations, Shops, Bosses and
//   Playthrough, in their order; the rest (Bottle Refills, Entrances, Drops,
//   Prize Packs, In-Game Text, Unreachable Items, Paths) is dropped.
// A log whose entrances are shuffled keeps its Entrances section too, which
// the entrance contract notes (test/dr-entrance-playthrough.spec.ts).
// `index.json` says, per file, the race, the address, the day it was
// recorded, the full file's SHA-256 and the sections kept. Never edit the
// fixtures by hand: record them again.
//
// The shuffled-entrance set (test/dr-entrance-spoilers/) holds every spoiler
// race of racetime.gg's alttpr category whose DR log shuffles entrances, as
// of 2026-10-30 but one whose log has no playthrough: the five below, all
// Crosskeys (crossed entrances, keysanity) on DR 1.4.8 and 1.4.8.1 (the 343
// other DR spoiler races posted since May 2023 keep their entrances vanilla). Crossed is the shuffle players
// race on DR (Crosskeys: the 2026 tournament on Hyrule Town Hall, ~400 of
// the DR races listed since August 2025). Swapped is raced too, rarely
// (swapkeys, 10 of the 1,112 avianart race seeds those races link), but on
// the Overworld fork (avianart's swapkeys preset rolls OWR 0.8.0.2), whose
// rules the tracker does not model: no fixture holds it. No spoiler of a
// 1.5.x shuffled-entrance race is public (race seeds' permalinks keep their
// meta alone), so the set adds an avianart.games seed of the crosskeys
// preset, generated for these fixtures with the site's own Generate (not a
// race): its permalink serves DR's JSON spoiler whole, cut to what the
// contract reads: meta, Entrances, the locations by region, Special,
// Starting Inventory, Shops, Bosses and the playthrough.
//
// The door-shuffle set (test/dr-door-spoilers/): no spoiler of a door-shuffled
// race was found (the door-shuffled races of racetime.gg, about 2 to 3 % of
// the DR races, run on Hyrule Town Hall and avianart seeds whose permalinks
// keep their meta alone; the spoiler races above are vanilla doors), so it
// holds avianart.games seeds generated for these fixtures on
// 2026-10-30, not races: the door presets players race (the doors league's
// and ladder's partitioned, Lightspeed's and Kekpriest's crossed) and the
// customizer's basic, partitioned and crossed at each intensity, and, also
// from the customizer (`?action=generate`, branch DRUnstable), crossed
// doors decoupled, in the Inverted world, and with Crosskeys' crossed
// entrances, and partitioned intensity 3 decoupled in the Inverted world
// with key drops and pots; each spoiler cut to the keys above and its Doors, Lobbies and
// DoorTypes.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/dr-spoilers",
);
const OUT_ENTRANCES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/dr-entrance-spoilers",
);
const OUT_DOORS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/dr-door-spoilers",
);
const OUT_OWR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/owr-spoilers",
);
const OUT_OWR_CROSSED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/owr-crossed-spoilers",
);
const OUT_OWR_MIXED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/owr-mixed-spoilers",
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

/** Spoiler races whose DR log shuffles entrances (all Crosskeys). */
export const ENTRANCE_RACES = [
  // (DR 1.4.7.2-u's alttpr/bonus-boots-5447 is left out: its log's
  // Playthrough holds no sphere)
  // DR 1.4.8-u
  "alttpr/zany-silvers-3916",
  // DR 1.4.8.1-u
  "alttpr/cunning-validation-2430",
  "alttpr/comic-chestgame-8086",
  "alttpr/kind-hera-6525",
  "alttpr/smelly-pieceofheart-6451",
];

/**
 * avianart.games seeds of the preset players race with shuffled entrances,
 * generated on 2026-10-30 for these fixtures (DR 1.5.8-u, not races).
 */
export const AVIANART_SEEDS = [
  // "crosskeys": crossed entrances, keysanity, doors vanilla
  "7E8eFbBNH",
];

/**
 * avianart.games seeds of the door shuffles, generated on 2026-10-30 for
 * these fixtures (DR 1.5.8-u, not races): a preset's (`?action=generate&
 * preset=`) or the customizer's (`?action=generate`, its settings named).
 */
export const DOOR_SEEDS = [
  // basic, intensity 1, open (customizer)
  "D14rBE1uq",
  // basic, intensity 2, open (customizer)
  "giw5Y13cP",
  // basic, intensity 3, door types all, keysanity (customizer)
  "1d6rBFvOW",
  // partitioned, intensity 1, standard: "DR Beginner Week 1 & 2" (doors league)
  "xd8m0E50c",
  // partitioned, intensity 2, standard: "Ladder Beginner Doors"
  "w6Jx8UcW6",
  // crossed, intensity 2, open, keysanity (customizer)
  "uMJQnKFrH",
  // crossed, intensity 3, open (customizer)
  "CURaRjUhM",
  // crossed, intensity 3, standard, door types all: "Lightspeed w/ Crossed Doors"
  "fKa1LLrNU",
  // crossed, intensity 2, open, decoupled doors (customizer)
  "gVe3VdZba",
  // crossed, intensity 2, inverted, keysanity (customizer)
  "7SFJ6YE0k",
  // crossed, intensity 2, open, crossed entrances, keysanity: Crosskeys with
  // its doors crossed (customizer)
  "4L77dyaAg",
  // partitioned, intensity 3, inverted, decoupled doors, key drops and key
  // pots (customizer)
  "2uDU33UMw",
];

/**
 * The Overworld Randomizer set (test/owr-spoilers/): no OWR race keeps its
 * spoiler (avianart race permalinks keep their meta alone), so avianart.games
 * seeds of OWR 0.8.0.2 (on DR 1.5.7) generated for these fixtures on
 * 2026-10-30, not races, from the customizer (`?action=generate`, branch
 * OWR, `spoiler: full`, every other setting the site's default: noglitches,
 * the Ganon goal, keys in their dungeons), doors and entrances vanilla, the
 * overworld vanilla or with the shuffles a player notes (whirlpools, flute
 * spots): the release the pack's OWR world reads.
 */
export const OWR_SEEDS = [
  // Open, bonk drops shuffled
  "n7Bg53tbm",
  // Open
  "2cWVkb9pK",
  // Inverted, bonk drops shuffled
  "rcEzGOnFN",
  // Inverted
  "nir3EmS5u",
  // Open, flute spots random, whirlpools shuffled
  "qmequASj4",
  // Inverted, flute spots balanced, whirlpools shuffled
  "n3VjztEKb",
];

/**
 * The crossed overworld set (test/owr-crossed-spoilers/): avianart.games
 * seeds of OWR 0.8.0.2 as OWR_SEEDS', Open, the layout vanilla, its edges
 * crossed: grouped (generated 2026-10-30 from the customizer, `ow_crossed:
 * grouped`) and unrestricted (2026-10-30, `[{"args":{"branch":"OWR",
 * "worldstate":"open","ow_crossed":"unrestricted","spoiler":"full"}}]`).
 * Polar crosses nothing without Mixed (OverworldShuffle.py:248, :272), so
 * no seed of it: Mixed's own set holds it.
 */
export const OWR_CROSSED_SEEDS = ["o4mamwuKZ", "0DsyCwK23"];

/**
 * The Mixed overworld set (test/owr-mixed-spoilers/): avianart.games seeds
 * of OWR 0.8.0.2 as OWR_SEEDS', their screens flipped by Mixed, its `Maps`
 * swaps' `data` the flipped screens: Open (generated 2026-10-30 from the
 * customizer, `ow_mixed: true`), Inverted, Open with its edges crossed
 * grouped and Open with its whirlpools shuffled (2026-10-30, `[{"args":
 * {"branch":"OWR","worldstate":"inverted","mixed":true,"spoiler":"full"}}]`,
 * `…"worldstate":"open","mixed":true,"ow_crossed":"grouped"…` and
 * `…"mixed":true,"ow_whirlpool":true…`).
 */
export const OWR_MIXED_SEEDS = [
  "mPEeiQvu1",
  "6DIwXjzG5",
  "4yKJq5H2E",
  "t8B3wJpHK",
];

/** The keys of DR's JSON spoiler the contract reads (to_json). */
export const KEPT_KEYS = [
  "meta",
  "Entrances",
  "Light World",
  "Dark World",
  "Caves",
  "Hyrule Castle",
  "Eastern Palace",
  "Desert Palace",
  "Tower of Hera",
  "Agahnims Tower",
  "Palace of Darkness",
  "Thieves Town",
  "Skull Woods",
  "Swamp Palace",
  "Ice Palace",
  "Misery Mire",
  "Turtle Rock",
  "Ganons Tower",
  "Starting Inventory",
  "Special",
  "Shops",
  "Bosses",
  "playthrough",
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
  // Its Entrances too where they are shuffled
  const shuffled = lines.some((line) =>
    /^Entrance Shuffle:\s+(?!vanilla\s*$)\S/.test(line),
  );
  const sections = shuffled ? ["Entrances", ...KEPT_SECTIONS] : KEPT_SECTIONS;
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
      keep = sections.includes(name);
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

/**
 * Records spoiler races' text logs into `out`, with their index.
 * @param {readonly string[]} races
 * @param {string} out
 */
async function recordRaces(races, out) {
  mkdirSync(out, { recursive: true });
  const recorded = new Date().toISOString().slice(0, 10);
  /** @type {Record<string, unknown>} */
  const index = {};
  for (const race of races) {
    const log = await get(`https://racetime.gg/${race}/log`);
    const posted = POSTED.exec(log);
    if (posted === null) throw new Error(`${race}: no spoiler log posted`);
    const name = `DR_${posted[2]}_Spoiler.txt`;
    const url = `${posted[1]}${name}`;
    const full = await get(url);
    const { kept, text } = cutLog(full);
    writeFileSync(join(out, name), text);
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
  return index;
}

/** What the door contract reads beside `KEPT_KEYS`. */
const DOOR_KEYS = ["Doors", "Lobbies", "DoorTypes"];

/**
 * What the Overworld Randomizer's contract reads beside `KEPT_KEYS`: its
 * edges, whirlpools and flute spots (Overworld, Whirlpools, Maps), empty
 * while they stay vanilla.
 */
const OWR_KEYS = ["Overworld", "Whirlpools", "Maps"];

/**
 * Records avianart.games seeds' JSON spoilers, cut to `KEPT_KEYS` (and
 * `extra`), into `out`.
 * @param {readonly string[]} hashes
 * @param {string} out
 * @param {readonly string[]} extra
 */
async function recordAvianart(hashes, out = OUT_ENTRANCES, extra = []) {
  mkdirSync(out, { recursive: true });
  const recorded = new Date().toISOString().slice(0, 10);
  /** @type {Record<string, unknown>} */
  const index = {};
  for (const hash of hashes) {
    const url = `https://avianart.games/api.php?action=permlink&hash=${hash}`;
    const json = JSON.parse(await get(url));
    const spoiler = json?.response?.spoiler;
    if (spoiler === undefined || spoiler.playthrough === undefined)
      throw new Error(`${hash}: no whole spoiler (a race seed's?)`);
    const kept = [...KEPT_KEYS, ...extra].filter((key) => key in spoiler);
    const name = `avianart-${hash}.json`;
    writeFileSync(
      join(out, name),
      `${JSON.stringify(Object.fromEntries(kept.map((key) => [key, spoiler[key]])), null, 2)}\n`,
    );
    index[name] = {
      address: `https://avianart.games/perm/${hash}`,
      kept,
      recorded,
      sha256: createHash("sha256")
        .update(JSON.stringify(spoiler))
        .digest("hex"),
      version: String(spoiler.meta?.version),
    };
    process.stdout.write(`${name}\n`);
  }
  return index;
}

/**
 * @param {string} out
 * @param {Record<string, unknown>} logs
 * @param {string} how
 */
const writeIndex = (out, logs, how) =>
  writeFileSync(
    join(out, "index.json"),
    `${JSON.stringify({ generated: how, logs }, null, 2)}\n`,
  );

async function main() {
  const only = process.argv[2];
  if (only === undefined || only === "vanilla")
    writeIndex(
      OUT,
      await recordRaces(RACES, OUT),
      "By packs/alttpr/scripts/record-dr-spoilers.mjs from real spoiler races. Record again, never edit.",
    );
  if (only === undefined || only === "entrances") {
    const races = await recordRaces(ENTRANCE_RACES, OUT_ENTRANCES);
    writeIndex(
      OUT_ENTRANCES,
      { ...races, ...(await recordAvianart(AVIANART_SEEDS)) },
      "By packs/alttpr/scripts/record-dr-spoilers.mjs (vanilla|entrances): spoiler races' DR text logs and avianart.games seeds' JSON spoilers, entrances shuffled. Record again, never edit.",
    );
  }
  if (only === undefined || only === "owr")
    writeIndex(
      OUT_OWR,
      await recordAvianart(OWR_SEEDS, OUT_OWR, OWR_KEYS),
      "By packs/alttpr/scripts/record-dr-spoilers.mjs (owr): avianart.games seeds' JSON spoilers of the Overworld Randomizer. Record again, never edit.",
    );
  if (only === undefined || only === "owr-crossed")
    writeIndex(
      OUT_OWR_CROSSED,
      await recordAvianart(OWR_CROSSED_SEEDS, OUT_OWR_CROSSED, OWR_KEYS),
      "By packs/alttpr/scripts/record-dr-spoilers.mjs (owr-crossed): avianart.games seeds' JSON spoilers of the Overworld Randomizer, its edges crossed. Record again, never edit.",
    );
  if (only === undefined || only === "owr-mixed")
    writeIndex(
      OUT_OWR_MIXED,
      await recordAvianart(OWR_MIXED_SEEDS, OUT_OWR_MIXED, OWR_KEYS),
      "By packs/alttpr/scripts/record-dr-spoilers.mjs (owr-mixed): avianart.games seeds' JSON spoilers of the Overworld Randomizer, its screens flipped by Mixed. Record again, never edit.",
    );
  if (only === undefined || only === "doors")
    writeIndex(
      OUT_DOORS,
      await recordAvianart(DOOR_SEEDS, OUT_DOORS, DOOR_KEYS),
      "By packs/alttpr/scripts/record-dr-spoilers.mjs (doors): avianart.games seeds' JSON spoilers, doors shuffled. Record again, never edit.",
    );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}

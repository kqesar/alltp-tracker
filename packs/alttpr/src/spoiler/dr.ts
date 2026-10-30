// The Door Randomizer's spoiler log, and its Overworld fork's, at the
// release upstream.json pins (`doorRandomizer`). DR writes it two ways, from
// one `Spoiler` (BaseClasses.py:2497-3026 at DR 1.5.8):
// - text: `meta_to_file` (:2754-2848: the version and seed, then one
//   `Label:   value` line a setting), the title screen's code inserted
//   third (`hashes_to_file`, :2850-2875), then `to_file` (:2877-2990) and
//   `playthrough_to_file` (:2992-3024): sections under a `Name:` line, the
//   locations flat (`name: item`), the shops (`Name [Shop]` and an indented
//   `item — price` each), the spheres as `n: { … }`. Names go through
//   BabelFish, whose English table is empty (resources/app/meta/lang/en.json
//   is `{}`), so they are written as they are. What SahasrahBot posts for a
//   spoiler race, and what DR's command line writes.
// - JSON: `to_json` (:2714-2735): `Entrances`, `Doors`, `Lobbies`,
//   `DoorTypes`, then a section of locations per kind of region and per
//   dungeon (parse_data, :2623-2712), `Starting Inventory`, `Special` (the two
//   medallions), `Bottles`, `Hashes`, `Shops`, `playthrough` (`"0"` the
//   starting items as a list, then `{ location: item }` by sphere, Main.py:
//   797-799), `paths`, `Bosses` and `meta`, each setting of which is keyed by
//   player (`{ "1": "open" }`). avianart's Download Spoiler saves
//   `JSON.stringify(spoiler, null, 4)` of the same with a flat `meta`, as
//   `alttprcustom - DR__<hash>_Spoiler.txt` (its PermlinkView chunk); its
//   permalink API wraps it in `{ response: { spoiler, hash } }`.
// The Overworld fork adds `Overworld`, `Whirlpools` and `Maps` first (OWR
// 0.8.0.0 BaseClasses.py:3290-3314) and its own label for a few settings.
//
// A location is `gen_name()` (:2325-2334): its name, then ` @ <dungeon>` when
// the doors are shuffled past basic (the dungeon its region was moved to),
// then ` (<enemy>)` for an enemy's drop (EnemyList.py:2268-2270, and a key
// drop's under enemy shuffle, Regions.py:1177-1178). Its name is the entrance
// randomizer's (`erLocationId`), or one of the pack's DR locations
// (door-rando/locations.ts). An item is its name in Items.py (dr-items.json),
// with ` (Player 1)` after it where DR printed an item of no world
// (Item.__unicode__, BaseClasses.py:2419-2420).
//
// Nothing here throws on the file: every reason not to show it is a refusal.

import {
  accept,
  refuse,
  type Sniffed,
  type SpoilerResult,
} from "@alltp/spoiler";
import * as z from "zod/mini";
import { DR_LOCATIONS } from "../door-rando/locations";
import { doorMetaReading } from "../door-rando/seed-import";
import { erLocationId } from "../entrances";
import { UPSTREAM_ITEMS } from "../items";
import DR_ITEMS from "./dr-items.json" with { type: "json" };
import { knownLocationIds } from "./known";
import {
  type AlttprSpoilerLog,
  type ItemRead,
  readLog,
  type Shape,
  sectionsOf,
  stringsOf,
} from "./read";

type Doc = Record<string, unknown>;

/** What a DR log says of its seed beyond the shared model: `extra.door`. */
export interface DoorSpoilerFacts {
  /** DR's version, as `meta` or the first line writes it (`1.5.6-u`). */
  readonly version: string | null;
  /** The Overworld fork's log. */
  readonly overworld: boolean;
  /**
   * The seed as the ROM's title names it, `<team>_<player>_<seed>`, which
   * autotracking records as the run's seed (probes.ts, `seedRomOf`): from
   * `meta.seed` or the first line's. Null when the log does not say.
   */
  readonly title: string | null;
  /** avianart's hash, from the permalink's wrapper or avianart's file name. */
  readonly avianart: string | null;
  /** The title screen's code (`Hash: Bow, Boomerang, …`), or null. */
  readonly code: string | null;
}

const isRecord = (value: unknown): value is Doc =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The keys of DR's JSON that are no list of locations; 1.5.7 adds the
 * drops, the digging game, the prize packs and the in-game texts
 * (BaseClasses.py:2730-2733 at 1.5.8), keyed by player name.
 */
const RESERVED: ReadonlySet<string> = new Set([
  "Bosses",
  "Bottles",
  "Dig Game Digs",
  "DoorTypes",
  "Doors",
  "Drops",
  "Entrances",
  "Hashes",
  "In-Game Texts",
  "Lobbies",
  "Maps",
  "Overworld",
  "Prize Packs",
  "PrizePacks",
  "Prizes",
  "Shops",
  "Special",
  "Starting Inventory",
  "Whirlpools",
  "meta",
  "paths",
  "playthrough",
]);

/** The text log's own section of locations. */
const LOCATIONS = "Locations";

const DR_BY_NAME: ReadonlyMap<string, string> = new Map(
  DR_LOCATIONS.map((location) => [location.name, location.id]),
);

let known: ReadonlySet<string> | undefined;

/** The pack's locations and DR's, built on first use. */
const knownIds = (): ReadonlySet<string> => {
  known ??= new Set([...knownLocationIds(), ...DR_BY_NAME.values()]);
  return known;
};

const idOf = (name: string): string =>
  DR_BY_NAME.get(name) ?? erLocationId(name);

const NOTE = / \([^()]*\)$/;
const DUNGEON = / @ [^@]+$/;

/**
 * A location as written -> its name: as written when the pack knows it,
 * else without the enemy's note, else without the dungeon too. A name the
 * pack knows in none of them is kept whole, for `skipped`.
 */
const nameOf = (written: string): string => {
  const bare = written.replace(NOTE, "");
  for (const name of [written, bare, bare.replace(DUNGEON, "")]) {
    if (knownIds().has(idOf(name))) return name;
  }
  return written;
};

const ITEMS = DR_ITEMS.items as Readonly<Record<string, string | null>>;
const NO_CLASS: ReadonlySet<string> = new Set(DR_ITEMS.unmatched);
const PLAYER_ONE = / \(Player 1\)$/;
const OTHER_PLAYER = / \(Player \d+\)$/;

/** An item as written, less DR's ` (Player 1)`. */
const itemName = (written: string): string => written.replace(PLAYER_ONE, "");

const itemOf = (written: string): ItemRead => {
  const name = itemName(written);
  if (OTHER_PLAYER.test(name)) return { kind: "world" };
  if (Object.hasOwn(ITEMS, name)) {
    const itemClass = ITEMS[name];
    if (itemClass === null) return { kind: "event" };
    return itemClass !== undefined && UPSTREAM_ITEMS.has(itemClass)
      ? { class: itemClass, kind: "item", name }
      : { kind: "unknown" };
  }
  return NO_CLASS.has(name)
    ? { class: null, kind: "item", name }
    : { kind: "unknown" };
};

const PLAYTHROUGH = z.record(
  z.string(),
  z.union([z.array(z.string()), z.record(z.string(), z.string())]),
);

/** `Red Potion — 150`: the name, a dash, the price (BaseClasses.py:2685). */
const SHOP_ITEM = /^(.+) — (\d+)$/;

const STRINGS = z.array(z.string());

export const DR: Shape = {
  // A JSON log's sections are DR's kinds of region and dungeons; a text
  // log's one list says nothing
  area: (section) => (section === LOCATIONS ? null : section),
  describeItem: itemName,
  format: "dr",
  id: idOf,
  item: itemOf,
  known: knownIds,
  name: nameOf,
  playthrough: (value) => {
    const parsed = PLAYTHROUGH.safeParse(value);
    if (!parsed.success) return null;
    const entries: [number, string][] = [];
    for (const [key, locations] of Object.entries(parsed.data)) {
      // "0": the starting items DR's logic counts, a list of names
      if (Array.isArray(locations)) {
        if (key !== "0") return null;
        continue;
      }
      const sphere = Number(key);
      if (!Number.isInteger(sphere) || sphere < 1) return null;
      for (const written of Object.keys(locations)) {
        entries.push([sphere, written]);
      }
    }
    return entries;
  },
  reserved: RESERVED,
  settings: (meta, seed) =>
    isRecord(meta) ? doorMetaReading(meta, seed) : null,
  shopItem: (value) => {
    if (typeof value !== "string") return null;
    const match = SHOP_ITEM.exec(value);
    return match?.[1] === undefined
      ? { name: itemName(value), price: null }
      : { name: itemName(match[1]), price: Number(match[2]) };
  },
  special: (special) => ({
    medallions: {
      mire: special["Misery Mire"]?.toLowerCase() ?? null,
      turtleRock: special["Turtle Rock"]?.toLowerCase() ?? null,
    },
    placements: [],
  }),
  start: (doc) => {
    const parsed = STRINGS.safeParse(doc["Starting Inventory"]);
    return parsed.success ? parsed.data : [];
  },
};

/**
 * One player's `meta`: a JSON log's keys a setting by player (`{ "1": … }`),
 * avianart's and a text log's are flat already.
 */
const flatMeta = (meta: Doc): Doc =>
  Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      if (!isRecord(value)) return [key, value];
      const keys = Object.keys(value);
      return keys.length > 0 && keys.every((k) => /^\d+$/.test(k))
        ? [key, value["1"]]
        : [key, value];
    }),
  );

/**
 * The text log's settings, by label -> DR's `meta` name. DR 1.5.8 and its
 * Overworld fork label a few alike settings in another case or words
 * (OWR 0.8.0.0 BaseClasses.py:3328-3453), so labels are matched in lower
 * case.
 */
const TEXT_SETTINGS: Readonly<Record<string, string>> = {
  accessibility: "accessibility",
  "back of tavern shuffled": "shuffletavern",
  "big key shuffle": "bigkeyshuffle",
  bombbag: "bombbag",
  "bonk drops": "bonk_drops",
  "boss shuffle": "boss_shuffle",
  "bow mode": "bow_mode",
  "compass shuffle": "compassshuffle",
  "crossed ow": "ow_crossed",
  "decouple doors": "decoupledoors",
  difficulty: "item_pool",
  "door shuffle": "door_shuffle",
  "door type mode": "door_type_mode",
  "dungeon counters": "dungeon_counters",
  "enemy damage": "enemy_damage",
  "enemy drop shuffle": "dropshuffle",
  "enemy health": "enemy_health",
  "enemy shuffle": "enemy_shuffle",
  "entrance shuffle": "shuffle",
  experimental: "experimental",
  "flute mode": "flute_mode",
  "flute shuffle": "ow_fluteshuffle",
  goal: "goal",
  "gt/ganon shuffled": "shuffleganon",
  hints: "hints",
  intensity: "intensity",
  "item functionality": "item_functionality",
  "key logic algorithm": "key_logic",
  "link's house shuffled": "shufflelinks",
  logic: "logic",
  "map shuffle": "mapshuffle",
  "mirror scroll": "mirrorscroll",
  mode: "mode",
  "overworld layout shuffle": "ow_layout",
  "overworld map": "overworld_map",
  "ow tile flip (mixed)": "ow_mixed",
  players: "players",
  "pot shuffle (legacy)": "potshuffle",
  "pottery mode": "pottery",
  pseudoboots: "pseudoboots",
  "pyramid hole pre-opened": "open_pyramid",
  race: "race",
  "restricted boss items": "restricted_boss_items",
  "settings code": "code",
  shopsanity: "shopsanity",
  "shuffle back of tavern": "shuffletavern",
  "shuffle gt/ganon": "shuffleganon",
  "shuffle link's house": "shufflelinks",
  "skull woods shuffle": "skullwoods",
  "small key shuffle": "keyshuffle",
  swords: "weapons",
  "take any caves": "take_any",
  teams: "teams",
  "trap door mode": "trap_door_mode",
  "triforce pieces required": "triforcegoal",
  "triforce pieces total": "triforcepool",
  "whirlpool shuffle": "ow_whirlpool",
};

/** A text value as `meta` would hold it: Yes and No are DR's `yn` of a flag. */
const textValue = (value: string): unknown =>
  value === "Yes" ? true : value === "No" ? false : value;

const DR_FIRST = /^ALttP Dungeon Randomizer Version (\S+)\s+-\s+Seed: (\S*)/;
const OWR_FIRST = /^ALttP Overworld Randomizer\s+-\s+Seed: (\S*)/;
/** `Label:   value`; DR writes `Key Logic Algorithm:'` with a stray quote. */
const LINE = /^([^:]+):'?\s+(.*?)\s*$/;
const HEADING = /^([A-Z][^:]*):$/;
const SPHERE = /^(\d+): \{$/;
const SHOP = /^(.+) \[(.+)\]$/;
const MEDALLION = /^(.+): (\S+) Medallion$/;

/**
 * A text log as the JSON document `to_json` would have written, flat
 * `meta`. Null when the first line is not DR's or its fork's.
 */
export function textDocument(text: string): Doc | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines[0] ?? "";
  const dr = DR_FIRST.exec(first);
  const owr = dr === null ? OWR_FIRST.exec(first) : null;
  if (dr === null && owr === null) return null;
  const meta: Doc = {
    seed: (dr === null ? owr?.[1] : dr[2]) ?? null,
    ...(dr === null ? {} : { version: dr[1] }),
  };
  const doc: Doc = { meta };
  const start: string[] = [];
  let code: string | null = null;
  let at = 1;
  // The header: one setting a line, the starting items run on below theirs
  for (; at < lines.length; at++) {
    const line = lines[at] ?? "";
    if (HEADING.test(line)) break;
    if (/^\s+\S/.test(line) && start.length > 0) {
      start.push(line.trim());
      continue;
    }
    const setting = LINE.exec(line);
    if (setting === null) continue;
    const [, label = "", value = ""] = setting;
    const key = label.trim().toLowerCase();
    if (key === "hash") code = value;
    else if (key === "starting inventory") start.push(value);
    else if (key === "door version") meta.version = value;
    else if (key === "overworld version") {
      meta.versions = { Door: meta.version, Overworld: value };
    } else if (Object.hasOwn(TEXT_SETTINGS, key)) {
      meta[TEXT_SETTINGS[key] as string] = textValue(value);
    }
  }
  if (code !== null) doc.Hashes = { "Player 1 (Team 1)": code };
  doc["Starting Inventory"] = start;

  let section = "";
  const locations: Record<string, string> = {};
  const special: Record<string, string> = {};
  const bosses: Record<string, string> = {};
  const playthrough: Record<string, string[] | Record<string, string>> = {};
  const shops: Doc[] = [];
  let sphere: string[] | Record<string, string> | null = null;
  let shop: Doc | null = null;
  for (; at < lines.length; at++) {
    const line = lines[at] ?? "";
    const heading = HEADING.exec(line);
    if (heading !== null && (lines[at - 1] ?? "") === "") {
      section = heading[1] ?? "";
      continue;
    }
    if (line.trim() === "") continue;
    if (section === LOCATIONS) {
      const colon = line.lastIndexOf(": ");
      if (colon > 0) locations[line.slice(0, colon)] = line.slice(colon + 2);
    } else if (section === "Requirements") {
      const medallion = MEDALLION.exec(line);
      const setting = LINE.exec(line);
      if (medallion !== null) {
        special[medallion[1] as string] = medallion[2] as string;
      } else if (setting?.[1]?.startsWith("Crystals Required for GT")) {
        meta.gt_crystals = setting[2];
      } else if (setting?.[1]?.startsWith("Crystals Required for Ganon")) {
        meta.ganon_crystals = setting[2];
      }
    } else if (section === "Shops") {
      const opened = SHOP.exec(line);
      if (opened !== null && !line.startsWith(" ")) {
        shop = { location: opened[1], type: opened[2] };
        shops.push(shop);
      } else if (shop !== null && line.startsWith(" ")) {
        const index = Object.keys(shop).length - 2;
        shop[`item_${index}`] = line.trim();
      }
    } else if (section.startsWith("Bosses")) {
      const colon = line.indexOf(": ");
      if (colon > 0) bosses[line.slice(0, colon)] = line.slice(colon + 2);
    } else if (section === "Playthrough") {
      const opened = SPHERE.exec(line);
      if (opened !== null) {
        sphere = opened[1] === "0" ? [] : {};
        playthrough[opened[1] as string] = sphere;
      } else if (line === "}") {
        sphere = null;
      } else if (Array.isArray(sphere)) {
        sphere.push(line.trim());
      } else if (sphere !== null) {
        const colon = line.lastIndexOf(": ");
        if (colon > 0) {
          sphere[line.slice(0, colon).trim()] = line.slice(colon + 2);
        }
      }
    }
  }
  doc[LOCATIONS] = locations;
  doc.Special = special;
  doc.Shops = shops;
  doc.Bosses = bosses;
  if (Object.keys(playthrough).length > 0) doc.playthrough = playthrough;
  if (owr !== null) meta.overworld = true;
  return doc;
}

/** `alttprcustom - DR__<hash>_Spoiler.txt`, as avianart saves its download. */
const AVIANART_NAME =
  /^alttprcustom - (?:DR|OR)__([A-Za-z0-9]{6,20})_Spoiler(?: \(\d+\))?\.(?:txt|json)$/i;

/** The avianart hash a file's name carries, or null. */
export const avianartHashInName = (fileName: string): string | null =>
  AVIANART_NAME.exec(fileName)?.[1] ?? null;

/**
 * The seed as DR's ROM title names it after the version: `<team>_<player>_`
 * and the seed, nine digits at least, the whole title cut to 21 bytes
 * (Rom.py:1504-1506): what autotracking records as a DR run's seed.
 */
export const titleSeedOf = (seed: unknown): string | null => {
  const digits =
    typeof seed === "number" && Number.isSafeInteger(seed) && seed >= 0
      ? String(seed)
      : typeof seed === "string" && /^\d+$/.test(seed)
        ? seed
        : null;
  // "DR156_" is 6 of the 21 bytes
  return digits === null
    ? null
    : `1_1_${digits.padStart(9, "0")}`.slice(0, 15).trim();
};

/** Whether a parsed JSON document is a DR log, or its permalink wrapper. */
export const isDoorDocument = (doc: Doc, sniffed: Sniffed): boolean => {
  if (sniffed.known && sniffed.format === "dr") return true;
  const spoiler = isRecord(doc.response) ? doc.response.spoiler : doc;
  if (!isRecord(spoiler)) return false;
  const meta = isRecord(spoiler.meta) ? spoiler.meta : {};
  return (
    "Doors" in spoiler ||
    "Lobbies" in spoiler ||
    "door_shuffle" in meta ||
    "versions" in meta
  );
};

/**
 * Reads a Door Randomizer log, text or a JSON document already parsed.
 * Refuses a multiworld (`unsupported`), a log with its settings and no
 * placement (`stripped`: `door-race` for a race seed's avianart keeps to
 * itself, `door-settings` for DR's settings-only modes), and what
 * `readLog` refuses.
 */
export function parseDoorLog(
  input: { readonly text: string } | { readonly json: Doc },
  fileName: string,
): SpoilerResult<AlttprSpoilerLog> {
  let doc: Doc;
  let avianart = avianartHashInName(fileName);
  if ("text" in input) {
    const read = textDocument(input.text);
    if (read === null) return refuse("not-a-spoiler", "not DR's first line");
    doc = read;
  } else if (isRecord(input.json.response)) {
    // The permalink's API answer: the spoiler and the hash that names it
    const { response } = input.json;
    if (!isRecord(response.spoiler)) return refuse("not-a-spoiler", "no meta");
    doc = response.spoiler;
    if (typeof response.hash === "string") avianart = response.hash;
  } else {
    doc = input.json;
  }
  if (!isRecord(doc.meta)) return refuse("not-a-spoiler", "no meta");
  const meta = flatMeta(doc.meta);
  if (Number(meta.players ?? 1) > 1 || Number(meta.teams ?? 1) > 1) {
    return refuse("unsupported", "multiworld");
  }
  const sections = sectionsOf(doc, RESERVED).filter(
    ([, section]) => Object.keys(section).length > 0,
  );
  if (sections.length === 0) {
    return refuse(
      "stripped",
      meta.race === true || meta.race === "Yes" ? "door-race" : "door-settings",
    );
  }
  const title = titleSeedOf(meta.seed);
  const seed: AlttprSpoilerLog["seed"] =
    title !== null
      ? { from: "content", id: title }
      : avianart !== null
        ? { from: "file-name", id: avianart }
        : { from: null, id: null };
  const bossShuffle = !["none", undefined].includes(
    meta.boss_shuffle as string | undefined,
  );
  const read = readLog({ ...doc, meta }, DR, seed, bossShuffle);
  if (!read.ok) return read;
  const hashes = stringsOf(doc.Hashes);
  const door: DoorSpoilerFacts = {
    avianart,
    code: hashes === null ? null : (Object.values(hashes)[0] ?? null),
    overworld:
      meta.overworld === true || "ow_layout" in meta || "versions" in meta,
    title,
    version: typeof meta.version === "string" ? meta.version : null,
  };
  return accept({ ...read.value, extra: { ...read.value.extra, door } });
}

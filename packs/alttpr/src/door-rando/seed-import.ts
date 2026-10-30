// A Door Randomizer seed's settings from where the sites that roll them keep
// them, without generating anything (the study of 2026-10-29, "Spoiler"):
// - avianart.games: a permalink's JSON (`api.php?action=permlink&hash=`,
//   which any origin may read) holds the seed's spoiler `meta`, DR's
//   settings by name (DR 1.5.8 BaseClasses.py:2560-2624, `meta`);
// - Hyrule Town Hall: a seed's patch (`/seed/DR_<uuid>.bps`, any origin
//   too), whose bytes written over the settings' tables are the ROM's: the
//   ROM decoder reads them (autotrack/seed-settings.ts) as it reads a game.
// Both hold the seed's item placements too (the patch, the permalink's
// spoiler), so the app never asks for them in Race Mode, as it never asks
// alttpr.com for a seed's file then.

import type { MemoryView } from "../autotrack/decode";
import { MEMORY_RANGE, type MemoryRangeId } from "../autotrack/memory";
import {
  type DoorExactSettings,
  decodeSeedSettings,
  known,
  type SeedAccessibility,
  type SeedBossShuffle,
  type SeedEntrances,
  type SeedGoal,
  type SeedItemFunctionality,
  type SeedItemPool,
  type SeedLogic,
  type SeedMode,
  type SeedSetting,
  type SeedSettingsReading,
  UNRECOGNIZED,
} from "../autotrack/seed-settings";

/** Where a DR seed is kept: an avianart permalink or a Hyrule Town Hall patch. */
export type DoorSeedLink =
  | { readonly site: "avianart"; readonly hash: string }
  | { readonly site: "hth"; readonly url: string };

const AVIANART =
  /^(?:https?:\/\/)?(?:www\.)?avianart\.games\/perm\/([A-Za-z0-9]{6,20})\/?(?:[?#].*)?$/;
const HTH =
  /^(?:https?:\/\/)?(?:www\.)?hyruletownhall\.com\/seed\/((?:DR|OR)_[0-9a-f-]{36}\.bps)$/;

/** The DR seed a player's paste names, or null. */
export const doorSeedLinkOf = (input: string): DoorSeedLink | null => {
  const text = input.trim();
  const avianart = AVIANART.exec(text);
  if (avianart !== null) return { hash: avianart[1], site: "avianart" };
  const hth = HTH.exec(text);
  return hth === null
    ? null
    : { site: "hth", url: `https://hyruletownhall.com/seed/${hth[1]}` };
};

/** The permalink's JSON (the study's scripts/avian.py read it so). */
export const avianartUrl = (hash: string) =>
  `https://avianart.games/api.php?action=permlink&hash=${encodeURIComponent(hash)}`;

type Meta = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Meta =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A flag as `meta` writes it: a boolean, or 0 and 1 in older seeds. */
const flagOf = (value: unknown): boolean | null =>
  value === true || value === 1
    ? true
    : value === false || value === 0
      ? false
      : null;

/** A string among `options`, or null. */
const oneOf = <T extends string>(value: unknown, options: readonly T[]) =>
  typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : null;

/** A setting from a value, unrecognized when null. */
const setting = <T>(value: T | null): SeedSetting<T> =>
  value === null ? UNRECOGNIZED : known(value);

/** A crystal count, 0 to 7, as a number or its digits. */
const crystals = (value: unknown) => {
  const count = typeof value === "string" ? Number(value) : value;
  return typeof count === "number" &&
    Number.isInteger(count) &&
    count >= 0 &&
    count <= 7
    ? count
    : null;
};

/** A dungeon item shuffled: `wild` (or true in older seeds). */
const wild = (value: unknown) =>
  value === "wild" || value === true || value === 1
    ? true
    : value === "none" || value === false || value === 0
      ? false
      : null;

/** DR's logics as alttpr.com names them (args.json `logic`). */
const LOGICS: Readonly<Record<string, SeedLogic>> = {
  hybridglitches: "HybridMajorGlitches",
  noglitches: "NoGlitches",
  nologic: "NoLogic",
  owglitches: "OverworldGlitches",
};

/** DR's entrance shuffles alttpr.com shares (args.json `shuffle`). */
const ENTRANCES: Readonly<Record<string, SeedEntrances>> = {
  crossed: "crossed",
  full: "full",
  insanity: "insanity",
  restricted: "restricted",
  simple: "simple",
  vanilla: "none",
};

const PYRAMIDS = ["auto", "yes", "no"] as const;

/**
 * `open_pyramid` as DR names it (args.json `openpyramid`: auto, yes, no),
 * a flag in older seeds; null when `meta` has none.
 */
const pyramidOf = (value: unknown): string | null =>
  value === true ? "yes" : value === false ? "no" : oneOf(value, PYRAMIDS);

/**
 * DR's goal as the tracker's: its "crystals" is Fast Ganon when the pyramid
 * opens, which `open_pyramid: auto` does for it under vanilla or dungeon
 * entrances alone (BaseClasses.py:300-311); trinity has no run type.
 */
const goalOf = (meta: Meta): SeedGoal | null => {
  const goal = meta.goal;
  if (goal === "crystals") {
    const open = pyramidOf(meta.open_pyramid);
    const opens =
      open === "yes"
        ? true
        : open === "no"
          ? false
          : open === "auto"
            ? ["vanilla", "dungeonssimple", "dungeonsfull"].includes(
                String(meta.shuffle),
              )
            : null;
    return opens === null ? null : opens ? "fast_ganon" : "ganon";
  }
  if (goal === "triforcehunt") return "triforce-hunt";
  return oneOf(goal, [
    "ganon",
    "pedestal",
    "dungeons",
    "ganonhunt",
    "completionist",
  ] as const);
};

/** DR's own settings by name, from `meta`; null when one is missing. */
const exactOf = (meta: Meta): DoorExactSettings | null => {
  const doorShuffle = oneOf(meta.door_shuffle, [
    "vanilla",
    "basic",
    "partitioned",
    "crossed",
  ] as const);
  const dropShuffle = oneOf(meta.dropshuffle, [
    "none",
    "keys",
    "underworld",
  ] as const);
  const pottery = typeof meta.pottery === "string" ? meta.pottery : null;
  const shopsanity = flagOf(meta.shopsanity);
  if (
    doorShuffle === null ||
    dropShuffle === null ||
    pottery === null ||
    shopsanity === null
  ) {
    return null;
  }
  const shuffle = String(meta.shuffle ?? "vanilla");
  const bombBag = flagOf(meta.bombbag);
  const potShuffle = flagOf(meta.potshuffle);
  const pyramid = pyramidOf(meta.open_pyramid);
  // Link's House and the Tavern's back move only with the entrances: a
  // seed of vanilla entrances names them to no effect
  const moves = shuffle !== "vanilla";
  const shuffleLinks = moves ? flagOf(meta.shufflelinks) : null;
  const shuffleTavern = moves ? flagOf(meta.shuffletavern) : null;
  // A door shuffle's intensity and coupling: no effect with vanilla doors
  const doorsMove = doorShuffle !== "vanilla";
  const intensity = Number(meta.intensity);
  const doorIntensity =
    doorsMove && [1, 2, 3].includes(intensity) ? intensity : null;
  const decoupledDoors = doorsMove ? flagOf(meta.decoupledoors) : null;
  const exact: DoorExactSettings = {
    doorShuffle,
    dropShuffle,
    enemyShuffle: String(meta.enemy_shuffle ?? "none"),
    ...(typeof meta.key_logic === "string" ? { keyLogic: meta.key_logic } : {}),
    pottery,
    shopsanity,
    takeAny: String(meta.take_any ?? "none"),
    ...(shuffle in ENTRANCES ? {} : { doorEntrances: shuffle }),
    ...(bombBag === null ? {} : { bombBag }),
    ...(potShuffle === null ? {} : { potShuffle }),
    ...(typeof meta.restricted_boss_items === "string"
      ? { restrictBossItems: meta.restricted_boss_items }
      : {}),
    ...(pyramid === null ? {} : { openPyramid: pyramid }),
    ...(shuffleLinks === null ? {} : { shuffleLinks }),
    ...(shuffleTavern === null ? {} : { shuffleTavern }),
    ...(doorIntensity === null ? {} : { doorIntensity }),
    ...(decoupledDoors === null ? {} : { decoupledDoors }),
  };
  // Only the Overworld fork writes `ow_layout` (OWR 0.8.0.0 BaseClasses.py)
  if (!("ow_layout" in meta)) return exact;
  return {
    ...exact,
    overworld: {
      bonkDrops: flagOf(meta.bonk_drops) ?? false,
      crossed: String(meta.ow_crossed ?? "none"),
      fluteShuffle: String(meta.ow_fluteshuffle ?? "vanilla"),
      layout: String(meta.ow_layout),
      mixed: flagOf(meta.ow_mixed) ?? false,
      whirlpool: flagOf(meta.ow_whirlpool) ?? false,
    },
  };
};

/**
 * A DR seed's settings from an avianart permalink's JSON: its spoiler's
 * `meta`, each setting the tracker keeps. Null when the JSON holds no DR
 * meta (an alttpr.com preset's seed, a hash avianart does not know).
 * @param json - The permalink's answer, `{ response: { spoiler: { meta } } }`
 * @param hash - The permalink's hash: the seed's name here
 */
export const avianartReading = (
  json: unknown,
  hash: string,
): SeedSettingsReading | null => {
  const response = isRecord(json) ? json.response : null;
  const spoiler = isRecord(response) ? response.spoiler : null;
  const meta = isRecord(spoiler) ? spoiler.meta : null;
  return isRecord(meta) ? doorMetaReading(meta, hash) : null;
};

/**
 * A DR seed's settings from its spoiler's `meta`, one player's, each value
 * as DR writes it (BaseClasses.py:2560-2624): an avianart permalink's, or a
 * spoiler log's (spoiler/dr.ts, which takes player 1's of a JSON's and
 * reads a text log's lines into the same names). Null when it holds no DR
 * version or one of the settings that decide a DR run.
 * @param meta - The settings by DR's names
 * @param seed - The seed's id for the reading: a permalink's hash, the ROM
 *   title's seed
 */
export const doorMetaReading = (
  meta: Meta,
  seed: string | null,
): SeedSettingsReading | null => {
  if (typeof meta.version !== "string") return null;
  const exact = exactOf(meta);
  if (exact === null) return null;
  const shuffle = String(meta.shuffle ?? "vanilla");
  const version = /^(\d+(?:\.\d+)+)/.exec(meta.version)?.[1] ?? null;
  return {
    accessibility: setting(
      oneOf<SeedAccessibility>(meta.accessibility, [
        "items",
        "locations",
        "none",
      ]),
    ),
    bossShuffle: setting(
      meta.boss_shuffle === "unique"
        ? // Each boss once at most: any slot may hold any boss it takes,
          // which the pack's "random" reads, maybe where unsure
          "random"
        : oneOf<SeedBossShuffle>(meta.boss_shuffle, [
            "none",
            "simple",
            "full",
            "random",
          ]),
    ),
    crystalsGanon: setting(crystals(meta.ganon_crystals)),
    crystalsTower: setting(crystals(meta.gt_crystals)),
    door: {
      doorShuffle: known(
        exact.doorShuffle === "partitioned" || exact.doorShuffle === "crossed"
          ? "shuffled"
          : exact.doorShuffle,
      ),
      dropShuffle: known(exact.dropShuffle),
      pottery: known(
        exact.pottery === "none"
          ? "none"
          : exact.pottery === "cave"
            ? "cave"
            : "beyond-caves",
      ),
      shopsanity: known(exact.shopsanity),
      takeAny: known(exact.takeAny !== "none"),
      version: setting(version),
    },
    doorExact: exact,
    entrances: setting(ENTRANCES[shuffle] ?? null),
    goal: setting(goalOf(meta)),
    itemFunctionality: setting(
      oneOf<SeedItemFunctionality>(meta.item_functionality, [
        "normal",
        "hard",
        "expert",
      ]),
    ),
    itemPool: setting(
      oneOf<SeedItemPool>(meta.item_pool, ["normal", "hard", "expert"]),
    ),
    logic: setting(LOGICS[String(meta.logic)] ?? null),
    mode: setting(
      oneOf<SeedMode>(meta.mode, ["open", "standard", "inverted", "retro"]),
    ),
    randomizer: {
      kind: "door",
      overworld: exact.overworld !== undefined,
      version,
    },
    seed,
    swordless: setting(
      typeof meta.weapons === "string" ? meta.weapons === "swordless" : null,
    ),
    wildBigKeys: setting(wild(meta.bigkeyshuffle)),
    wildCompasses: setting(wild(meta.compassshuffle)),
    wildKeys: setting(
      meta.keyshuffle === "universal" ? true : wild(meta.keyshuffle),
    ),
    wildMaps: setting(wild(meta.mapshuffle)),
  };
};

/** A BPS number (beat.txt's encoding: 7 bits a byte, the last one marked). */
const varint = (bytes: Uint8Array, at: { i: number }): number => {
  let value = 0;
  let shift = 1;
  for (;;) {
    const byte = bytes[at.i++];
    if (byte === undefined) throw new RangeError("BPS ends inside a number");
    value += (byte & 0x7f) * shift;
    if (byte & 0x80) return value;
    shift *= 128;
    value += shift;
  }
};

/**
 * The bytes a BPS patch writes whatever the source ROM: its TargetRead
 * runs, and its TargetCopy runs of bytes so known. A SourceRead or
 * SourceCopy byte comes from the base ROM, which the tracker never has, so
 * it stays unknown. Throws on bytes that are no BPS.
 * @returns The target's bytes and which of them are known
 */
export const bpsTarget = (
  patch: Uint8Array,
): { readonly bytes: Uint8Array; readonly known: Uint8Array } => {
  if (
    patch.length < 16 ||
    String.fromCharCode(...patch.subarray(0, 4)) !== "BPS1"
  ) {
    throw new RangeError("Not a BPS patch");
  }
  const at = { i: 4 };
  varint(patch, at); // source size
  const size = varint(patch, at);
  const metadata = varint(patch, at);
  at.i += metadata;
  if (size > 0x80_0000) throw new RangeError("BPS target too large");
  const bytes = new Uint8Array(size);
  const known = new Uint8Array(size);
  let out = 0;
  let targetRelative = 0;
  const end = patch.length - 12;
  while (at.i < end) {
    const data = varint(patch, at);
    const command = data & 3;
    const length = (data >>> 2) + 1;
    if (out + length > size) throw new RangeError("BPS writes past its target");
    if (command === 0) {
      out += length;
    } else if (command === 1) {
      bytes.set(patch.subarray(at.i, at.i + length), out);
      known.fill(1, out, out + length);
      at.i += length;
      out += length;
    } else if (command === 2) {
      varint(patch, at);
      out += length;
    } else {
      const offset = varint(patch, at);
      targetRelative += (offset & 1 ? -1 : 1) * Math.floor(offset / 2);
      for (let k = 0; k < length; k++) {
        bytes[out] = bytes[targetRelative];
        known[out] = known[targetRelative];
        out++;
        targetRelative++;
      }
    }
  }
  return { bytes, known };
};

/** The settings' ranges a patch may hold, by id: those in the ROM. */
const ROM_RANGES = (Object.keys(MEMORY_RANGE) as MemoryRangeId[]).filter(
  (id) => MEMORY_RANGE[id].address < 0xe0_0000,
);

/**
 * A DR seed's settings from its patch: the ROM decoder over the bytes the
 * patch writes, as outside Race Mode, a range whose bytes it does not all
 * write left unread. Null for bytes that are no BPS, or a patch of no DR
 * seed (its title not DR's or OWR's).
 */
export const bpsReading = (patch: Uint8Array): SeedSettingsReading | null => {
  let target: ReturnType<typeof bpsTarget>;
  try {
    target = bpsTarget(patch);
  } catch {
    return null;
  }
  const { bytes, known: knownBytes } = target;
  const view: MemoryView = {
    bytes: (id) => {
      const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
      return bytes.subarray(address, address + size);
    },
    has: (id) => {
      if (!(ROM_RANGES as readonly string[]).includes(id)) return false;
      const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
      if (address + size > bytes.length) return false;
      return knownBytes.subarray(address, address + size).every((b) => b === 1);
    },
  };
  const reading = decodeSeedSettings(view, { race: false });
  return reading.randomizer?.kind === "door" ? reading : null;
};

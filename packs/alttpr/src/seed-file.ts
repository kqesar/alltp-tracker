// A seed's settings, read from the file alttpr.com keeps for it: the one its
// seed page loads to patch a ROM in the browser. vt writes it at generation
// (app/Jobs/SendPatchToDisk.php:33-90 at 219fcafd) to a bucket any origin may
// read; alttpr.com's own `/hash/{hash}` route serves it without CORS.
//
// The file holds the seed's patch beside its spoiler. The tracker downloads
// the whole file and reads `hash` and `spoiler.meta` alone: no schema here
// names the patch. A tournament seed's spoiler keeps only its meta
// (SendPatchToDisk.php:46-67); a Mystery one (`spoilers` "mystery") keeps
// none of its settings but the logic (:51-62), and each one then reads as
// hidden by the seed, "mystery", never as a value vt does not write.
//
// What meta says (World.php:991-1017): `mode`, `goal`, `weapons`, `logic`,
// `dungeon_items`, `item_placement`, `accessibility`, `item_pool` and
// `item_functionality` are the world's config; `entry_crystals_tower` and
// `entry_crystals_ganon` are the options the seed was asked for, as strings
// ("random" when it was asked for random crystals, whose counts the file
// drops: SendPatchToDisk.php:41-44). A value vt never writes leaves that
// setting unrecognized, as the ROM decoder does (autotrack/seed-settings.ts):
// nothing is guessed.
//
// Zod is this module's alone: the app loads it only as it asks for a file,
// and finds a seed's hash and file through seed-link.ts.

import * as z from "zod/mini";
import {
  known,
  MYSTERY,
  type SeedSetting,
  type SeedSettingsReading,
  UNRECOGNIZED,
} from "./autotrack/seed-settings";
import { SEED_HASH } from "./seed-link";

/** One of the values vt writes, or null for anything else or nothing. */
const oneOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.catch(z.nullable(z.enum(values)), null);

const CRYSTALS = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;

const SEED_FILE = z.object({
  hash: z.string().check(z.regex(SEED_HASH)),
  spoiler: z.object({
    meta: z.object({
      // config/alttp.php:191-195
      accessibility: oneOf(["items", "locations", "none"]),
      // config/alttp.php:185-190
      dungeon_items: oneOf(["standard", "mc", "mcs", "full"]),
      // config/alttp.php:205-226
      entry_crystals_ganon: oneOf(CRYSTALS),
      entry_crystals_tower: oneOf(CRYSTALS),
      // config/alttp.php:196-204
      goal: oneOf([
        "ganon",
        "fast_ganon",
        "dungeons",
        "pedestal",
        "triforce-hunt",
        "ganonhunt",
        "completionist",
      ]),
      // World.php:216-259
      item_functionality: oneOf(["normal", "hard", "expert", "superexpert"]),
      // config/alttp.php:181-184
      item_placement: oneOf(["advanced", "basic"]),
      // World.php:171-214
      item_pool: oneOf([
        "normal",
        "hard",
        "expert",
        "superexpert",
        "crowd_control",
      ]),
      // World.php:1292-1324, the logics with a seed type
      logic: oneOf(["NoGlitches", "OverworldGlitches", "MajorGlitches"]),
      // config/alttp.php:227-232
      mode: oneOf(["open", "standard", "inverted", "retro"]),
      // RandomizerController.php:118-123
      spoilers: oneOf(["on", "off", "generate", "mystery"]),
      tournament: z.catch(z.boolean(), false),
      // config/alttp.php:260-265
      weapons: oneOf(["randomized", "assured", "vanilla", "swordless"]),
    }),
  }),
});

/** A value of the file's as a setting: unrecognized when it is null. */
const setting = <T>(value: T | null): SeedSetting<T> =>
  value === null ? UNRECOGNIZED : known(value);

/** What `dungeon_items` lets out of the dungeons (World.php:111-129). */
const WILD = {
  full: { bigKeys: true, compasses: true, keys: true, maps: true },
  mc: { bigKeys: false, compasses: true, keys: false, maps: true },
  mcs: { bigKeys: false, compasses: true, keys: true, maps: true },
  standard: { bigKeys: false, compasses: false, keys: false, maps: false },
} as const;

/**
 * A seed's settings from its file, in the ROM decoder's terms, so the
 * tracker weighs both alike. Null when the file is not one vt writes.
 * @param json - The file, parsed: untrusted
 */
export const seedFileReading = (json: unknown): SeedSettingsReading | null => {
  const file = SEED_FILE.safeParse(json);
  if (!file.success) return null;
  const { meta } = file.data.spoiler;
  // A Mystery seed's file hides every setting but the logic
  if (meta.tournament && meta.spoilers === "mystery") {
    return {
      accessibility: MYSTERY,
      crystalsGanon: MYSTERY,
      crystalsTower: MYSTERY,
      goal: MYSTERY,
      itemFunctionality: MYSTERY,
      itemPlacement: MYSTERY,
      itemPool: MYSTERY,
      logic: setting(meta.logic),
      mode: MYSTERY,
      seed: file.data.hash,
      swordless: MYSTERY,
      wildBigKeys: MYSTERY,
      wildCompasses: MYSTERY,
      wildKeys: MYSTERY,
      wildMaps: MYSTERY,
    };
  }
  const wild = meta.dungeon_items === null ? null : WILD[meta.dungeon_items];
  const crystals = (count: string | null) =>
    setting(count === null ? null : Number(count));
  return {
    accessibility: setting(meta.accessibility),
    crystalsGanon: crystals(meta.entry_crystals_ganon),
    crystalsTower: crystals(meta.entry_crystals_tower),
    goal: setting(meta.goal),
    itemFunctionality: setting(meta.item_functionality),
    itemPlacement: setting(meta.item_placement),
    itemPool: setting(meta.item_pool),
    logic: setting(meta.logic),
    mode: setting(meta.mode),
    seed: file.data.hash,
    swordless: setting(
      meta.weapons === null ? null : meta.weapons === "swordless",
    ),
    wildBigKeys: setting(wild?.bigKeys ?? null),
    wildCompasses: setting(wild?.compasses ?? null),
    wildKeys: setting(wild?.keys ?? null),
    wildMaps: setting(wild?.maps ?? null),
  };
};

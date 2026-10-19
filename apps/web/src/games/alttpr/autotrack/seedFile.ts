// A seed's settings from the file alttpr.com keeps for it (the pack's
// seed-file.ts reads it): for a seed autotracking reads, the settings its ROM
// does not state (all but its name and logic for a race seed; item placement,
// accessibility and the item pool and functionality for any), and for a seed
// the player names by its link.
//
// The file comes from alttpr.com's bucket, which any origin may read. It
// holds the seed's patch too, downloaded with the rest and never read.

import {
  type SeedSetting,
  type SeedSettingsReading,
  seedFileUrl,
} from "@alltp/pack-alttpr";

/** Why a seed's file gave no settings. */
export type SeedFileError =
  /** alttpr.com could not be reached. */
  | "offline"
  /** It has no file for this hash. */
  | "not-found"
  /** The file is not one vt writes. */
  | "unrecognized";

/** A seed's file: its settings, or why there are none. */
export type SeedFileResult = SeedSettingsReading | SeedFileError;

const fetchSeedFile = async (hash: string): Promise<SeedFileResult> => {
  // The parser loads beside the file
  const parser = import("@/games/alttpr/autotrack/seedFileReading");
  parser.catch(() => {});
  let response: Response;
  try {
    response = await fetch(seedFileUrl(hash));
  } catch {
    return "offline";
  }
  // The bucket answers 403 for a key it does not hold
  if (response.status === 403 || response.status === 404) return "not-found";
  if (!response.ok) return "offline";
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return "unrecognized";
  }
  let read: typeof import("@/games/alttpr/autotrack/seedFileReading");
  try {
    read = await parser;
  } catch {
    // Its chunk could not be fetched either
    return "offline";
  }
  const reading = read.seedFileReading(json);
  return reading === null || reading.seed !== hash ? "unrecognized" : reading;
};

/** Each seed's file, asked once: a seed's settings never change. */
const files = new Map<string, Promise<SeedFileResult>>();

/**
 * A seed's settings, from its file: fetched once per page, but asked again
 * after alttpr.com could not be reached.
 * @param hash - The seed's hash (`seedHashOf`)
 */
export const loadSeedFile = (hash: string): Promise<SeedFileResult> => {
  let file = files.get(hash);
  if (file === undefined) {
    file = fetchSeedFile(hash).then((result) => {
      if (result === "offline") files.delete(hash);
      return result;
    });
    files.set(hash, file);
  }
  return file;
};

/** Forget the files asked. For tests. */
export const forgetSeedFiles = () => files.clear();

/** The ROM's setting when it states one, else the file's. */
const take = <S extends SeedSetting<unknown> | undefined>(
  rom: S,
  file: S,
): S => (rom?.known || file === undefined ? rom : file);

/**
 * The ROM's settings, each one it does not state (Race Mode kept it, it was
 * not read, no ROM table holds it) taken from the seed's file. The ROM's
 * stand when the file is another seed's.
 * @param rom - What the ROM said
 * @param file - What the seed's file says
 */
export const withSeedFile = (
  rom: SeedSettingsReading,
  file: SeedSettingsReading,
): SeedSettingsReading =>
  file.seed !== rom.seed
    ? rom
    : {
        accessibility: take(rom.accessibility, file.accessibility),
        crystalsGanon: take(rom.crystalsGanon, file.crystalsGanon),
        crystalsTower: take(rom.crystalsTower, file.crystalsTower),
        entrances: take(rom.entrances, file.entrances),
        goal: take(rom.goal, file.goal),
        itemFunctionality: take(rom.itemFunctionality, file.itemFunctionality),
        itemPlacement: take(rom.itemPlacement, file.itemPlacement),
        itemPool: take(rom.itemPool, file.itemPool),
        logic: take(rom.logic, file.logic),
        mode: take(rom.mode, file.mode),
        seed: rom.seed,
        swordless: take(rom.swordless, file.swordless),
        wildBigKeys: take(rom.wildBigKeys, file.wildBigKeys),
        wildCompasses: take(rom.wildCompasses, file.wildCompasses),
        wildKeys: take(rom.wildKeys, file.wildKeys),
        wildMaps: take(rom.wildMaps, file.wildMaps),
      };

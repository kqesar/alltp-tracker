// A Door Randomizer seed's settings, from where the site that rolled it
// keeps them (the pack's door-rando/seed-import.ts): an avianart permalink's
// JSON, or a Hyrule Town Hall seed's patch. Both sites let any origin read
// them. Both hold the seed's item placements too (the permalink its patch
// and spoiler, the patch the ROM), so nothing is asked in Race Mode: the
// form says so instead (SeedImport).

import {
  avianartReading,
  avianartUrl,
  bpsReading,
  type DoorSeedLink,
  type SeedSettingsReading,
} from "@alltp/pack-alttpr";

/** Why a DR seed gave no settings. */
export type DoorSeedError =
  /** The site could not be reached. */
  | "offline"
  /** It has no seed there. */
  | "not-found"
  /** What it gave is not a DR seed the tracker reads. */
  | "unrecognized";

/** The most a patch may weigh: a 2 MiB ROM's, well over. */
const PATCH_BYTES = 8 * 1024 * 1024;

const fetchDoorSeed = async (
  link: DoorSeedLink,
): Promise<SeedSettingsReading | DoorSeedError> => {
  let response: Response;
  try {
    response = await fetch(
      link.site === "avianart" ? avianartUrl(link.hash) : link.url,
    );
  } catch {
    return "offline";
  }
  if (response.status === 404) return "not-found";
  if (!response.ok) return "offline";
  try {
    if (link.site === "avianart") {
      return avianartReading(await response.json(), link.hash) ?? "not-found";
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > PATCH_BYTES) return "unrecognized";
    return bpsReading(bytes) ?? "unrecognized";
  } catch {
    return "unrecognized";
  }
};

/** Each seed asked once: its settings never change. */
const seeds = new Map<string, Promise<SeedSettingsReading | DoorSeedError>>();

/**
 * A DR seed's settings: fetched once per page, but asked again after the
 * site could not be reached.
 */
export const loadDoorSeed = (
  link: DoorSeedLink,
): Promise<SeedSettingsReading | DoorSeedError> => {
  const key = link.site === "avianart" ? link.hash : link.url;
  let seed = seeds.get(key);
  if (seed === undefined) {
    seed = fetchDoorSeed(link).then((result) => {
      if (result === "offline") seeds.delete(key);
      return result;
    });
    seeds.set(key, seed);
  }
  return seed;
};

/** Forget the seeds asked. For tests. */
export const forgetDoorSeeds = () => seeds.clear();

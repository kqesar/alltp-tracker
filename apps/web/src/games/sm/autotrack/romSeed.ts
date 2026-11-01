// Whether the Map Rando ROM connected is the run's seed (games/seedId.ts):
// its seed name against the run's, outside Race Mode, which never reads it
// (the pack's race profile, `seed`). The name lies in bank $DF at $DF:FEF0,
// null-terminated (Map Rando patches/rom_map/Bank DF.txt; the pack's
// decode.ts, `decodeSeed`).

import { checkRomSeed } from "@/games/seedId";
import type { SmReading } from "@/games/sm/autotrack/reading";

/** The seed a reading's ROM names: Map Rando's seed name, null if none. */
export const smRomSeedName = (reading: SmReading): string | null =>
  typeof reading.seed === "string" ? null : reading.seed.name;

/**
 * What a reading's ROM says of the run's seed.
 * @param reading - The reading
 * @param run - The run's seed, null while unknown
 */
export const smRomSeedCheck = (reading: SmReading, run: string | null) =>
  checkRomSeed(run, smRomSeedName(reading), reading.race);

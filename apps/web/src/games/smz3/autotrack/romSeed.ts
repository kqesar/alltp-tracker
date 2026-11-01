// Whether the SMZ3 ROM connected is the run's seed (games/seedId.ts): its
// guid against the run's, outside Race Mode, which never reads it (the pack's
// race profile, `seed-guid`). The guid is 32 ASCII hex digits at $80:FF60
// (tewtal/SMZ3Randomizer Patch.cs:590-612; the pack's memory.ts).

import { checkRomSeed } from "@/games/seedId";
import type { Smz3Reading } from "@/games/smz3/autotrack/reading";

/** The seed a reading's ROM names: its guid, null if not read. */
export const smz3RomSeedName = (reading: Smz3Reading): string | null =>
  typeof reading.guid === "string" ? null : reading.guid.guid;

/** A guid is hex: its case says nothing. */
export const sameGuid = (run: string, rom: string) =>
  run.toLowerCase() === rom.toLowerCase();

/**
 * What a reading's ROM says of the run's seed.
 * @param reading - The reading
 * @param run - The run's seed, null while unknown
 */
export const smz3RomSeedCheck = (reading: Smz3Reading, run: string | null) =>
  checkRomSeed(run, smz3RomSeedName(reading), reading.race, sameGuid);

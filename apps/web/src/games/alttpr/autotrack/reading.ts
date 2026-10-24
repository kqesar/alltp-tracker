// What the tracker read of the game: the pack's decoders run over a memory
// snapshot, kept as plain data for the autotracking store. Applying it to the
// tracker's own state is the store's job, not this module's.

import {
  decodeChecks,
  decodeEntrances,
  decodeItems,
  decodePrizes,
  decodeProgress,
  decodeSeedSettings,
  type EntranceReading,
  type ItemReading,
  type MemoryView,
  type PrizeReading,
  type ProgressReading,
  type SeedSettingsReading,
  type Unsettled,
} from "@alltp/pack-alttpr";

export type AutotrackReading = {
  /** When memory was read, in ms since the epoch. */
  readonly at: number;
  /** Race Mode was on: what it withholds was neither read nor decoded. */
  readonly race: boolean;
  readonly items: ItemReading;
  /** The locations checked, by the pack's location id, in the pack's order. */
  readonly checked: readonly string[];
  /** The locations memory could not settle, with why. */
  readonly unsettled: readonly (readonly [id: string, why: Unsettled])[];
  readonly progress: ProgressReading;
  /**
   * The dungeon prizes the game shows, outside Race Mode: a finished
   * dungeon's, and those the world map draws. No other prize is kept.
   */
  readonly prizes: PrizeReading;
  /**
   * The door or hole Link last went in by and the door he last came out
   * by, outside Race Mode: the game's numbers, which the entrance tables
   * name (`linksOf`).
   */
  readonly entrances: EntranceReading;
  /** The seed's name and settings, from its ROM. */
  readonly seed: SeedSettingsReading;
};

/**
 * Decode a snapshot.
 * @param memory - The session's snapshot
 * @param race - Whether Race Mode is on: the decoders then never ask for a
 * forbidden range and withhold dungeon checks
 * @param at - When it was read
 */
export const readMemory = (
  memory: MemoryView,
  race: boolean,
  at: number,
): AutotrackReading => {
  const options = { race };
  const checks = decodeChecks(memory, options);
  return {
    at,
    checked: [...checks.checked],
    entrances: decodeEntrances(memory, options),
    items: decodeItems(memory, options),
    prizes: decodePrizes(memory, options),
    progress: decodeProgress(memory, options),
    race,
    seed: decodeSeedSettings(memory, options),
    unsettled: [...checks.unsettled],
  };
};

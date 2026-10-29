// What the tracker read of the game: the pack's decoders run over a memory
// snapshot, kept as plain data for the autotracking store. Applying it to the
// tracker's own state is the store's job, not this module's.

import {
  type BossReading,
  type BottlesReading,
  type CapacitiesReading,
  decodeBosses,
  decodeBottles,
  decodeCapacities,
  decodeChecks,
  decodeEntrances,
  decodeGoalPieces,
  decodeHealth,
  decodeItems,
  decodeMedallions,
  decodePrizes,
  decodePrizesHeld,
  decodeProgress,
  decodeSeedSettings,
  type EntranceReading,
  type HealthReading,
  type ItemReading,
  type MedallionReading,
  type MemoryView,
  type PrizeReading,
  type PrizesHeldReading,
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
  /**
   * What each bottle Link holds contains (`decodeBottles`), Race Mode or not:
   * v2.0 lists the bottle contents among the HUD's counts.
   */
  readonly bottles: BottlesReading;
  /**
   * How many bombs and arrows Link can hold (`decodeCapacities`), outside
   * Race Mode: v2.0 does not name the capacity upgrades.
   */
  readonly capacities: CapacitiesReading;
  /** The locations checked, by the pack's location id, in the pack's order. */
  readonly checked: readonly string[];
  /** The locations memory could not settle, with why. */
  readonly unsettled: readonly (readonly [id: string, why: Unsettled])[];
  readonly progress: ProgressReading;
  /** Link's hearts on screen (`decodeHealth`), Race Mode or not. */
  readonly health: HealthReading;
  /**
   * The Triforce pieces Link holds (`decodeGoalPieces`), Race Mode or not:
   * v2.0 lists them among the items.
   */
  readonly pieces: number | Unsettled;
  /**
   * The pendants and crystals Link took, by class (`decodePrizesHeld`), Race
   * Mode or not: the crystals counted, never told 5/6 or not.
   */
  readonly held: PrizesHeldReading;
  /**
   * The dungeon prizes the game shows, outside Race Mode: a finished
   * dungeon's, and those the world map draws. No other prize is kept.
   */
  readonly prizes: PrizeReading;
  /**
   * The medallions Misery Mire and Turtle Rock ask for that the game shows,
   * outside Race Mode: those of a pad whose screen is in view, or whose
   * entrance is open. No other medallion is kept.
   */
  readonly medallions: MedallionReading;
  /**
   * The bosses the game shows, outside Race Mode: a dungeon's, while Link
   * stands in its boss room with it. No other boss is kept, and the ROM's
   * table of them is never read.
   */
  readonly bosses: BossReading;
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
 * forbidden range and withhold what the race rules keep from a race
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
    bosses: decodeBosses(memory, options),
    bottles: decodeBottles(memory, options),
    capacities: decodeCapacities(memory, options),
    checked: [...checks.checked],
    entrances: decodeEntrances(memory, options),
    health: decodeHealth(memory, options),
    held: decodePrizesHeld(memory, options),
    items: decodeItems(memory, options),
    medallions: decodeMedallions(memory, options),
    pieces: decodeGoalPieces(memory, options),
    prizes: decodePrizes(memory, options),
    progress: decodeProgress(memory, options),
    race,
    seed: decodeSeedSettings(memory, options),
    unsettled: [...checks.unsettled],
  };
};

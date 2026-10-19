// What the tracker read of an SMZ3 game: the pack's decoders run over a
// memory snapshot, kept as plain data for the autotracking store.

import {
  decodeChecks,
  decodeInPlay,
  decodeItems,
  decodeMode,
  decodeRequirements,
  decodeSeed,
  type MemoryView,
  type RequirementsReading,
  type SeedReading,
  type Smz3Mode,
  type Unsettled,
} from "@alltp/pack-smz3";

export type Smz3Reading = {
  /** When memory was read, in ms since the epoch. */
  readonly at: number;
  /** Race Mode was on: the requirements were neither read nor decoded. */
  readonly race: boolean;
  /** Which game runs. */
  readonly mode: Smz3Mode | Unsettled;
  /** The running game is in play: the saves hold the run. */
  readonly inPlay: boolean | Unsettled;
  /** Both games' items held, by the pack's item id. */
  readonly items: Readonly<Record<string, number>> | Unsettled;
  /** The locations checked, by the pack's location id. */
  readonly checked: readonly string[] | Unsettled;
  readonly seed: SeedReading | Unsettled;
  readonly requirements: RequirementsReading | Unsettled;
};

/**
 * Decode a snapshot.
 * @param memory - The session's snapshot
 * @param race - Whether Race Mode is on: the requirements stay unread
 * @param at - When it was read
 */
export const readSmz3 = (
  memory: MemoryView,
  race: boolean,
  at: number,
): Smz3Reading => ({
  at,
  checked: decodeChecks(memory),
  inPlay: decodeInPlay(memory),
  items: decodeItems(memory),
  mode: decodeMode(memory),
  race,
  requirements: decodeRequirements(memory, race),
  seed: decodeSeed(memory),
});

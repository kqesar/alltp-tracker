// What the tracker read of a Map Rando game: the pack's decoders run over a
// memory snapshot, kept as plain data for the autotracking store.

import {
  decodeInPlay,
  decodeItems,
  decodeObjectives,
  decodeSeed,
  type MemoryView,
  type ObjectiveReading,
  type SeedReading,
  type SmItemId,
  type Unsettled,
} from "@alltp/pack-sm";

export type SmReading = {
  /** When memory was read, in ms since the epoch. */
  readonly at: number;
  /** A game is in play: the items held are the run's. */
  readonly inPlay: boolean | Unsettled;
  readonly items: Readonly<Record<SmItemId, number>> | Unsettled;
  /** The seed's objectives in the pause screen's order, each done or not. */
  readonly objectives: readonly ObjectiveReading[] | Unsettled;
  readonly seed: SeedReading | Unsettled;
};

/**
 * Decode a snapshot.
 * @param memory - The session's snapshot
 * @param at - When it was read
 */
export const readSm = (memory: MemoryView, at: number): SmReading => ({
  at,
  inPlay: decodeInPlay(memory),
  items: decodeItems(memory),
  objectives: decodeObjectives(memory),
  seed: decodeSeed(memory),
});

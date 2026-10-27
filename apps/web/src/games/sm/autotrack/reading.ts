// What the tracker read of a Map Rando game: the pack's decoders run over a
// memory snapshot, kept as plain data for the autotracking store.

import {
  type ClockReading,
  decodeBeforePlay,
  decodeBossKills,
  decodeCollected,
  decodeGameClock,
  decodeGoal,
  decodeInPlay,
  decodeItems,
  decodeObjectives,
  decodeSeed,
  type LocationKey,
  type MemoryView,
  type ObjectiveReading,
  type SeedReading,
  type SmItemId,
  type Unsettled,
} from "@alltp/pack-sm";

export type SmReading = {
  /** When memory was read, in ms since the epoch. */
  readonly at: number;
  /**
   * Race Mode was on: of the objectives, only the boss flags were read
   * (`bossKills`), and neither the seed's settings, the clock nor the
   * locations.
   */
  readonly race: boolean;
  /**
   * The objectives a boss kill completes that the game says done, whatever
   * the seed asks for: what Race Mode reads of the objectives.
   */
  readonly bossKills: readonly string[] | Unsettled;
  /** The game is before play (title, menus, file select, loading a game). */
  readonly beforePlay: boolean | Unsettled;
  /**
   * Map Rando's RTA clock. Never read in Race Mode (the pack's race profile):
   * then, like before it is read, not known.
   */
  readonly clock: ClockReading | Unsettled;
  /** Mother Brain is dead and Samus is in the ship. */
  readonly goal: boolean | Unsettled;
  /**
   * The item locations collected (the Nothing ones left out by the decoder).
   * Never read in Race Mode (the pack's race profile): then, like before it
   * is read, not known.
   */
  readonly collected: ReadonlySet<LocationKey> | Unsettled;
  /** A game is in play: the items held are the run's. */
  readonly inPlay: boolean | Unsettled;
  readonly items: Readonly<Record<SmItemId, number>> | Unsettled;
  /**
   * The seed's objectives in the pause screen's order, each done or not.
   * Never read in Race Mode: the player sets them.
   */
  readonly objectives: readonly ObjectiveReading[] | Unsettled;
  readonly seed: SeedReading | Unsettled;
};

/**
 * Decode a snapshot.
 * @param memory - The session's snapshot
 * @param at - When it was read
 * @param race - Whether Race Mode was on as the session read it (which ranges
 * it read follows from it)
 */
export const readSm = (
  memory: MemoryView,
  at: number,
  race = false,
): SmReading => ({
  at,
  beforePlay: decodeBeforePlay(memory),
  bossKills: decodeBossKills(memory),
  clock: decodeGameClock(memory),
  collected: decodeCollected(memory),
  goal: decodeGoal(memory),
  inPlay: decodeInPlay(memory),
  items: decodeItems(memory),
  objectives: decodeObjectives(memory),
  race,
  seed: decodeSeed(memory),
});

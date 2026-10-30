// What a player notes of an Overworld Randomizer run's shuffled overworld
// (the store's `overworld`, `OverworldNotes`): a change laid on the notes,
// one undo step. Whirlpools pair both ways, as the fork links them
// (connect_whirlpool, OverworldShuffle.py:359-367): noting one notes its
// partner's way back and forgets what either led to before. A crossed
// overworld's edge pairs are noted one at a time, crossing or staying, and
// Mixed's screens flipped or standing (the tab notes a group at once).
import type { OverworldNotes } from "@/games/alttpr/stores/persistence";

/** A change of the notes: whirlpools set or forgotten, the flute's spots. */
export type OverworldNotesChange = {
  /** Each whirlpool to the one it leads into, or forgotten (`null`). */
  readonly whirlpools?: Readonly<Record<string, string | null>>;
  /** The screens a flute spot stands on, all of them (the list replaced). */
  readonly flute?: readonly number[];
  /**
   * Each crossable edge pair (`OWR_CROSSINGS`, by its first edge): true
   * where it crosses into the other world, false where it stays, `null`
   * forgotten.
   */
  readonly crossings?: Readonly<Record<string, boolean | null>>;
  /**
   * Each screen Mixed may flip (`OWR_FLIP_SCREENS`, by its id): true where
   * flipped, false where it stands, `null` forgotten.
   */
  readonly flips?: Readonly<Record<string, boolean | null>>;
};

/** A table's entries in a stable order, so the same notes compare equal. */
const sortedOf = <T>(
  table: Readonly<Record<string, T>>,
  numeric = false,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(table).sort(([a], [b]) =>
      numeric ? Number(a) - Number(b) : a.localeCompare(b),
    ),
  );

/**
 * The notes with a change laid on them: the same object when nothing
 * moves, a table emptied left out.
 */
export const withOverworldNotes = (
  notes: OverworldNotes,
  change: OverworldNotesChange,
): OverworldNotes => {
  const pools: Record<string, string> = { ...notes.whirlpools };
  for (const [from, to] of Object.entries(change.whirlpools ?? {})) {
    // Whatever either led to before is forgotten both ways
    for (const end of [from, to])
      if (end !== null) {
        const old = pools[end];
        if (old !== undefined) delete pools[old];
        delete pools[end];
      }
    if (to !== null) {
      pools[from] = to;
      pools[to] = from;
    }
  }
  const flute =
    change.flute === undefined ? notes.flute : [...new Set(change.flute)];
  const crossings: Record<string, boolean> = { ...notes.crossings };
  for (const [edge, crosses] of Object.entries(change.crossings ?? {}))
    if (crosses === null) delete crossings[edge];
    else crossings[edge] = crosses;
  const sortedCrossings = sortedOf(crossings);
  const flips: Record<string, boolean> = { ...notes.flips };
  for (const [screen, flipped] of Object.entries(change.flips ?? {}))
    if (flipped === null) delete flips[screen];
    else flips[screen] = flipped;
  const sortedFlips = sortedOf(flips, true);
  // The whirlpools in name order, so the same pairs are the same notes
  const sorted = Object.fromEntries(
    Object.entries(pools).sort(([a], [b]) => a.localeCompare(b)),
  );
  const next: OverworldNotes = {
    ...(Object.keys(sorted).length === 0 ? {} : { whirlpools: sorted }),
    ...(flute === undefined || flute.length === 0 ? {} : { flute }),
    ...(Object.keys(sortedCrossings).length === 0
      ? {}
      : { crossings: sortedCrossings }),
    ...(Object.keys(sortedFlips).length === 0 ? {} : { flips: sortedFlips }),
  };
  const before: OverworldNotes = {
    ...(notes.whirlpools === undefined
      ? {}
      : {
          whirlpools: Object.fromEntries(
            Object.entries(notes.whirlpools).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          ),
        }),
    ...(notes.flute === undefined ? {} : { flute: notes.flute }),
    ...(notes.crossings === undefined
      ? {}
      : { crossings: sortedOf(notes.crossings) }),
    ...(notes.flips === undefined
      ? {}
      : { flips: sortedOf(notes.flips, true) }),
  };
  return JSON.stringify(next) === JSON.stringify(before) ? notes : next;
};

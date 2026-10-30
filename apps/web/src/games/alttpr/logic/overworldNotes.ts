// What a player notes of an Overworld Randomizer run's shuffled overworld
// (the store's `overworld`, `OverworldNotes`): a change laid on the notes,
// one undo step. Whirlpools pair both ways, as the fork links them
// (connect_whirlpool, OverworldShuffle.py:359-367): noting one notes its
// partner's way back and forgets what either led to before.
import type { OverworldNotes } from "@/games/alttpr/stores/persistence";

/** A change of the notes: whirlpools set or forgotten, the flute's spots. */
export type OverworldNotesChange = {
  /** Each whirlpool to the one it leads into, or forgotten (`null`). */
  readonly whirlpools?: Readonly<Record<string, string | null>>;
  /** The screens a flute spot stands on, all of them (the list replaced). */
  readonly flute?: readonly number[];
};

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
  // The whirlpools in name order, so the same pairs are the same notes
  const sorted = Object.fromEntries(
    Object.entries(pools).sort(([a], [b]) => a.localeCompare(b)),
  );
  const next: OverworldNotes = {
    ...(Object.keys(sorted).length === 0 ? {} : { whirlpools: sorted }),
    ...(flute === undefined || flute.length === 0 ? {} : { flute }),
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
  };
  return JSON.stringify(next) === JSON.stringify(before) ? notes : next;
};

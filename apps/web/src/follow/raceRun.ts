// What the desktop app relays of the run in Race Mode (docs/desktop.md, "Live
// follow on the LAN"): the run cut to what the relayed views draw, the grid
// and its timer, every other field at a fresh run's value. Outside Race Mode
// the saved run goes as it is. A device following, or an OBS source, then
// holds nothing a race keeps back (the places checked and their times, the
// entrances noted, the seed, the locations found), whatever it does with the
// bytes it gets.

import type { RaceSource } from "@/autotrack/raceMode";

/** A game's side of the relay in Race Mode. */
export type RaceFeed = {
  /** The game's Race Mode. */
  readonly source: RaceSource;
  /**
   * The saved run (persist's `{state, version}` JSON) cut to the whitelist,
   * or null when it does not read as one: nothing is then sent.
   */
  readonly run: (saved: string) => string | null;
};

/**
 * A game's race feed.
 * @param fresh - The persisted state of a fresh run: every field the
 * whitelist leaves out takes its value
 * @param kept - The fields the relayed views draw
 * @param cut - What the game takes out of a kept field still: a value no
 * view draws that a race keeps back (ALttPR's escape, in its items)
 * @param source - The game's Race Mode
 */
export const raceFeed = ({
  cut = (state) => state,
  fresh,
  kept,
  source,
}: {
  cut?: (state: Record<string, unknown>) => Record<string, unknown>;
  fresh: () => object;
  kept: readonly string[];
  source: RaceSource;
}): RaceFeed => ({
  run: (saved) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch {
      return null;
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const { state: savedState } = parsed as { state?: unknown };
    if (typeof savedState !== "object" || savedState === null) return null;
    const state: Record<string, unknown> = { ...fresh() };
    for (const key of kept) {
      if (key in savedState) {
        state[key] = (savedState as Record<string, unknown>)[key];
      }
    }
    return JSON.stringify({ ...parsed, state: cut(state) });
  },
  source,
});

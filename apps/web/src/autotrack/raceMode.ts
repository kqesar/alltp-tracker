// Whether Race Mode is on for this device, one answer for everything that asks:
// the seed import (a race asks alttpr.com for nothing), the spoiler review
// (a race keeps its spoiler closed), Export and Share, the overlay API, live
// follow and the Run tab's timeline. It reads the fields every game's
// autotracking store has (`autotrack/gameSession.ts`).
//
// A race is remembered. Once autotracking has read the seed as a race's, the
// run stays in Race Mode (`raceSeen`, saved with the player's other
// autotracking choices) through a Disconnect, the end of the session and a
// reload: a tracker that forgot at Disconnect would hand out the places
// checked, and when, in the middle of the race. What ends it is the run
// itself being replaced (New game, Import, a shared link: `runReplaced`) or
// the player saying the race is over.

import type { SessionStatus } from "@alltp/autotrack";
import type { RaceChoice } from "@/autotrack/raceChoice";

/** The part of a game's autotracking state that tells Race Mode. */
export type RaceModeState = {
  readonly raceChoice: RaceChoice;
  /** A session runs, or is starting. */
  readonly active: boolean;
  /** The player connected last time: a session starts with the tracker. */
  readonly connectOnStart: boolean;
  /** This run's seed was read as a race's, and the race is not called over. */
  readonly raceSeen: boolean;
  readonly status: SessionStatus;
  /** The game as last read; `race` is its seed's race flag, where it has one. */
  readonly reading: { readonly race?: boolean } | null;
};

/**
 * The seed is a race's as the connected session reads it: the ROM's race flag
 * says "race". Neither a flag not yet read nor one it cannot read counts: a
 * run is remembered as a race only on this word, and a game with no race flag
 * (Map Rando) never gives it.
 */
export const seedIsRace = (state: Pick<RaceModeState, "status">): boolean =>
  state.status.code === "connected" && state.status.race.flag === "race";

/**
 * Race Mode is on when the player holds it on, the game last read says the
 * seed is a race's, the running session's status does, or a race read earlier
 * was never called over (`raceSeen`).
 */
export const isRaceModeOn = (state: RaceModeState): boolean =>
  state.raceChoice === "on" ||
  state.raceSeen ||
  state.reading?.race === true ||
  (state.active &&
    state.status.code === "connected" &&
    state.status.race.active);

/**
 * Race Mode, failing closed, for what shows or tells the run before a race
 * flag has been read: the overlay API, the run the desktop app relays, the
 * Run tab's timeline, Export and Share. On as `isRaceModeOn` has it, and also
 * while the run is autotracked or about to be (Auto, a session running or
 * starting, or set to connect as the tracker opens) and nothing has told the
 * flag yet: the desktop app's stream starts with it, before SNI answers. A
 * run tracked by hand, autotracking never started, stays as it is.
 */
export const isRaceModeOrPending = (state: RaceModeState): boolean => {
  if (isRaceModeOn(state)) return true;
  if (state.raceChoice !== "auto") return false;
  if (!state.active && !state.connectOnStart) return false;
  const told =
    state.reading !== null ||
    (state.active &&
      state.status.code === "connected" &&
      (state.status.race.flag === "open" || state.status.race.flag === "none"));
  return !told;
};

/**
 * Race Mode is on only because a race was read earlier (`raceSeen`): neither
 * the player's choice nor the session's status says so now. The Autotracking dialog says so, and offers to end it.
 */
export const isRaceHeldByMemory = (
  state: Pick<RaceModeState, "raceChoice" | "raceSeen" | "status">,
): boolean => state.raceSeen && state.raceChoice !== "on" && !seedIsRace(state);

/**
 * Remember the race as soon as the session reads the seed as one.
 * @param store - A game's autotracking store, which has `raceSeen`
 */
export const rememberRace = <
  State extends Pick<RaceModeState, "raceSeen" | "status">,
>(store: {
  getState: () => State;
  setState: (state: { raceSeen: boolean }) => void;
  subscribe: (listener: (state: State) => void) => () => void;
}) =>
  store.subscribe((state) => {
    if (!state.raceSeen && seedIsRace(state))
      store.setState({ raceSeen: true });
  });

const replacedListeners = new Set<(game: string) => void>();

/**
 * A game's run was replaced: New game, an Import, a shared link opened into
 * the tracker. The run is another's, so a race read for the last one is no
 * longer this one's. The game's store calls it; its autotracking store
 * listens (`onRunReplaced`).
 */
export const runReplaced = (game: string) => {
  for (const listener of replacedListeners) listener(game);
};

/** Call `listener` with the game's id whenever a run is replaced. */
export const onRunReplaced = (listener: (game: string) => void) => {
  replacedListeners.add(listener);
  return () => replacedListeners.delete(listener);
};

/**
 * A game's Race Mode, for what tells the run to other software or devices
 * (the overlay API, live follow): whether it is on or not yet known to be off
 * (`isRaceModeOrPending`), and a call when that answer changes.
 */
export type RaceSource = {
  readonly isOn: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
};

/** A game's Race Mode, from its autotracking store. */
export const raceSourceOf = <State extends RaceModeState>(store: {
  getState: () => State;
  subscribe: (listener: (state: State, before: State) => void) => () => void;
}): RaceSource => ({
  isOn: () => isRaceModeOrPending(store.getState()),
  subscribe: (listener) =>
    store.subscribe((state, before) => {
      if (isRaceModeOrPending(state) !== isRaceModeOrPending(before)) {
        listener();
      }
    }),
});

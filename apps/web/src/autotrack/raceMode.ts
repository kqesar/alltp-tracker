// Whether Race Mode is on for this device, one answer for everything that asks:
// the seed import (a race asks alttpr.com for nothing) and the spoiler review
// (a race keeps its spoiler closed). It reads the fields every game's
// autotracking store has (`autotrack/gameSession.ts`).

import type { SessionStatus } from "@alltp/autotrack";
import type { RaceChoice } from "@/autotrack/raceChoice";

/** The part of a game's autotracking state that tells Race Mode. */
export type RaceModeState = {
  readonly raceChoice: RaceChoice;
  /** A session runs, or is starting. */
  readonly active: boolean;
  /** The player connected last time: a session starts with the tracker. */
  readonly connectOnStart: boolean;
  readonly status: SessionStatus;
  /** The game as last read; `race` is its seed's race flag, where it has one. */
  readonly reading: { readonly race?: boolean } | null;
};

/**
 * Race Mode is on when the player holds it on, the game last read says the
 * seed is a race's, or the running session's status does.
 */
export const isRaceModeOn = (state: RaceModeState): boolean =>
  state.raceChoice === "on" ||
  state.reading?.race === true ||
  (state.active &&
    state.status.code === "connected" &&
    state.status.race.active);

/**
 * Race Mode, failing closed, for what shows or tells the run before a race
 * flag has been read: the overlay API, the run the desktop app relays, the
 * Run tab's timeline. On as `isRaceModeOn` has it, and also while the run is
 * autotracked or about to be (Auto, a session running or starting, or set
 * to connect as the tracker opens) and nothing has told the flag yet: the
 * desktop app's stream starts with it, before SNI answers. A run tracked by
 * hand, autotracking never started, stays as it is.
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

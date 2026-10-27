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
 * A game's Race Mode, for what tells the run to other software or devices
 * (the overlay API, live follow): whether it is on, and a call when it comes
 * or goes.
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
  isOn: () => isRaceModeOn(store.getState()),
  subscribe: (listener) =>
    store.subscribe((state, before) => {
      if (isRaceModeOn(state) !== isRaceModeOn(before)) listener();
    }),
});

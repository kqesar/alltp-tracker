// The run timer's part of a game's store, shared by the boards that keep one
// beside their run (Super Metroid's, SMZ3's): the fields, the actions on
// them, and how a saved run restores them. Saved with the run, but never a
// step of the history nor part of an export or a shared link.

import {
  alignTimer,
  finishTimer,
  type GameClock,
  IDLE_TIMER,
  pauseTimer,
  type RunTimer,
  restoreTimer,
  startTimer,
  type TimerClock,
} from "@/utils/runTimer";

export type TimerSlice = {
  /** The run's timer, kept apart from the history. */
  timer: RunTimer;
  /** Whether the timer starts and stops with the game, autotracking. */
  autoTimer: boolean;
  /**
   * Which clock the timer shows: real time, as races time, or the game's
   * own while autotracking reads it outside Race Mode. A save without it is
   * real time.
   */
  timerClock: TimerClock;
};

export type TimerActions = {
  /** Start the run timer, or go on from its pause, at `at` (now). */
  startTimer: (at?: number) => void;
  /** Pause the run timer at `at` (now). */
  pauseTimer: (at?: number) => void;
  /** Stop the run timer for good, the goal reached, at `at` (now). */
  finishTimer: (at?: number) => void;
  setAutoTimer: (on: boolean) => void;
  setTimerClock: (clock: TimerClock) => void;
  /**
   * Set the run timer on the game's clock as read at `at`; the timer is
   * left as it is, same object, when it is already there.
   */
  alignTimer: (clock: GameClock, at: number) => void;
};

/** A timer that has counted nothing, started and stopped by the game, on real time. */
export const freshTimerSlice = (): TimerSlice => ({
  autoTimer: true,
  timer: IDLE_TIMER,
  timerClock: "real",
});

/** A store's `set`, as far as the timer's actions need it. */
type SetTimer = (
  update: (state: TimerSlice) => Partial<TimerSlice> | TimerSlice,
) => void;

/** The timer's actions over a store's `set`. */
export const timerActions = (set: SetTimer): TimerActions => ({
  alignTimer: (clock, at) =>
    set((state) => {
      const timer = alignTimer(state.timer, clock, at);
      return timer === state.timer ? state : { timer };
    }),
  finishTimer: (at = Date.now()) =>
    set((state) => ({ timer: finishTimer(state.timer, at) })),
  pauseTimer: (at = Date.now()) =>
    set((state) => ({ timer: pauseTimer(state.timer, at) })),
  setAutoTimer: (autoTimer) => set(() => ({ autoTimer })),
  setTimerClock: (timerClock) => set(() => ({ timerClock })),
  startTimer: (at = Date.now()) =>
    set((state) => ({ timer: startTimer(state.timer, at) })),
});

/**
 * The timer's fields as a saved run restores them. They are not part of the
 * run's schema: a save made before the timer has none, a damaged one is no
 * timer.
 * @param saved - The saved state, whatever it is
 * @param current - The store's fresh fields, which stand in for a missing one
 */
export const restoreTimerSlice = (
  saved: unknown,
  current: TimerSlice,
): TimerSlice => {
  const extras =
    typeof saved === "object" && saved !== null
      ? (saved as Partial<Record<keyof TimerSlice, unknown>>)
      : {};
  return {
    autoTimer:
      typeof extras.autoTimer === "boolean"
        ? extras.autoTimer
        : current.autoTimer,
    timer: restoreTimer(extras.timer),
    timerClock:
      extras.timerClock === "game" || extras.timerClock === "real"
        ? extras.timerClock
        : current.timerClock,
  };
};

/** The fields a store saves. */
export const timerSliceOf = (state: TimerSlice): TimerSlice => ({
  autoTimer: state.autoTimer,
  timer: state.timer,
  timerClock: state.timerClock,
});

// What a game's own progress does to the run timer (`utils/runTimer.ts`)
// while autotracking reads it: pure steps over a reading's signals and the
// timer, shared by the boards that follow a game's clock (Super Metroid's,
// SMZ3's). Each game's follower applies them.

import {
  type GameClock,
  isIdle,
  isRunning,
  type RunTimer,
} from "@/utils/runTimer";

/** A signal a decoder could not give: a string such as "not-read". */
type Signal = boolean | string;

/**
 * What the game's own progress does to the timer, while the player lets it
 * start and stop with the game: start an idle timer when a reading in play
 * follows one before play (the title, the menus, the file select, the loading
 * of a game: a pause, a door or a death is no new start), stop a running one
 * once the goal is reached, a timer that never started included (the game
 * was already in play when it was connected or the run reset): the run is
 * over, untimed. `before` is whether a reading before play came before this
 * one, or undefined when none did: a tracker that connects to a game already
 * running starts nothing. `atGoal` is whether the goal was already reached at
 * the reading before, so a run reset on the credits is not ended again by it.
 */
export const timerNews = (
  before: boolean | undefined,
  reading: { readonly goal: Signal; readonly inPlay: Signal },
  timer: RunTimer,
  atGoal = false,
): "finish" | "start" | null => {
  if (reading.goal === true) {
    return isRunning(timer) || (!timer.finished && !atGoal) ? "finish" : null;
  }
  return before === true && reading.inPlay === true && isIdle(timer)
    ? "start"
    : null;
};

/**
 * The game's clock for a timer set on it: its time, and where it stands.
 * Over at the goal, if the player lets the game stop the timer; paused while
 * the counter has not moved since the reading before (the emulator paused),
 * which a timer set on it would otherwise tick past and be set back; running
 * otherwise.
 * @param moving - Whether the counter moved since the reading before
 */
export const gameClockOf = (
  ms: number,
  goal: Signal,
  moving: boolean,
  stopsAtGoal: boolean,
): GameClock => ({
  ms,
  status: goal === true && stopsAtGoal ? "over" : moving ? "running" : "paused",
});

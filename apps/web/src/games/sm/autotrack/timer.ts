// What Super Metroid's own progress does to the run timer (`utils/runTimer.ts`)
// while autotracking reads the game: pure, every step reading the reading and
// the timer only. The follower (`follow.ts`) applies them.

import { rtaFrames, rtaMs } from "@alltp/pack-sm";
import type { SmReading } from "@/games/sm/autotrack/reading";
import {
  type GameClock,
  isIdle,
  isRunning,
  type RunTimer,
  timerMs,
} from "@/utils/runTimer";

/**
 * What the game's own progress does to the timer, while the player lets it
 * start and stop with the game: start an idle timer when a reading in play
 * follows one before play (the title, the menus, the file select, the loading
 * of a game: a pause, a door or a death is no new start), stop a running one
 * once the goal is reached (Mother Brain dead and Samus in the ship). `before`
 * is whether the reading before was before play, or undefined when there was
 * none: a tracker that connects to a game already running starts nothing.
 */
export const timerNews = (
  before: boolean | undefined,
  reading: Pick<SmReading, "goal" | "inPlay">,
  timer: RunTimer,
): "finish" | "start" | null => {
  if (reading.goal === true) return isRunning(timer) ? "finish" : null;
  return before === true && reading.inPlay === true && isIdle(timer)
    ? "start"
    : null;
};

/**
 * Where the RTA clock's count since the timer's 0 puts the timer.
 * @param frames - The clock's frames now
 * @param base - The clock's frames when the timer was at 0, or null if not
 * known, or past the clock (the SRAM was set up again): then the timer's own
 * time is the point to go on from
 * @param timer - The timer, which gives that time
 * @param at - When the clock was read
 * @returns The base to keep, and the game's time since it
 */
export const clockBaseOf = (
  frames: number,
  base: number | null,
  timer: RunTimer,
  at: number,
): { base: number; ms: number } => {
  const kept =
    base !== null && base <= frames
      ? base
      : Math.max(0, frames - rtaFrames(timerMs(timer, at)));
  return { base: kept, ms: rtaMs(frames - kept) };
};

/**
 * The game's clock for a timer set on it: its time since the base, and where
 * it stands. Over at the goal, if the player lets the game stop the timer;
 * paused while the counter has not moved since the reading before (the
 * emulator paused), which a timer set on it would otherwise tick past and be
 * set back; running otherwise: the clock counts every frame, menus and lag
 * included, as the game's own end credits do.
 * @param moving - Whether the counter moved since the reading before
 */
export const gameClockOf = (
  ms: number,
  goal: boolean | "not-read",
  moving: boolean,
  stopsAtGoal: boolean,
): GameClock => ({
  ms,
  status: goal === true && stopsAtGoal ? "over" : moving ? "running" : "paused",
});

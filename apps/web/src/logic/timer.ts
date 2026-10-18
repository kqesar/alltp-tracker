// The run timer: real time from the game's start to the goal, started,
// paused and reset by the player, or by the game itself while autotracking
// reads it (`timerNews`). Pure: every step takes the instant it happens at,
// so the timer is plain data the store keeps, and what it shows is worked
// out from the clock when it is drawn.
import type { ProgressReading } from "@alltp/pack-alttpr";

/**
 * A run's timer. Running while `startedAt` holds the instant it (re)started,
 * epoch milliseconds; `elapsedMs` is the time counted before. Finished once
 * the goal stopped it.
 */
export interface RunTimer {
  readonly startedAt: number | null;
  readonly elapsedMs: number;
  readonly finished: boolean;
}

/** A timer that has not counted anything yet. */
export const IDLE_TIMER: RunTimer = {
  elapsedMs: 0,
  finished: false,
  startedAt: null,
};

/** The time a timer shows at `now`. */
export const timerMs = (timer: RunTimer, now: number): number =>
  timer.elapsedMs +
  (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt));

export const isRunning = (timer: RunTimer): boolean => timer.startedAt !== null;

/** Whether a timer has counted nothing: the one the game may start. */
export const isIdle = (timer: RunTimer): boolean =>
  timer.startedAt === null && timer.elapsedMs === 0 && !timer.finished;

/** Start a timer, or go on from its pause; a finished one stays so. */
export const startTimer = (timer: RunTimer, at: number): RunTimer =>
  isRunning(timer) || timer.finished ? timer : { ...timer, startedAt: at };

/** Pause a running timer, keeping what it counted. */
export const pauseTimer = (timer: RunTimer, at: number): RunTimer =>
  isRunning(timer)
    ? { elapsedMs: timerMs(timer, at), finished: false, startedAt: null }
    : timer;

/** Stop a timer for good: the run's time. */
export const finishTimer = (timer: RunTimer, at: number): RunTimer => ({
  elapsedMs: timerMs(timer, at),
  finished: true,
  startedAt: null,
});

/** "1:23:45", or "23:45" under an hour: the time a timer shows. */
export const formatTime = (ms: number): string => {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
};

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** A saved timer, or the idle one if it is not a timer. */
export const restoreTimer = (saved: unknown): RunTimer => {
  if (typeof saved !== "object" || saved === null) return IDLE_TIMER;
  const { elapsedMs, finished, startedAt } = saved as Record<string, unknown>;
  if (
    !isTime(elapsedMs) ||
    typeof finished !== "boolean" ||
    !(startedAt === null || isTime(startedAt)) ||
    (finished && startedAt !== null)
  ) {
    return IDLE_TIMER;
  }
  return { elapsedMs, finished, startedAt };
};

/**
 * What the game's own progress does to the timer, while the player lets it
 * start and stop with the game: start an idle timer when a reading in play
 * follows one before play (the title, the file select or the spawn select:
 * a menu during play is no new start), stop a running one once the goal is
 * reached. `before` is whether the reading before was before play, or
 * undefined when there was none.
 */
export const timerNews = (
  before: boolean | undefined,
  progress: Pick<ProgressReading, "goal" | "started">,
  timer: RunTimer,
): "finish" | "start" | null => {
  if (progress.goal === true) return isRunning(timer) ? "finish" : null;
  return before === true && progress.started === true && isIdle(timer)
    ? "start"
    : null;
};

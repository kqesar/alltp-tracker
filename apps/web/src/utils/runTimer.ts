// The run timer: real time from the start of a run to its goal, started,
// paused and reset by the player, or by the game (ALttPR's autotracking,
// `games/alttpr/logic/timer.ts`) or the room (an Archipelago countdown).
// Pure: every step takes the instant it happens at, so the timer is plain
// data a store keeps, and what it shows is worked out from the clock when it
// is drawn. Shared by every game that keeps one.

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

/** Where a timer stands, as the player sees it. */
export type TimerState = "finished" | "idle" | "paused" | "running";

/** Each state in words, for a screen reader. */
export const TIMER_WORDS: Readonly<Record<TimerState, string>> = {
  finished: "stopped",
  idle: "not started",
  paused: "paused",
  running: "running",
};

export const timerState = (timer: RunTimer): TimerState => {
  if (timer.finished) return "finished";
  if (isRunning(timer)) return "running";
  return isIdle(timer) ? "idle" : "paused";
};

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

/** The clock a timer shows, chosen by the player: how races time, or the game's. */
export type TimerClock = "game" | "real";

/** A game's own clock at one reading, and where its run stands. */
export type GameClock = {
  /** The game's time, in milliseconds. */
  readonly ms: number;
  /** Counting, stopped for now (a menu the game does not count, the title), or over (the goal). */
  readonly status: "over" | "paused" | "running";
};

/**
 * How far a running timer may be from its game clock before a reading sets it
 * right. Readings come about every second, so setting it at each would write
 * the run (and redraw its other views) for nothing; the drift this allows
 * stays under the second a timer shows.
 */
const ALIGN_TOLERANCE_MS = 250;

/**
 * Set a timer on a game's clock as read at `at`: its time becomes the game's,
 * running (so it ticks between two readings) while the game counts, stopped
 * while it does not, finished at the goal. A finished timer stays so; a
 * running one that is within the tolerance of the game is returned as it is.
 */
export const alignTimer = (
  timer: RunTimer,
  clock: GameClock,
  at: number,
): RunTimer => {
  if (timer.finished) return timer;
  const { ms, status } = clock;
  if (status === "over") {
    return { elapsedMs: ms, finished: true, startedAt: null };
  }
  if (status === "paused") {
    return timer.startedAt === null && timer.elapsedMs === ms
      ? timer
      : { elapsedMs: ms, finished: false, startedAt: null };
  }
  return isRunning(timer) &&
    Math.abs(timerMs(timer, at) - ms) <= ALIGN_TOLERANCE_MS
    ? timer
    : { elapsedMs: ms, finished: false, startedAt: at };
};

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

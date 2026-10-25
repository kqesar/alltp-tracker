import { describe, expect, it } from "vitest";
import {
  alignTimer,
  finishTimer,
  formatTime,
  IDLE_TIMER,
  isIdle,
  isRunning,
  pauseTimer,
  restoreTimer,
  startTimer,
  timerMs,
  timerState,
} from "@/utils/runTimer";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const SECOND = 1000;

describe("the run timer", () => {
  it("counts from its start, pauses, and goes on from its pause", () => {
    const running = startTimer(IDLE_TIMER, T0);
    expect(isRunning(running)).toBe(true);
    expect(timerMs(running, T0 + 90 * SECOND)).toBe(90 * SECOND);

    const paused = pauseTimer(running, T0 + 90 * SECOND);
    expect(isRunning(paused)).toBe(false);
    expect(isIdle(paused)).toBe(false);
    // A pause holds its time, however long it lasts
    expect(timerMs(paused, T0 + 3600 * SECOND)).toBe(90 * SECOND);

    const resumed = startTimer(paused, T0 + 200 * SECOND);
    expect(timerMs(resumed, T0 + 210 * SECOND)).toBe(100 * SECOND);
  });

  it("ignores a start while running, a pause while paused", () => {
    const running = startTimer(IDLE_TIMER, T0);
    expect(startTimer(running, T0 + SECOND)).toBe(running);
    expect(pauseTimer(IDLE_TIMER, T0)).toBe(IDLE_TIMER);
  });

  it("stops for good at the goal: no start goes on from it", () => {
    const finished = finishTimer(startTimer(IDLE_TIMER, T0), T0 + 5 * SECOND);
    expect(finished).toEqual({
      elapsedMs: 5 * SECOND,
      finished: true,
      startedAt: null,
    });
    expect(startTimer(finished, T0 + 9 * SECOND)).toBe(finished);
    expect(timerMs(finished, T0 + 9 * SECOND)).toBe(5 * SECOND);
  });

  it("names where it stands", () => {
    const running = startTimer(IDLE_TIMER, T0);
    expect(timerState(IDLE_TIMER)).toBe("idle");
    expect(timerState(running)).toBe("running");
    expect(timerState(pauseTimer(running, T0 + SECOND))).toBe("paused");
    expect(timerState(finishTimer(running, T0 + SECOND))).toBe("finished");
  });

  it("never counts back when the clock does", () => {
    expect(timerMs(startTimer(IDLE_TIMER, T0), T0 - SECOND)).toBe(0);
  });
});

describe("formatTime", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [61 * SECOND, "1:01"],
    [59 * 60 * SECOND + 59 * SECOND, "59:59"],
    [3600 * SECOND, "1:00:00"],
    [(5025 + 0.9) * SECOND, "1:23:45"],
    [-SECOND, "0:00"],
  ])("shows %i ms as %s", (ms, shown) => {
    expect(formatTime(ms)).toBe(shown);
  });
});

describe("restoreTimer", () => {
  it("keeps a saved timer", () => {
    const paused = { elapsedMs: 42, finished: false, startedAt: null };
    expect(restoreTimer(paused)).toEqual(paused);
    const running = { elapsedMs: 0, finished: false, startedAt: T0 };
    expect(restoreTimer(running)).toEqual(running);
  });

  it.each([
    [undefined],
    ["1:00"],
    [{ elapsedMs: -1, finished: false, startedAt: null }],
    [{ elapsedMs: 1, finished: "yes", startedAt: null }],
    [{ elapsedMs: 1, finished: true, startedAt: T0 }],
    [{ elapsedMs: Number.NaN, finished: false, startedAt: null }],
  ])("reads %j as no timer", (saved) => {
    expect(restoreTimer(saved)).toBe(IDLE_TIMER);
  });
});

describe("aligning the timer on a game's clock", () => {
  const game = (ms: number, status: "over" | "paused" | "running") => ({
    ms,
    status,
  });

  it("sets a running timer on the game's time, ticking from the reading", () => {
    const timer = alignTimer(IDLE_TIMER, game(60 * SECOND, "running"), T0);
    expect(timer).toEqual({
      elapsedMs: 60 * SECOND,
      finished: false,
      startedAt: T0,
    });
    // Between two readings it shows the game's time plus the wait
    expect(timerMs(timer, T0 + 400)).toBe(60 * SECOND + 400);
  });

  it("corrects a drift, and leaves a timer already there alone", () => {
    const timer = alignTimer(IDLE_TIMER, game(60 * SECOND, "running"), T0);
    // A second on, the game says 1:01.1: within the tolerance, same object
    expect(alignTimer(timer, game(61_100, "running"), T0 + SECOND)).toBe(timer);
    // A second on, the game says 1:03: the timer is set right
    expect(
      alignTimer(timer, game(63 * SECOND, "running"), T0 + SECOND),
    ).toEqual({
      elapsedMs: 63 * SECOND,
      finished: false,
      startedAt: T0 + SECOND,
    });
  });

  it("stops the timer on the game's time while the game does not count", () => {
    const running = alignTimer(IDLE_TIMER, game(60 * SECOND, "running"), T0);
    const paused = alignTimer(running, game(61 * SECOND, "paused"), T0 + 999);
    expect(paused).toEqual({
      elapsedMs: 61 * SECOND,
      finished: false,
      startedAt: null,
    });
    expect(timerMs(paused, T0 + 3600 * SECOND)).toBe(61 * SECOND);
    // The same pause read again changes nothing
    expect(alignTimer(paused, game(61 * SECOND, "paused"), T0 + 2000)).toBe(
      paused,
    );
    // And the game going on starts it again
    expect(
      isRunning(alignTimer(paused, game(61 * SECOND, "running"), T0 + 3000)),
    ).toBe(true);
  });

  it("finishes on the game's time at the goal, and stays finished", () => {
    const running = alignTimer(IDLE_TIMER, game(60 * SECOND, "running"), T0);
    const over = alignTimer(running, game(3723 * SECOND, "over"), T0 + SECOND);
    expect(over).toEqual({
      elapsedMs: 3723 * SECOND,
      finished: true,
      startedAt: null,
    });
    expect(timerState(over)).toBe("finished");
    expect(alignTimer(over, game(1, "running"), T0 + 9 * SECOND)).toBe(over);
    expect(alignTimer(over, game(1, "paused"), T0 + 9 * SECOND)).toBe(over);
  });
});

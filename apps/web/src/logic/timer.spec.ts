import { describe, expect, it } from "vitest";
import {
  finishTimer,
  formatTime,
  IDLE_TIMER,
  isIdle,
  isRunning,
  pauseTimer,
  restoreTimer,
  startTimer,
  timerMs,
  timerNews,
  timerState,
} from "@/logic/timer";

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

describe("timerNews", () => {
  const progress = (started: boolean, goal = false) => ({ goal, started });

  it("starts an idle timer when play follows the screens before it", () => {
    expect(timerNews(true, progress(true), IDLE_TIMER)).toBe("start");
  });

  it("starts nothing when the game is found in play, or back from a menu", () => {
    // Connected mid-run: no reading before play was seen
    expect(timerNews(undefined, progress(true), IDLE_TIMER)).toBeNull();
    // A menu or a text box: not before play
    expect(timerNews(false, progress(true), IDLE_TIMER)).toBeNull();
    // Still before play
    expect(timerNews(true, progress(false), IDLE_TIMER)).toBeNull();
  });

  it("restarts no timer that has counted: a save and quit goes on", () => {
    const paused = pauseTimer(startTimer(IDLE_TIMER, T0), T0 + SECOND);
    expect(timerNews(true, progress(true), paused)).toBeNull();
    expect(timerNews(true, progress(true), startTimer(IDLE_TIMER, T0))).toBe(
      null,
    );
  });

  it("stops a running timer at the goal, and only a running one", () => {
    const running = startTimer(IDLE_TIMER, T0);
    expect(timerNews(false, progress(true, true), running)).toBe("finish");
    expect(timerNews(false, progress(false, true), IDLE_TIMER)).toBeNull();
    const finished = finishTimer(running, T0 + SECOND);
    expect(timerNews(false, progress(true, true), finished)).toBeNull();
  });

  it("reads an unsettled fact as unknown", () => {
    expect(
      timerNews(true, { goal: "not-read", started: "not-read" }, IDLE_TIMER),
    ).toBeNull();
  });
});

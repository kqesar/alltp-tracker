import { describe, expect, it } from "vitest";
import { timerNews } from "@/games/alttpr/logic/timer";
import {
  finishTimer,
  IDLE_TIMER,
  pauseTimer,
  startTimer,
} from "@/utils/runTimer";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const SECOND = 1000;

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

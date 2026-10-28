import { playTimeMs } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { gameClockOf, timerNews } from "@/games/alttpr/logic/timer";
import {
  finishTimer,
  IDLE_TIMER,
  pauseTimer,
  startTimer,
} from "@/utils/runTimer";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const SECOND = 1000;

describe("gameClockOf", () => {
  const stats = (playFrames: number) => ({ playFrames }) as never;
  const progress = (
    playFrames: number,
    beforePlay: boolean | "not-read",
    goal: boolean | "not-read" = false,
  ) => ({ beforePlay, goal, romStats: stats(playFrames) });

  it("counts in play, menus and text boxes included", () => {
    expect(gameClockOf(false, progress(3600, false))).toEqual({
      ms: playTimeMs(3600),
      status: "running",
    });
  });

  it("is paused while the counter has not moved since the reading before", () => {
    expect(gameClockOf(false, progress(3600, false), 3599)).toMatchObject({
      status: "running",
    });
    expect(gameClockOf(false, progress(3600, false), 3600)).toEqual({
      ms: playTimeMs(3600),
      status: "paused",
    });
    // The goal stays the goal, whatever the counter did
    expect(gameClockOf(false, progress(3600, false, true), 3600)).toMatchObject(
      { status: "over" },
    );
  });

  it("is paused before play, and over at the goal", () => {
    expect(gameClockOf(false, progress(3600, true))).toEqual({
      ms: playTimeMs(3600),
      status: "paused",
    });
    expect(gameClockOf(false, progress(3600, "not-read"))).toMatchObject({
      status: "paused",
    });
    expect(gameClockOf(false, progress(3600, false, true))).toEqual({
      ms: playTimeMs(3600),
      status: "over",
    });
  });

  it("is no time before a file is loaded: the counter reads 0", () => {
    expect(gameClockOf(false, progress(0, true))).toBe("unloaded");
  });

  it("is unavailable in Race Mode and while the stats are unsettled", () => {
    expect(gameClockOf(true, progress(3600, false))).toBe("unavailable");
    expect(
      gameClockOf(false, {
        beforePlay: false,
        goal: false,
        romStats: "not-read",
      }),
    ).toBe("unavailable");
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

  it("ends the run at the goal, a timer that never started included", () => {
    const running = startTimer(IDLE_TIMER, T0);
    expect(timerNews(false, progress(true, true), running)).toBe("finish");
    // The game was already in play when connected, or the run was reset
    expect(timerNews(undefined, progress(true, true), IDLE_TIMER)).toBe(
      "finish",
    );
    const paused = pauseTimer(running, T0 + SECOND);
    expect(timerNews(false, progress(true, true), paused)).toBe("finish");
    expect(timerNews(false, progress(false, true), IDLE_TIMER)).toBe("finish");
  });

  it("ends nothing already over, nor a run reset on the credits", () => {
    const finished = finishTimer(startTimer(IDLE_TIMER, T0), T0 + SECOND);
    expect(timerNews(false, progress(true, true), finished)).toBeNull();
    // The goal was reached at the reading before: this run is another's
    expect(timerNews(false, progress(true, true), IDLE_TIMER, true)).toBeNull();
    // Unless the player started it again: a running timer stops at the goal
    expect(
      timerNews(false, progress(true, true), startTimer(IDLE_TIMER, T0), true),
    ).toBe("finish");
  });

  it("reads an unsettled fact as unknown", () => {
    expect(
      timerNews(true, { goal: "not-read", started: "not-read" }, IDLE_TIMER),
    ).toBeNull();
  });
});

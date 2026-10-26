import { describe, expect, it } from "vitest";
import { isStamp, stampOf } from "@/games/stamp";
import { IDLE_TIMER, pauseTimer, startTimer } from "@/utils/runTimer";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

describe("stampOf", () => {
  it("reads the timer, or none before it started", () => {
    expect(stampOf(IDLE_TIMER, T0)).toEqual({ at: T0, ms: null });
    const running = startTimer(IDLE_TIMER, T0);
    expect(stampOf(running, T0 + 5000)).toEqual({ at: T0 + 5000, ms: 5000 });
    // A paused timer gives its pause's time
    const paused = pauseTimer(running, T0 + 5000);
    expect(stampOf(paused, T0 + 9000)).toEqual({ at: T0 + 9000, ms: 5000 });
  });
});

describe("isStamp", () => {
  it("takes an instant and a timer reading, or none", () => {
    expect(isStamp({ at: T0, ms: 0 })).toBe(true);
    expect(isStamp({ at: T0, ms: null })).toBe(true);
  });

  it.each([
    [null],
    [T0],
    [{ at: T0 }],
    [{ at: -1, ms: null }],
    [{ at: T0, ms: -5 }],
    [{ at: Number.NaN, ms: null }],
    [{ at: "today", ms: null }],
  ])("refuses %j", (value) => {
    expect(isStamp(value)).toBe(false);
  });
});

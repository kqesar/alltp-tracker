import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pixelText,
  StreamTimer,
} from "@/games/alttpr/components/ui/StreamTimer";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pixelText", () => {
  it("draws each font pixel as a 2 px square, from the 4th row down", () => {
    // "1": .#. / ##. / .#. / .#. / ###, after a 3 px frame
    const { d, width } = pixelText("1");
    expect(d).toBe(
      [
        "M5 3h2v2h-2z",
        "M3 5h2v2h-2z",
        "M5 5h2v2h-2z",
        "M5 7h2v2h-2z",
        "M5 9h2v2h-2z",
        "M3 11h2v2h-2z",
        "M5 11h2v2h-2z",
        "M7 11h2v2h-2z",
      ].join(""),
    );
    // The frame, the digit's 6 px, the frame
    expect(width).toBe(12);
  });

  it("spaces characters by one font pixel, a colon one pixel wide", () => {
    // The frames, 3 + 3; digits 6 wide, colons 2, a 2 px gap between each
    expect(pixelText("0:00").width).toBe(32);
    expect(pixelText("1:23:45").width).toBe(52);
  });

  it("skips a character the font has no glyph for", () => {
    expect(pixelText("1 -")).toEqual(pixelText("1"));
  });

  it("keeps every width even, so the drawing centres on a whole pixel", () => {
    for (const time of ["0:00", "9:59", "59:59", "1:00:00", "10:00:00"]) {
      expect(pixelText(time).width % 2).toBe(0);
    }
  });
});

describe("StreamTimer", () => {
  it("shows the time, one cell high, and says its state", () => {
    render(<StreamTimer />);
    const timer = screen.getByTestId("stream-timer");
    expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");
    expect(timer).toHaveAttribute("viewBox", "0 0 32 16");
    expect(timer).toHaveClass("stream-timer--idle");
  });

  it("runs while the tracker's timer does, and holds its pause", () => {
    render(<StreamTimer />);
    act(() => useGameStore.getState().startTimer(T0));
    act(() => vi.advanceTimersByTime(61_000));
    const timer = screen.getByTestId("stream-timer");
    expect(timer).toHaveAccessibleName("Run timer: 1:01, running");

    act(() => useGameStore.getState().pauseTimer());
    act(() => vi.advanceTimersByTime(30_000));
    expect(timer).toHaveAccessibleName("Run timer: 1:01, paused");
    expect(timer).toHaveClass("stream-timer--paused");
  });

  it("shows the run's time once the goal stopped it", () => {
    act(() => {
      useGameStore.getState().startTimer(T0);
      useGameStore.getState().finishTimer(T0 + 5_025_000);
    });
    render(<StreamTimer />);
    const timer = screen.getByTestId("stream-timer");
    expect(timer).toHaveAccessibleName(
      "Run timer: 1:23:45, stopped at the goal",
    );
    expect(timer).toHaveAttribute("viewBox", "0 0 52 16");
    expect(timer).toHaveClass("stream-timer--finished");
  });
});

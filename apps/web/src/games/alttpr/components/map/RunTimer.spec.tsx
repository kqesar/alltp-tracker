import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GAME_MODE,
  readingOf,
  SAVE,
  seedMemory,
} from "@/games/alttpr/autotrack/fixtures";
import { RunTimer } from "@/games/alttpr/components/map/RunTimer";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useAutotrackStore.setState({ reading: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const button = () => screen.getByTestId("run-timer");

describe("RunTimer", () => {
  it("starts at 0, then runs, redrawing each second", () => {
    render(<RunTimer />);
    expect(button()).toHaveAccessibleName("Run timer: 0:00, not started");
    expect(button()).toHaveTextContent("0:00");
    expect(screen.getByTestId("run-timer-reset")).toBeDisabled();

    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(button()).toHaveAccessibleName("Run timer: 0:00, running");
    expect(screen.getByTestId("run-timer-status")).toHaveTextContent(
      "Run timer started",
    );

    act(() => vi.advanceTimersByTime(65_000));
    expect(button()).toHaveTextContent("1:05");
    // The panel, closed here, gives the same time
    expect(screen.getByRole("timer", { hidden: true })).toHaveTextContent(
      "1:05",
    );
  });

  it("pauses, resumes and resets", () => {
    render(<RunTimer />);
    fireEvent.click(screen.getByTestId("run-timer-start"));
    act(() => vi.advanceTimersByTime(30_000));

    fireEvent.click(screen.getByTestId("run-timer-pause"));
    expect(button()).toHaveAccessibleName("Run timer: 0:30, paused");
    expect(screen.getByTestId("run-timer-status")).toHaveTextContent(
      "Run timer paused at 0:30",
    );
    act(() => vi.advanceTimersByTime(60_000));
    expect(button()).toHaveTextContent("0:30");
    expect(screen.getByTestId("run-timer-start")).toHaveTextContent("Resume");

    fireEvent.click(screen.getByTestId("run-timer-start"));
    act(() => vi.advanceTimersByTime(5_000));
    expect(button()).toHaveTextContent("0:35");

    fireEvent.click(screen.getByTestId("run-timer-reset"));
    expect(button()).toHaveAccessibleName("Run timer: 0:00, not started");
    expect(button()).toHaveTextContent("0:00");
  });

  it("shows a finished run's time, which no start goes on from", () => {
    act(() => {
      useGameStore.getState().startTimer(T0);
      useGameStore.getState().finishTimer(T0 + 5_025_000);
    });
    render(<RunTimer />);

    expect(button()).toHaveAccessibleName(
      "Run timer: 1:23:45, stopped at the goal",
    );
    expect(button()).toHaveTextContent("1:23:45");
    expect(screen.getByTestId("run-timer-start")).toBeDisabled();
  });

  it("says the time the goal stopped it at", () => {
    render(<RunTimer />);
    act(() => useGameStore.getState().startTimer(T0));
    act(() => useGameStore.getState().finishTimer(T0 + 754_000));
    expect(screen.getByTestId("run-timer-status")).toHaveTextContent(
      "Run timer stopped at the goal: 12:34",
    );
  });

  it("opens its controls under itself", () => {
    render(<RunTimer />);
    fireEvent.click(button());
    expect(screen.getByTestId("run-timer-panel").style.top).not.toBe("");
  });

  it("lets the player turn the game's start and stop off", () => {
    render(<RunTimer />);
    const auto = screen.getByTestId("run-timer-auto");
    expect(auto).toBeChecked();
    expect(auto).toHaveAccessibleName("Start and stop with the game");

    fireEvent.click(auto);
    expect(useGameStore.getState().autoTimer).toBe(false);
  });

  it("gives the game's own play time outside Race Mode only", () => {
    const memory = seedMemory({ race: false });
    // 3600 seconds of NTSC frames
    const frames = Math.round(3600 * 60.0988);
    memory.set(
      [frames & 0xff, (frames >> 8) & 0xff, (frames >> 16) & 0xff, 0],
      SAVE(0x43e),
    );
    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    const { unmount } = render(<RunTimer />);
    expect(screen.getByTestId("run-timer-igt")).toHaveTextContent(
      "In-game time: 1:00:00",
    );
    unmount();

    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(memory, { race: true }),
      }),
    );
    render(<RunTimer />);
    expect(screen.queryByTestId("run-timer-igt")).toBeNull();
  });

  it("gives no play time before play, nor before the frames are read", () => {
    const memory = seedMemory({ race: false });
    memory[GAME_MODE] = 0x01; // the file select
    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    const { unmount } = render(<RunTimer />);
    expect(screen.queryByTestId("run-timer-igt")).toBeNull();
    unmount();

    memory[GAME_MODE] = 0x09;
    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(memory, { unread: ["stats"] }),
      }),
    );
    render(<RunTimer />);
    expect(screen.queryByTestId("run-timer-igt")).toBeNull();
  });
});

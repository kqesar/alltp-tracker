import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSmz3 } from "@/games/smz3/autotrack/reading";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { Smz3RunTimer } from "@/games/smz3/components/Smz3RunTimer";
import { useSmz3Store } from "@/games/smz3/store";
import { viewOf, writeSmz3 } from "../../../../../../packs/smz3/test/smz3-rom";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useSmz3Store.getState();

/** A reading of a game in play, with or without the counters (Race Mode). */
const reading = (race = false) =>
  readSmz3(
    viewOf(
      writeSmz3(new Uint8Array(0x100_0000), {
        clock: { sm: 10, zelda: 1_000 },
      }),
      "zelda",
      race ? ["clock-sm-saved", "clock-zelda-live"] : [],
    ),
    race,
    T0,
  );

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
  smz3Autotrack.useStore.setState({ raceChoice: "auto", reading: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const button = () => screen.getByTestId("run-timer");
const clockHint = () => screen.getByTestId("run-timer-clock-hint");

describe("SMZ3's run timer", () => {
  it("starts, runs, pauses and resets over the run's store", () => {
    render(<Smz3RunTimer />);
    expect(button()).toHaveAccessibleName("Run timer: 0:00, not started");

    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(button()).toHaveAccessibleName("Run timer: 0:00, running");
    act(() => vi.advanceTimersByTime(65_000));
    expect(button()).toHaveTextContent("1:05");

    fireEvent.click(screen.getByTestId("run-timer-pause"));
    expect(button()).toHaveAccessibleName("Run timer: 1:05, paused");
    expect(store().timer.startedAt).toBeNull();

    fireEvent.click(screen.getByTestId("run-timer-reset"));
    expect(button()).toHaveAccessibleName("Run timer: 0:00, not started");
  });

  it("keeps the start and stop with the game as a setting of the store", () => {
    render(<Smz3RunTimer />);
    const auto = screen.getByTestId("run-timer-auto");
    expect(auto).toBeChecked();
    fireEvent.click(auto);
    expect(store().autoTimer).toBe(false);
  });

  it("offers Real time and Game time, real by default, and keeps the choice", () => {
    render(<Smz3RunTimer />);
    expect(screen.getByTestId("run-timer-clock-real")).toBeChecked();
    expect(clockHint()).toHaveTextContent("Counts real time, as races time.");

    fireEvent.click(screen.getByTestId("run-timer-clock-game"));
    expect(store().timerClock).toBe("game");
    expect(clockHint()).toHaveTextContent(
      "Counts real time until autotracking reads the game's clock.",
    );
  });

  it("is driven by the games' time once it is read and the timer has begun", () => {
    store().setTimerClock("game");
    render(<Smz3RunTimer />);
    act(() => smz3Autotrack.useStore.setState({ reading: reading() }));
    expect(clockHint()).toHaveTextContent(
      "The timer follows the game's clock once it starts.",
    );
    expect(screen.getByTestId("run-timer-start")).toBeEnabled();

    act(() => store().startTimer(T0));
    expect(clockHint()).toHaveTextContent(
      "The timer follows the game's clock.",
    );
    expect(screen.getByTestId("run-timer-pause")).toBeDisabled();
    expect(screen.getByTestId("run-timer-auto")).toBeDisabled();
  });

  it("counts real time in Race Mode, which never reads the counters, and says why", () => {
    store().setTimerClock("game");
    act(() => store().startTimer(T0));
    render(<Smz3RunTimer />);
    act(() =>
      smz3Autotrack.useStore.setState({
        raceChoice: "on",
        reading: reading(true),
      }),
    );

    expect(screen.getByTestId("run-timer-clock-game")).toBeDisabled();
    expect(screen.getByTestId("run-timer-clock-real")).toBeChecked();
    expect(clockHint()).toHaveTextContent(
      "Not in Race Mode: the timer counts real time.",
    );
    expect(screen.getByTestId("run-timer-pause")).toBeEnabled();
  });

  it("counts real time in a race the ROM's flag set, with no choice made", () => {
    store().setTimerClock("game");
    act(() => store().startTimer(T0));
    render(<Smz3RunTimer />);
    act(() =>
      smz3Autotrack.useStore.setState({
        raceChoice: "auto",
        reading: reading(true),
      }),
    );
    expect(clockHint()).toHaveTextContent(
      "Not in Race Mode: the timer counts real time.",
    );
  });
});

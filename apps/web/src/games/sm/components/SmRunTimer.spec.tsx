import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { statusOf } from "@/autotrack/fixtures";
import { readSm } from "@/games/sm/autotrack/reading";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { SmRunTimer } from "@/games/sm/components/SmRunTimer";
import { useSmStore } from "@/games/sm/store";
import { viewOf, writeMapRando } from "../../../../../../packs/sm/test/sm-rom";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useSmStore.getState();

/** A reading of a game in play, with or without the RTA clock (Race Mode). */
const reading = (race = false) =>
  readSm(
    viewOf(
      writeMapRando(new Uint8Array(0x100_0000), {
        clock: { pending: 10, saved: 1_000 },
      }),
      race ? ["rta-pending", "rta-saved"] : [],
    ),
    T0,
  );

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
  useSmAutotrackStore.setState({ raceChoice: "off", reading: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const button = () => screen.getByTestId("run-timer");
const clockHint = () => screen.getByTestId("run-timer-clock-hint");

describe("Super Metroid's run timer", () => {
  it("starts, runs, pauses and resets over the run's store", () => {
    render(<SmRunTimer />);
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

  it("tells the player to start a timer the game was already running under", () => {
    useSmAutotrackStore.setState({
      reading: reading(),
      status: statusOf("connected"),
    });
    render(<SmRunTimer />);
    const hint = () => screen.queryByTestId("run-timer-start-hint");
    expect(hint()).toHaveTextContent(
      "The game was already in play: start the timer yourself.",
    );

    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(hint()).toBeNull();
  });

  it("says nothing with no game read, or in Race Mode where the player starts it anyway", () => {
    render(<SmRunTimer />);
    expect(screen.queryByTestId("run-timer-start-hint")).toBeNull();

    act(() =>
      useSmAutotrackStore.setState({
        raceChoice: "on",
        reading: reading(true),
        status: statusOf("connected"),
      }),
    );
    expect(screen.queryByTestId("run-timer-start-hint")).toBeNull();
  });

  it("keeps the start and stop with the game as a setting of the store", () => {
    render(<SmRunTimer />);
    const auto = screen.getByTestId("run-timer-auto");
    expect(auto).toBeChecked();
    expect(auto).toHaveAccessibleName("Start and stop with the game");
    fireEvent.click(auto);
    expect(store().autoTimer).toBe(false);
  });

  it("offers Real time and Game time, real by default, and keeps the choice", () => {
    render(<SmRunTimer />);
    expect(screen.getByTestId("run-timer-clock-real")).toBeChecked();
    expect(clockHint()).toHaveTextContent("Counts real time, as races time.");

    fireEvent.click(screen.getByTestId("run-timer-clock-game"));
    expect(store().timerClock).toBe("game");
    expect(clockHint()).toHaveTextContent(
      "Counts real time until autotracking reads the game's clock.",
    );
  });

  it("is driven by the game's clock once it is read and the timer has begun", () => {
    store().setTimerClock("game");
    render(<SmRunTimer />);
    act(() => useSmAutotrackStore.setState({ reading: reading() }));
    // Read, but the timer has not begun: the player may still start it
    expect(clockHint()).toHaveTextContent(
      "The timer follows the game's clock once it starts.",
    );
    expect(screen.getByTestId("run-timer-start")).toBeEnabled();
    expect(screen.getByTestId("run-timer-auto")).toBeEnabled();

    act(() => store().startTimer(T0));
    expect(clockHint()).toHaveTextContent(
      "The timer follows the game's clock.",
    );
    expect(screen.getByTestId("run-timer-pause")).toBeDisabled();
    expect(screen.getByTestId("run-timer-auto")).toBeDisabled();
  });

  it("counts real time in Race Mode, which never reads the clock, and says why", () => {
    store().setTimerClock("game");
    act(() => store().startTimer(T0));
    render(<SmRunTimer />);
    act(() =>
      useSmAutotrackStore.setState({
        raceChoice: "on",
        reading: reading(true),
      }),
    );

    expect(screen.getByTestId("run-timer-clock-game")).toBeDisabled();
    expect(screen.getByTestId("run-timer-clock-real")).toBeChecked();
    expect(clockHint()).toHaveTextContent(
      "Not in Race Mode: the timer counts real time.",
    );
    // Nothing drives the timer: the player may still pause it
    expect(screen.getByTestId("run-timer-pause")).toBeEnabled();
  });

  it("leaves starting and stopping to the player in Race Mode, and says why", () => {
    render(<SmRunTimer />);
    const auto = screen.getByTestId("run-timer-auto");
    expect(auto).toBeChecked();
    expect(auto).toBeEnabled();

    act(() => useSmAutotrackStore.setState({ raceChoice: "on" }));
    expect(auto).not.toBeChecked();
    expect(auto).toBeDisabled();
    expect(auto).toHaveAccessibleDescription(
      "Not in Race Mode: start and end the run yourself, as racetime.gg times the race.",
    );
    // The player's setting is kept for the runs outside Race Mode
    expect(store().autoTimer).toBe(true);
    act(() => useSmAutotrackStore.setState({ raceChoice: "off" }));
    expect(auto).toBeChecked();
  });
});

import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_MODE, readingOf, SAVE, seedMemory } from "@/autotrack/fixtures";
import { RunPanel } from "@/components/map/RunPanel";
import { useAutotrackStore } from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const store = () => useGameStore.getState();
/** Click an item `seconds` into the run. */
const clickAt = (seconds: number, item: string) => {
  vi.setSystemTime(T0 + seconds * 1000);
  act(() => store().handleItemClick(item));
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useAutotrackStore.setState({ reading: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RunPanel", () => {
  it("says what each part will hold on a fresh run", () => {
    render(<RunPanel />);
    const summary = screen.getByTestId("run-summary");
    expect(summary).toHaveTextContent("Time0:00");
    expect(summary).toHaveTextContent("Bosses0 of 12");
    expect(summary).toHaveTextContent(/Checks0 of \d{3}/);
    expect(screen.getByTestId("run-splits")).toHaveTextContent(
      "Each boss beaten splits the run here.",
    );
    expect(screen.getByTestId("run-finds")).toHaveTextContent(
      "Each item found and location checked lands here",
    );
    expect(screen.getByTestId("run-rom-stats")).toHaveTextContent(
      "Autotrack a game outside races",
    );
  });

  it("lists every find, newest first, with its time", () => {
    clickAt(0, "hookshot");
    act(() => store().startTimer(T0 + 10_000));
    clickAt(70, "sword");
    clickAt(130, "sword");
    act(() => store().toggleChecks(["kings-tomb"]));
    render(<RunPanel />);

    const rows = within(screen.getByRole("list", { name: "Timeline" }))
      .getAllByRole("listitem")
      .map((row) => row.textContent);
    expect(rows).toEqual([
      "2:00✓King's Tomb",
      "2:00Master Sword",
      "1:00Fighter's Sword",
      "–before the timerHookshot",
    ]);
    expect(
      screen.getByTestId("find-item:sword:2").querySelector("time"),
    ).toHaveAttribute("datetime", "PT120S");
    expect(
      screen.getByRole("heading", { name: "Timeline 4 finds" }),
    ).toBeVisible();
  });

  it("splits the run at each boss, and at the goal", () => {
    act(() => store().startTimer(T0));
    clickAt(600, "boss0");
    clickAt(1100, "boss1");
    act(() => store().finishTimer(T0 + 1_500_000));
    render(<RunPanel />);

    const table = screen.getByRole("table", { name: "Splits" });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["Dungeon", "Time", "Segment"],
      ["Eastern Palace", "10:00", "10:00"],
      ["Desert Palace", "18:20", "8:20"],
      ["Goal", "25:00", "6:40"],
    ]);
    expect(screen.getByTestId("run-summary")).toHaveTextContent(
      "Bosses2 of 12",
    );
  });

  it("gives the ROM's own stats outside races, once the game is in play", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x449)] = 3; // DeathCounter
    memory.set([0x10, 0x0e, 0x00, 0x00], SAVE(0x458)); // SwordTime: 3600
    render(<RunPanel />);

    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    const stats = screen.getByTestId("run-rom-stats");
    const row = (label: string) =>
      within(stats).getByText(label).closest("div")?.textContent;
    expect(row("Deaths")).toBe("Deaths3");
    // 3600 frames are a minute of NTSC play
    expect(row("First sword")).toBe("First sword0:59");
    expect(row("Pegasus Boots")).toBe("Pegasus Boots–");
    expect(row("Boss kills")).toBe("Boss kills0");

    // t1 g0 f2 m0: two kills with the fighter's sword, one with the tempered
    memory.set([0x20, 0x10], SAVE(0x425));
    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    expect(row("Boss kills")).toBe("Boss kills2 fighter, 1 tempered");

    memory[GAME_MODE] = 0x01;
    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    expect(stats).toHaveTextContent("Shown once the game is in play.");

    memory[GAME_MODE] = 0x09;
    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(memory, { race: true }),
      }),
    );
    expect(stats).toHaveTextContent("Not read in races");
    expect(within(stats).queryByText("Deaths")).toBeNull();
  });
});

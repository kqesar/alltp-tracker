import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { spoilerFile, spoilerText } from "@/games/sm/review/fixtures";
import SmApp from "@/games/sm/SmApp";
import { exportSave, useSmStore } from "@/games/sm/store";
import { useReviewStore } from "@/review/store";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useSmStore.getState();

/** A run that is over: the timer started and stopped. */
const finishRun = () => {
  act(() => {
    store().startTimer();
    vi.setSystemTime(T0 + 60_000);
    store().finishTimer();
  });
};

/** Picks a file in the dialog the Review run button opens. */
const importFile = async (file: File) => {
  fireEvent.click(await screen.findByTestId("review-open"));
  const input = await screen.findByTestId("review-file");
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0, shouldAdvanceTime: true });
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
  useSmAutotrackStore.setState({ raceChoice: "auto", reading: null });
  useReviewStore.setState({ review: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("End run", () => {
  it("asks first, with Cancel in focus, then stops the timer for good", () => {
    render(<SmApp />);
    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(screen.getByTestId("run-timer-end")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(12_000));
    fireEvent.click(screen.getByTestId("run-timer-end"));
    expect(screen.getByRole("dialog", { name: "End this run?" })).toBeVisible();
    expect(screen.getByText("Cancel")).toHaveFocus();
    fireEvent.click(screen.getByText("Cancel"));
    expect(store().timer.finished).toBe(false);

    fireEvent.click(screen.getByTestId("run-timer-end"));
    fireEvent.click(screen.getByRole("button", { name: "End run" }));
    expect(store().timer).toMatchObject({ elapsedMs: 12_000, finished: true });
    expect(screen.queryByTestId("run-timer-end")).toBeNull();
    expect(screen.getByTestId("review-open")).toHaveTextContent("Review run");
  });
});

describe("when a review may open", () => {
  it("not before the run is over", () => {
    render(<SmApp />);
    expect(screen.queryByTestId("review-open")).toBeNull();
    act(() => store().startTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
    act(() => store().pauseTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
  });

  it("not in Race Mode, a finished run included", () => {
    useSmAutotrackStore.setState({ raceChoice: "on" });
    render(<SmApp />);
    finishRun();
    expect(screen.queryByTestId("review-open")).toBeNull();
  });

  it("once the run is over", () => {
    render(<SmApp />);
    finishRun();
    expect(screen.getByTestId("review-open")).toBeInTheDocument();
  });
});

describe("a review", () => {
  const open = async (seed: string | null = null) => {
    useSmStore.setState({ seed });
    render(<SmApp />);
    finishRun();
    await importFile(spoilerFile());
    await screen.findByTestId("review-notice");
  };

  it("opens on a finished run, not verified: the file names no seed", async () => {
    await open();
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      "Not verified: Map Rando's log names no seed, so the tracker cannot prove this is the run's seed.",
    );
    // Nothing offers a second import while one is open
    expect(screen.queryByTestId("review-open")).toBeNull();
  });

  it("says the same for a run that knows its seed, and counts the facts that agree", async () => {
    await open("Zebes42");
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      "Map Rando's log names no seed, so the tracker cannot prove this is the run's seed. 1 settings and facts agree",
    );
  });

  it("sets the items the board holds against the seed's", async () => {
    act(() => {
      store().step("ice", 1);
      store().step("morph", 1);
      for (let i = 0; i < 30; i++) store().step("missile", 1);
    });
    await open();
    expect(await screen.findByTestId("review-caption")).toHaveTextContent(
      "16 items: 2 held, 14 never found.",
    );
    expect(screen.getByTestId("review-row-46:2")).toHaveTextContent(
      "Morphing BallBrinstar Reserve Tank Room: Chozo Item (Crateria)1Held",
    );
    expect(screen.getByTestId("review-row-46:4")).toHaveTextContent(
      "Speed BoosterBrinstar Reserve Tank Room: Right Hidden Item (Crateria)3Never found",
    );
    expect(screen.getByTestId("review-pack-missile")).toHaveTextContent(
      "Missiles: 30 of 46 held, 16 never found",
    );
    expect(screen.getByTestId("review-places")).toBeInTheDocument();
    expect(screen.getByTestId("review-facts")).toHaveTextContent(
      "ObjectivesKraid, Phantoon, Draygon, Ridley",
    );
  });

  it("tells each grid cell where the seed put its item", async () => {
    act(() => store().setOption("wallJump", true));
    await open();
    expect(screen.getByTestId("sm-item-morph")).toHaveAccessibleName(
      "Morphing Ball, not obtained. Click to change state. In the seed: Brinstar Reserve Tank Room: Chozo Item (Crateria).",
    );
    expect(screen.getByTestId("sm-item-missile")).toHaveAccessibleName(
      "Missile, 0 of 46. Click to change state. In the seed: 46 places.",
    );
    // An item the seed did not place says nothing more
    expect(screen.getByTestId("sm-item-wallJump")).toHaveAccessibleName(
      "Wall Jump Boots, not obtained. Click to change state.",
    );
  });

  it("closes with Close review, and the grid's names go back", async () => {
    await open();
    fireEvent.click(screen.getByTestId("review-close"));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(screen.queryByTestId("review-result")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.getByTestId("sm-item-morph")).toHaveAccessibleName(
      "Morphing Ball, not obtained. Click to change state.",
    );
    expect(screen.getByTestId("review-open")).toBeInTheDocument();
  });

  it.each([
    ["Reset timer", () => store().resetTimer()],
    ["New game", () => store().reset()],
    ["a seed switch", () => useSmStore.setState({ seed: "Other1" })],
    [
      "Race Mode coming on",
      () => useSmAutotrackStore.setState({ raceChoice: "on" }),
    ],
  ])("closes on %s", async (_, change) => {
    await open("Zebes42");
    act(() => change());
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });

  it("closes when a run is imported over it", async () => {
    await open();
    const progress = { ...store(), seed: null };
    act(() => store().load(progress));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });
});

describe("a log that is refused", () => {
  const refused = async (file: File) => {
    render(<SmApp />);
    finishRun();
    await importFile(file);
    const error = await screen.findByTestId("review-error");
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.queryByTestId("review-notice")).toBeNull();
    return error;
  };

  it("one whose objectives the ROM contradicts", async () => {
    useSmStore.setState({ objectives: ["pitRoom"], seed: "Zebes42" });
    const error = await refused(spoilerFile());
    expect(error).toHaveTextContent("its objectives is");
  });

  it("another game's", async () => {
    const error = await refused(
      new File(['{"meta":{"worlds":1}}'], "alttpr - x_9MQ9gO1wMD.txt"),
    );
    expect(error).toHaveTextContent("alttpr.com spoiler log");
  });

  it("a ROM or any other file", async () => {
    const error = await refused(
      new File([new Uint8Array([0, 1, 2, 0xff])], "game.sfc"),
    );
    expect(error).toHaveTextContent("ROM");
  });

  it("text that is not a Map Rando log", async () => {
    const error = await refused(new File(["hello"], "notes.txt"));
    expect(error).toHaveTextContent("not a spoiler log the tracker reads");
  });

  it("one over Map Rando's size bound of 64 MiB", async () => {
    const huge = new File(["x"], "huge.json");
    Object.defineProperty(huge, "size", { value: 65 * 1024 * 1024 });
    expect(await refused(huge)).toHaveTextContent("over 64 MiB");
  });

  it("not one over ALttPR's 1 MiB bound: Map Rando's log is 21 MB", async () => {
    const big = new File(["x"], "big.json");
    Object.defineProperty(big, "size", { value: 30 * 1024 * 1024 });
    expect(await refused(big)).not.toHaveTextContent("over");
  });
});

describe("a review is memory only", () => {
  it("reaches no storage nor export", async () => {
    render(<SmApp />);
    finishRun();
    const before = {
      save: JSON.stringify(exportSave(store())),
      stored: JSON.stringify({ ...localStorage }),
    };
    await importFile(spoilerFile());
    await screen.findByTestId("review-notice");
    expect(useReviewStore.getState().review).not.toBeNull();

    expect(JSON.stringify(exportSave(store()))).toBe(before.save);
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage });
    for (const word of [
      "review",
      "Chozo Item",
      "Brinstar Reserve",
      "summary",
    ]) {
      expect(stored.includes(word)).toBe(false);
    }
    expect(stored).toBe(before.stored);
    expect(spoilerText().length).toBeGreaterThan(1000);
  });

  it("is imported by none of what saves, shares, streams or follows a run", () => {
    const files = import.meta.glob<string>(
      [
        "../store.ts",
        "../overlay.ts",
        "../SmObsView.tsx",
        "../../../follow/publish.ts",
        "../../../desktop/runFeed.ts",
        "../../../desktop/overlayFeed.ts",
        "../../../overlay/publish.ts",
        "../../../share/runLink.ts",
      ],
      { eager: true, import: "default", query: "?raw" },
    );
    expect(Object.keys(files)).toHaveLength(8);
    for (const [file, source] of Object.entries(files)) {
      expect(source, file).not.toMatch(/@\/review\/|games\/sm\/review/);
    }
  });
});

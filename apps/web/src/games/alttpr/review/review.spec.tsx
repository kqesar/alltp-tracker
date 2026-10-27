import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import { RunTimer } from "@/games/alttpr/components/map/RunTimer";
import {
  spoilerFile,
  spoilerLog,
  spoilerText,
} from "@/games/alttpr/review/fixtures";
import { useCloseReview } from "@/games/alttpr/review/useReview";
import { packLink } from "@/games/alttpr/share";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { toSaveFile } from "@/games/alttpr/stores/persistence";
import { useReviewStore } from "@/review/store";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useGameStore.getState();
const HASH = "9MQ9gO1wMD";

/** The board's map panel with the closing rule the app mounts once. */
const Board = () => {
  useCloseReview();
  return <MapPanel />;
};

/** A run that is over: the timer started and stopped. */
const finishRun = () => {
  act(() => {
    store().startTimer();
    vi.setSystemTime(T0 + 60_000);
    store().finishTimer();
  });
};

/** Picks a file in the dialog the Run tab's button opens. */
const importFile = async (file: File) => {
  fireEvent.click(await screen.findByTestId("review-import"));
  const input = await screen.findByTestId("review-file");
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0, shouldAdvanceTime: true });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ mapView: "run" });
  useAutotrackStore.setState({ raceChoice: "auto", reading: null });
  useReviewStore.setState({ review: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("End run", () => {
  it("is offered while the timer counts or is paused, not before or after", () => {
    render(<RunTimer />);
    expect(screen.queryByTestId("run-timer-end")).toBeNull();
    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(screen.getByTestId("run-timer-end")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByTestId("run-timer-pause"));
    expect(screen.getByTestId("run-timer-end")).toBeInTheDocument();
    act(() => store().finishTimer());
    expect(screen.queryByTestId("run-timer-end")).toBeNull();
  });

  it("asks first, with Cancel in focus, and stops nothing on Cancel", () => {
    render(<RunTimer />);
    fireEvent.click(screen.getByTestId("run-timer-start"));
    fireEvent.click(screen.getByTestId("run-timer-end"));
    const dialog = screen.getByRole("dialog", { name: "End this run?" });
    expect(dialog).toHaveTextContent("stops for good");
    expect(screen.getByText("Cancel")).toHaveFocus();
    fireEvent.click(screen.getByText("Cancel"));
    expect(store().timer.finished).toBe(false);
  });

  it("stops the timer for good once confirmed", () => {
    render(<RunTimer />);
    fireEvent.click(screen.getByTestId("run-timer-start"));
    act(() => vi.advanceTimersByTime(12_000));
    fireEvent.click(screen.getByTestId("run-timer-end"));
    fireEvent.click(screen.getByRole("button", { name: "End run" }));
    expect(store().timer).toMatchObject({ elapsedMs: 12_000, finished: true });
    expect(screen.getByTestId("run-timer")).toHaveAccessibleName(
      "Run timer: 0:12, stopped",
    );
    expect(screen.getByTestId("run-timer-start")).toBeDisabled();
  });
});

describe("when a review may open", () => {
  it("not before the run is over: it says how it ends", () => {
    render(<Board />);
    expect(screen.queryByTestId("review-open")).toBeNull();
    expect(screen.queryByTestId("review-import")).toBeNull();
    expect(screen.getByTestId("review-gate-note")).toHaveTextContent(
      "once the run is over: at the goal, or after End run",
    );
  });

  it("not on a run that is running or paused", () => {
    render(<Board />);
    act(() => store().startTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
    act(() => store().pauseTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
    expect(screen.queryByTestId("review-import")).toBeNull();
  });

  it("opens the button and the import once the run is over", () => {
    render(<Board />);
    finishRun();
    expect(screen.getByTestId("review-open")).toHaveTextContent("Review run");
    expect(screen.getByTestId("review-import")).toBeInTheDocument();
    // Neutral words: what came into logic when, never "late"
    const section = screen.getByTestId("review-section");
    expect(section).toHaveTextContent(
      "when each item the seed needed came into logic, and when you took it",
    );
    expect(section).not.toHaveTextContent(/late|in order/i);
  });

  it("never in Race Mode, a finished run included", () => {
    useAutotrackStore.setState({ raceChoice: "on" });
    render(<Board />);
    finishRun();
    expect(screen.queryByTestId("review-open")).toBeNull();
    expect(screen.queryByTestId("review-import")).toBeNull();
    expect(screen.getByTestId("review-gate-note")).toHaveTextContent(
      "Off in Race Mode",
    );
  });
});

describe("a review", () => {
  const open = async (seed: string | null = HASH) => {
    useGameStore.setState({ seed });
    render(<Board />);
    finishRun();
    await importFile(spoilerFile(HASH));
    await screen.findByTestId("review-notice");
  };

  it("opens on a finished run's own log, and compares", async () => {
    await open();
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      `Seed ${HASH}: the log's seed is this run's (matched by its file name)`,
    );
    expect(await screen.findByTestId("review-caption")).toHaveTextContent(
      /^32 needed items\. Step 1 is what the start reaches/,
    );
    // A run with no finds has no times: the waits say why they are not shown
    expect(screen.getByTestId("review-hidden")).toHaveTextContent(
      "Nothing the seed needed has a time on this run",
    );
    expect(screen.getByTestId("review-missed")).toBeInTheDocument();
    expect(screen.getByTestId("review-facts")).toHaveTextContent("Medallions");
    // Nothing offers a second import while one is open
    expect(screen.queryByTestId("review-open")).toBeNull();
    expect(screen.queryByTestId("review-import")).toBeNull();
  });

  it("says it is not verified when the run does not know its seed", async () => {
    await open(null);
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      "Not verified: this run does not know its seed",
    );
  });

  it("names the held item on a checked location's timeline row", async () => {
    useGameStore.setState({ seed: HASH });
    const place = spoilerLog(HASH).placements.find(
      (p) => p.location === "kings-tomb",
    );
    act(() => store().toggleChecks(["kings-tomb"]));
    render(<Board />);
    finishRun();
    await importFile(spoilerFile(HASH));
    await screen.findByTestId("review-notice");
    expect(screen.getByTestId("find-held-check:kings-tomb")).toHaveTextContent(
      `→ ${place?.itemName}`,
    );
  });

  it("closes with Close review", async () => {
    await open();
    fireEvent.click(screen.getByTestId("review-close"));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.getByTestId("review-import")).toBeInTheDocument();
  });

  it.each([
    ["Reset timer", () => store().resetTimer()],
    ["New game", () => store().reset()],
    ["a seed switch", () => useGameStore.setState({ seed: "eM43RgZ4Gj" })],
    [
      "Race Mode coming on",
      () => useAutotrackStore.setState({ raceChoice: "on" }),
    ],
  ])("closes on %s", async (_, change) => {
    await open();
    act(() => change());
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });

  it("closes when a run is imported over it", async () => {
    await open();
    const save = toSaveFile(store());
    act(() => store().loadProgress(save.progress as never));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });
});

describe("a log that is refused", () => {
  const refused = async (file: File, seed: string | null = HASH) => {
    useGameStore.setState({ seed });
    render(<Board />);
    finishRun();
    await importFile(file);
    const error = await screen.findByTestId("review-error");
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.queryByTestId("review-notice")).toBeNull();
    return error;
  };

  it("another seed's, saying both", async () => {
    const error = await refused(spoilerFile(HASH), "eM43RgZ4Gj");
    expect(error).toHaveTextContent(
      `This spoiler log is for seed ${HASH}; your run is seed eM43RgZ4Gj.`,
    );
  });

  it("one whose settings the run contradicts", async () => {
    useGameStore.setState({
      settings: { ...store().settings, crystalsGanon: 2 },
    });
    const error = await refused(spoilerFile(HASH), null);
    expect(error).toHaveTextContent("its crystals for Ganon is");
  });

  it("another game's", async () => {
    const error = await refused(
      new File(
        ['{"summary":[],"all_items":[],"start_location":{}}'],
        "spoiler.json",
      ),
    );
    expect(error).toHaveTextContent("Map Rando");
  });

  it("a tournament file with no placements", async () => {
    const error = await refused(spoilerFile("eM43RgZ4Gj"), null);
    expect(error).toHaveTextContent("withheld");
  });

  it("a ROM or any other file", async () => {
    const error = await refused(
      new File([new Uint8Array([0, 1, 2, 0xff])], "game.sfc"),
    );
    expect(error).toHaveTextContent("ROM");
  });

  it("one over the size bound", async () => {
    const big = new File(["x"], "big.txt");
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    const error = await refused(big);
    expect(error).toHaveTextContent("over 1 MiB");
  });
});

describe("a review is memory only", () => {
  it("reaches no storage, export or link", async () => {
    useGameStore.setState({ seed: HASH });
    render(<Board />);
    finishRun();
    const before = {
      link: packLink(JSON.stringify(toSaveFile(store()))),
      save: JSON.stringify(toSaveFile(store())),
      stored: JSON.stringify({ ...localStorage }),
    };
    await importFile(spoilerFile(HASH));
    await screen.findByTestId("review-notice");
    expect(useReviewStore.getState().review).not.toBeNull();

    expect(JSON.stringify(toSaveFile(store()))).toBe(before.save);
    expect(packLink(JSON.stringify(toSaveFile(store())))).toBe(before.link);
    // Nothing of the log, nor a key of its own, in the browser's storage
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage });
    for (const word of ["review", "Heart Container", "playthrough", "Bosses"]) {
      expect(stored.includes(word)).toBe(false);
    }
    expect(stored).toBe(before.stored);
    expect(spoilerText(HASH).length).toBeGreaterThan(1000);
  });

  it("is imported by none of what saves, shares, streams or follows a run", () => {
    const files = import.meta.glob<string>(
      [
        "../stores/persistence.ts",
        "../stores/gameStore.ts",
        "../share.ts",
        "../overlay.ts",
        "../../../follow/publish.ts",
        "../../../desktop/runFeed.ts",
        "../../../desktop/overlayFeed.ts",
        "../../../overlay/publish.ts",
        "../../../share/runLink.ts",
      ],
      { eager: true, import: "default", query: "?raw" },
    );
    expect(Object.keys(files)).toHaveLength(9);
    for (const [file, source] of Object.entries(files)) {
      expect(source, file).not.toMatch(/@\/review\/|games\/alttpr\/review/);
    }
  });
});

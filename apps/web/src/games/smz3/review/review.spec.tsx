import { HYRULE_MARKERS } from "@alltp/pack-smz3";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spoilerFile as alttprFile } from "@/games/alttpr/review/fixtures";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { Smz3Maps } from "@/games/smz3/components/Smz3Maps";
import {
  Smz3ReviewBanner,
  Smz3ReviewButton,
} from "@/games/smz3/components/Smz3ReviewButton";
import { Smz3RunTimer } from "@/games/smz3/components/Smz3RunTimer";
import {
  apiFile,
  GUID,
  spoilerFile,
  spoilerLog,
} from "@/games/smz3/review/fixtures";
import { useCloseReview } from "@/games/smz3/review/useReview";
import { packLink } from "@/games/smz3/share";
import { exportSave, useSmz3Store } from "@/games/smz3/store";
import { useReviewStore } from "@/review/store";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useSmz3Store.getState();
const log = spoilerLog();

/** The parts of the board a review touches, with the closing rule the app mounts once. */
const Board = () => {
  useCloseReview();
  return (
    <>
      <Smz3ReviewButton />
      <Smz3RunTimer />
      <Smz3ReviewBanner />
      <Smz3Grid />
      <Smz3Maps />
    </>
  );
};

/** A run that is over: the timer started and stopped. */
const finishRun = () => {
  act(() => {
    store().startTimer();
    vi.setSystemTime(T0 + 60_000);
    store().finishTimer();
  });
};

/** Picks a file in the dialog the button opens. */
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
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
  smz3Autotrack.useStore.setState({ raceChoice: "auto", reading: null });
  useReviewStore.setState({ review: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("End run on SMZ3's timer", () => {
  it("asks first, with Cancel in focus, then stops the timer for good", () => {
    render(<Board />);
    expect(screen.queryByTestId("run-timer-end")).toBeNull();
    fireEvent.click(screen.getByTestId("run-timer-start"));
    act(() => vi.advanceTimersByTime(12_000));
    fireEvent.click(screen.getByTestId("run-timer-end"));
    expect(screen.getByText("Cancel")).toHaveFocus();
    fireEvent.click(screen.getByText("Cancel"));
    expect(store().timer.finished).toBe(false);
    fireEvent.click(screen.getByTestId("run-timer-end"));
    fireEvent.click(screen.getByRole("button", { name: "End run" }));
    expect(store().timer).toMatchObject({ elapsedMs: 12_000, finished: true });
    expect(screen.getByTestId("run-timer")).toHaveAccessibleName(
      "Run timer: 0:12, stopped",
    );
  });
});

describe("when a review may open", () => {
  it("not before the run is over", () => {
    render(<Board />);
    expect(screen.queryByTestId("review-open")).toBeNull();
    act(() => store().startTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
    act(() => store().pauseTimer());
    expect(screen.queryByTestId("review-open")).toBeNull();
    expect(screen.queryByTestId("smz3-map-tab-review")).toBeNull();
  });

  it("once it is over, by a button beside the timer", () => {
    render(<Board />);
    finishRun();
    expect(screen.getByTestId("review-open")).toHaveTextContent("Review run");
  });

  it("never in Race Mode, a finished run included", () => {
    smz3Autotrack.useStore.setState({ raceChoice: "on" });
    render(<Board />);
    finishRun();
    expect(screen.queryByTestId("review-open")).toBeNull();
  });

  it("says why in the dialog when Race Mode comes on while it is open", async () => {
    render(<Board />);
    finishRun();
    fireEvent.click(await screen.findByTestId("review-open"));
    await screen.findByTestId("review-file");
    act(() => smz3Autotrack.useStore.setState({ raceChoice: "on" }));
    // The dialog goes with the button: no way to read a log in a race
    expect(screen.queryByTestId("review-file")).toBeNull();
    expect(screen.queryByTestId("review-open")).toBeNull();
  });
});

describe("a review", () => {
  const open = async (seed: string | null = GUID, file = spoilerFile()) => {
    useSmz3Store.setState({ seed });
    render(<Board />);
    finishRun();
    await importFile(file);
    await screen.findByTestId("review-notice");
  };

  it("opens on a finished run's own log, verified by its guid", async () => {
    await open();
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      `Seed ${GUID}: the log's seed is this run's (matched by its guid)`,
    );
    // The button gives way: nothing offers a second import
    expect(screen.queryByTestId("review-open")).toBeNull();
  });

  it("reads the API's JSON as well", async () => {
    await open(GUID, apiFile());
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      "matched by its guid",
    );
  });

  it("says it is not verified when the run does not know its guid", async () => {
    await open(null);
    expect(screen.getByTestId("review-binding")).toHaveTextContent(
      "Not verified: this run does not know its seed",
    );
  });

  it("shows its tab at once, and gives the maps back on Close review", async () => {
    await open();
    expect(screen.getByTestId("smz3-map-tab-review")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByTestId("review-result")).toBeInTheDocument();
    expect(screen.queryByTestId("map-world-light")).toBeNull();
    fireEvent.click(screen.getByTestId("review-close"));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(screen.queryByTestId("smz3-map-tab-review")).toBeNull();
    expect(screen.getByTestId("map-world-light")).toBeInTheDocument();
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.getByTestId("review-open")).toBeInTheDocument();
  });

  it("says what was checked, not when, and what was not checked", async () => {
    const first = log.placements.find((p) => p.sphere === 1);
    const aside = log.placements.find((p) => p.sphere === null);
    useSmz3Store.setState({
      checked: [first?.location ?? "", aside?.location ?? ""],
    });
    await open();
    expect(await screen.findByTestId("review-note")).toHaveTextContent(
      "keeps no times",
    );
    expect(screen.getByTestId("review-summary")).toHaveTextContent(
      "You checked 2 of 316 places",
    );
    const table = screen.getByTestId("review-playthrough");
    const row = within(table).getByRole("rowheader", {
      name: first?.locationName,
    });
    expect(row.closest("tr")).toHaveTextContent("Checked");
    expect(row.closest("tr")).toHaveTextContent(first?.itemName ?? "");
    expect(within(table).getAllByText("Not checked").length).toBeGreaterThan(5);
    // A place outside the playthrough that was checked is not among those left
    const missed = screen.getByTestId("review-missed");
    expect(missed).not.toHaveTextContent(aside?.locationName ?? "!");
    expect(missed).toHaveTextContent(first?.area ?? "!");
    expect(screen.getByTestId("review-facts")).toHaveTextContent("Medallions");
  });

  it("puts what each marker held on it, in its name and its look", async () => {
    await open();
    fireEvent.click(screen.getByTestId("smz3-map-tab-hyrule"));
    const marker = HYRULE_MARKERS.light.find((m) => m.locations.length === 1);
    const place = log.placements.find(
      (p) => p.location === marker?.locations[0],
    );
    const button = screen.getByTestId(`marker-${marker?.id}`);
    expect(button).toHaveAccessibleName(
      new RegExp(`: [^.]+\\. Held: ${place?.itemName}; not all checked$`),
    );
    expect(button).toHaveAttribute("data-review", "missed");
    // Checked, its ring and its words change
    fireEvent.click(button);
    expect(button).toHaveAccessibleName(/; all checked$/);
    expect(button).toHaveAttribute("data-review", "found");
  });

  it("draws a Zelda item and a Metroid item on their markers", async () => {
    await open();
    fireEvent.click(screen.getByTestId("smz3-map-tab-hyrule"));
    const sprites = screen
      .getAllByTestId(/^marker-/)
      .map((m) => [
        m.getAttribute("data-held"),
        m.style.getPropertyValue("--held"),
      ]);
    // An asset of the app (ALttPR's art) or a frame of the Metroid sheet
    expect(
      sprites.some(
        ([kind, held]) => kind === "" && /\.png\)$/.test(held ?? ""),
      ),
    ).toBe(true);
    // Zebes's markers are on its own tab
    fireEvent.click(screen.getByTestId("smz3-map-tab-zebes"));
    const zebes = screen.getAllByTestId(/^marker-/);
    expect(zebes.some((m) => m.getAttribute("data-held") === "sheet")).toBe(
      true,
    );
    expect(zebes.every((m) => m.hasAttribute("data-review"))).toBe(true);
  });

  it("says where the seed put each item of the grid", async () => {
    await open();
    const hookshot = log.placements.find((p) => p.item === "hookshot");
    expect(screen.getByTestId("smz3-item-hookshot")).toHaveAccessibleName(
      `Hookshot, not obtained. In the seed: at ${hookshot?.locationName}. Click to change state.`,
    );
    expect(screen.getByTestId("smz3-item-sword")).toHaveAccessibleName(
      /^Sword, 0 of 4\. In the seed: 4 places: .+\. Click to change state\.$/,
    );
  });

  it("changes nothing outside a review", () => {
    useSmz3Store.setState({ seed: GUID });
    render(<Board />);
    expect(screen.getByTestId("smz3-item-hookshot")).toHaveAccessibleName(
      "Hookshot, not obtained. Click to change state.",
    );
    const marker = screen.getByTestId("marker-links-house");
    expect(marker).not.toHaveAttribute("data-review");
    expect(marker).not.toHaveAttribute("data-held");
    expect(marker).toHaveAccessibleName(/: (available|checked)$/);
  });

  it.each([
    ["Reset timer", () => store().resetTimer()],
    ["New game", () => store().reset()],
    ["a seed switch", () => useSmz3Store.setState({ seed: "f".repeat(32) })],
    [
      "Race Mode coming on",
      () => smz3Autotrack.useStore.setState({ raceChoice: "on" }),
    ],
  ])("closes on %s", async (_, change) => {
    await open();
    act(() => change());
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(screen.queryByTestId("smz3-map-tab-review")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });

  it("closes when a run is loaded over it", async () => {
    await open();
    act(() => store().load(exportSaveProgress()));
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(useReviewStore.getState().review).toBeNull();
  });
});

/** The progress a save would load, with the timer idle as a load leaves it. */
const exportSaveProgress = () => {
  const { checked, items, pads, seed, settings } = store();
  return { checked, items, pads, seed, settings };
};

describe("a log that is refused", () => {
  const refused = async (file: File, seed: string | null = GUID) => {
    useSmz3Store.setState({ seed });
    render(<Board />);
    finishRun();
    await importFile(file);
    const error = await screen.findByTestId("review-error");
    expect(useReviewStore.getState().review).toBeNull();
    expect(screen.queryByTestId("review-notice")).toBeNull();
    expect(screen.queryByTestId("smz3-map-tab-review")).toBeNull();
    return error;
  };

  it("another seed's, saying both", async () => {
    const other = "f".repeat(32);
    const error = await refused(spoilerFile(), other);
    expect(error).toHaveTextContent(
      `This spoiler log is for seed ${GUID}; your run is seed ${other}.`,
    );
  });

  it("one whose settings the run contradicts", async () => {
    useSmz3Store.setState({
      settings: { ...store().settings, smLogic: "hard" },
    });
    const error = await refused(spoilerFile(), null);
    expect(error).toHaveTextContent(
      "its Super Metroid logic is normal, your run's is hard",
    );
  });

  it("one whose medallion the board knows to be another", async () => {
    const wrong =
      log.extra.medallions.turtleRock === "quake" ? "ether" : "quake";
    useSmz3Store.setState({ pads: { mire: "unknown", turtleRock: wrong } });
    const error = await refused(spoilerFile(), null);
    expect(error).toHaveTextContent("its Turtle Rock's medallion is");
  });

  it("another game's", async () => {
    const error = await refused(alttprFile("9MQ9gO1wMD"));
    expect(error).toHaveTextContent("A Link to the Past spoiler log");
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
    useSmz3Store.setState({ seed: GUID });
    render(<Board />);
    finishRun();
    const before = {
      link: packLink(JSON.stringify(exportSave(store()))),
      save: JSON.stringify(exportSave(store())),
      stored: JSON.stringify({ ...localStorage }),
    };
    await importFile(spoilerFile());
    await screen.findByTestId("review-notice");
    expect(useReviewStore.getState().review).not.toBeNull();

    expect(JSON.stringify(exportSave(store()))).toBe(before.save);
    expect(packLink(JSON.stringify(exportSave(store())))).toBe(before.link);
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage });
    for (const word of ["review", "Rupees", "Playthrough", "Hookshot"]) {
      expect(stored.includes(word)).toBe(false);
    }
    expect(stored).toBe(before.stored);
  });

  it("is imported by none of what saves, shares, streams or follows a run", () => {
    const files = import.meta.glob<string>(
      [
        "../store.ts",
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
    expect(Object.keys(files)).toHaveLength(8);
    for (const [file, source] of Object.entries(files)) {
      expect(source, file).not.toMatch(/@\/review\/|games\/smz3\/review/);
    }
  });
});

import { DUNGEONS } from "@alltp/pack-alttpr";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import {
  dungeonContext,
  ReviewWaits,
} from "@/games/alttpr/components/map/ReviewWaits";
import { getPreset } from "@/games/alttpr/data/presets";
import { compareReview, type ReviewedRun } from "@/games/alttpr/review/adapter";
import {
  type Played,
  playedRun,
  spoilerFile,
  spoilerLog,
} from "@/games/alttpr/review/fixtures";
import type { Sweep, Wait } from "@/games/alttpr/review/sweep";
import { useCloseReview } from "@/games/alttpr/review/useReview";
import { useSweep } from "@/games/alttpr/review/useSweep";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { type Loaded, useReviewStore } from "@/review/store";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const HASH = "9MQ9gO1wMD";
const HOOKSHOT = "eastern-palace/map-chest";
const log = spoilerLog(HASH);

const Board = () => {
  useCloseReview();
  return <MapPanel />;
};

/** The playthrough step by step, two minutes apart, the Hookshot last after a 40-minute break. */
const PLAN: readonly Played[] = (() => {
  const plan = log.placements
    .filter((p) => p.sphere !== null && p.location !== HOOKSHOT)
    .sort(
      (a, b) =>
        (a.sphere ?? 0) - (b.sphere ?? 0) ||
        a.locationName.localeCompare(b.locationName),
    )
    .map((p, index) => ({ location: p.location, minute: 2 * (index + 1) }));
  const last = plan.at(-1)?.minute ?? 0;
  return [...plan, { location: HOOKSHOT, minute: last + 40 }];
})();

/** Puts a played run on the board, ends it and opens its review. */
const openReview = async (
  change: Partial<ReviewedRun> = {},
  plan: readonly Played[] = PLAN,
) => {
  const initial = useGameStore.getInitialState();
  const run = playedRun(log, plan, {
    checked: {},
    items: initial.items,
    medallions: initial.medallions,
    presetId: "open",
    seed: HASH,
    settings: getPreset("open").settings,
    smallKeys: initial.smallKeys,
    timeline: {},
  });
  const end = ((plan.at(-1)?.minute ?? 0) + 2) * 60_000;
  useGameStore.setState({
    ...run,
    ...change,
    timer: { elapsedMs: end, finished: true, startedAt: null },
  });
  render(<Board />);
  fireEvent.click(await screen.findByTestId("review-import"));
  // Found outside act: the dialog's first open waits for its chunk
  const input = await screen.findByTestId("review-file");
  await act(async () => {
    fireEvent.change(input, { target: { files: [spoilerFile(HASH)] } });
  });
  await screen.findByTestId("review-notice");
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

describe("the waits of a reviewed run", () => {
  it("open with the tiles: play time, needed items, longest wait", async () => {
    await openReview();
    const tiles = await screen.findByTestId("review-tiles");
    expect(tiles).toHaveTextContent("Play time");
    // The break of 40 minutes is left out and said
    expect(tiles).toHaveTextContent(/1 break \(40 min\) left out/);
    expect(tiles).toHaveTextContent("32 of 32");
    expect(tiles).toHaveTextContent("Nothing the seed needed was left behind");
    expect(tiles).toHaveTextContent("Hookshot, in logic from the start");
  });

  it("list what waited longest as cards, with when it was in logic, taken and how long", async () => {
    await openReview();
    const waits = await screen.findByTestId("review-waits");
    const cards = within(waits).getAllByRole("listitem");
    const first = screen.getByTestId(`wait-${HOOKSHOT}`);
    expect(cards[0]).toBe(first);
    expect(within(first).getByRole("heading", { level: 5 })).toHaveTextContent(
      "Hookshot · Eastern Palace - Map Chest",
    );
    expect(
      within(first).getByText("In logic from").nextSibling,
    ).toHaveTextContent("the start");
    expect(first).toHaveTextContent(
      /Trade-off\. Held earlier, it could have opened .*Hookshot Cave/,
    );
    // The bar is drawn for the eye only: the words above say it all
    expect(first.querySelector(".review-track")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // Neutral words: never late, never a mistake
    expect(waits).not.toHaveTextContent(/late|mistake/i);
  });

  it("shows five cards, then all of them on demand", async () => {
    await openReview();
    const more = await screen.findByTestId("review-waits-all");
    const cards = () =>
      screen.getByTestId("review-waits").querySelectorAll(".wait-card");
    expect(cards()).toHaveLength(5);
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(cards().length).toBeGreaterThan(5);
  });

  it("names the chain behind the run", async () => {
    await openReview();
    const chain = await screen.findByTestId("review-chain");
    expect(chain).toHaveTextContent("The chain behind the run.");
    expect(
      within(chain).getAllByRole("listitem").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("times each dungeon in a table with its headers", async () => {
    await openReview();
    const dungeons = await screen.findByTestId("review-dungeons");
    expect(within(dungeons).getByRole("table")).toBeInTheDocument();
    expect(
      within(dungeons).getByRole("columnheader", { name: "Part in logic" }),
    ).toBeInTheDocument();
    const eastern = screen.getByTestId("review-dungeon-eastern-palace");
    expect(
      within(eastern).getByRole("rowheader", { name: "Eastern Palace" }),
    ).toBeInTheDocument();
    // "3/6" on screen, "3 of 6" to a screen reader
    expect(eastern).toHaveTextContent(/^Eastern Palacestart \d+\/ of 6/);
  });

  it("lists what was taken before the logic expected, without guessing why", async () => {
    await openReview();
    const ahead = await screen.findByTestId("review-ahead");
    const fireRod = log.placements.find((p) => p.item === "fireRod");
    expect(screen.getByTestId(`ahead-${fireRod?.location}`)).toHaveTextContent(
      /Fire Rod.*Taken .*; in logic from .*, after the Hookshot/,
    );
    expect(ahead).not.toHaveTextContent(/trick|glitch|mistake/i);
  });

  it("lists an item taken whose place was never in logic, and keeps it out of the chain", async () => {
    // The Hookshot never taken: Hookshot Cave, and its Fire Rod, never in logic
    await openReview(
      {},
      PLAN.filter(({ location }) => location !== HOOKSHOT),
    );
    await screen.findByTestId("review-ahead");
    const fireRod = log.placements.find((p) => p.item === "fireRod");
    const row = screen.getByTestId(`ahead-${fireRod?.location}`);
    expect(row).toHaveTextContent(/Taken .*; not in logic by the run's end/);
    expect(row).not.toHaveTextContent("start");
    const chain = screen.queryByTestId("review-chain");
    expect(chain?.textContent ?? "").not.toContain("Fire Rod");
  });

  it("says a dungeon's entry is not timed when no dungeon chest was (Race Mode)", async () => {
    const { timeline } = playedRun(log, PLAN, {
      ...useGameStore.getInitialState(),
      presetId: "open",
      seed: HASH,
      settings: getPreset("open").settings,
      timeline: {},
    });
    await openReview({
      timeline: Object.fromEntries(
        Object.entries(timeline).filter(
          ([key]) => !DUNGEONS.some(({ id }) => key.startsWith(`check:${id}/`)),
        ),
      ),
    });
    const eastern = await screen.findByTestId("review-dungeon-eastern-palace");
    // Part in logic, All in logic, Entered, Boss
    const entered = within(eastern).getAllByRole("cell")[2];
    expect(entered).toHaveTextContent(/^not timed$/);
    expect(within(eastern).getAllByRole("cell")[3]).toHaveTextContent(
      /^\d+:\d\d$/,
    );
  });

  it("folds the playthrough under Details by step, with the waits in it", async () => {
    await openReview();
    const steps = await screen.findByTestId("review-playthrough");
    expect(steps.tagName).toBe("DETAILS");
    expect(steps).toHaveTextContent("Details by step");
    expect(
      within(steps).getByRole("columnheader", { name: "Waited" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId(`review-row-${HOOKSHOT}`)).toHaveTextContent(
      /^1HookshotEastern Palace - Map Chest/,
    );
  });

  it("says what was never checked, grouped", async () => {
    await openReview();
    const missed = screen.getByTestId("review-missed");
    expect(missed).toHaveTextContent("Places that mattered, never checked");
    expect(missed).toHaveTextContent("Nothing the seed needed.");
    expect(missed).toHaveTextContent(/\d+ other places held/);
  });

  it("is kept for the review: the tab coming back finds it done", async () => {
    await openReview();
    await screen.findByTestId("review-waits");
    act(() => useGameStore.setState({ mapView: "map" }));
    expect(screen.queryByTestId("review-waits")).toBeNull();
    act(() => useGameStore.setState({ mapView: "run" }));
    expect(await screen.findByTestId("review-waits")).toBeInTheDocument();
    expect(screen.queryByTestId("review-working")).toBeNull();
  });

  it("are not shown for a run tracked by hand, and say why", async () => {
    // Items clicked, no place checked: the times are clicks
    const { timeline } = playedRun(log, PLAN, {
      ...useGameStore.getInitialState(),
      presetId: "open",
      seed: HASH,
      settings: getPreset("open").settings,
      timeline: {},
    });
    await openReview({
      checked: {},
      timeline: Object.fromEntries(
        Object.entries(timeline).filter(([key]) => key.startsWith("item:")),
      ),
    });
    expect(screen.getByTestId("review-hidden")).toHaveTextContent(
      "This run was tracked by hand",
    );
    expect(screen.queryByTestId("review-waits")).toBeNull();
    expect(screen.queryByTestId("review-working")).toBeNull();
    // The plain playthrough stands in, open, with the timer's readings
    const steps = screen.getByTestId("review-playthrough");
    expect(steps.tagName).toBe("SECTION");
    expect(
      within(steps).queryByRole("columnheader", { name: "Waited" }),
    ).toBeNull();
  });
});

describe("the sweep on the page", () => {
  const run = playedRun(log, PLAN, {
    ...useGameStore.getInitialState(),
    presetId: "open",
    seed: HASH,
    settings: getPreset("open").settings,
    timeline: {},
  });
  const comparison = compareReview(log, run);
  const review = (): Loaded => ({
    binding: { facts: 0, verdict: "not-verified" },
    boundSeed: HASH,
    fileName: "log.txt",
    game: "alttpr",
    log,
  });

  it("runs in slices of the main thread: nothing until the first, then the sweep", () => {
    vi.useFakeTimers({ now: T0 });
    const loaded = review();
    const { result } = renderHook(() =>
      useSweep(loaded, run, comparison, 60_000, false),
    );
    // Nothing is solved while the page draws its frame
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(0));
    // A slice runs, then hands the page a frame, until the sweep is done
    act(() => vi.runAllTimers());
    expect(result.current?.waits.length).toBeGreaterThan(20);
  });

  it("is kept per review, and never run for a run whose waits are hidden", () => {
    vi.useFakeTimers({ now: T0 });
    const loaded = review();
    const first = renderHook(() =>
      useSweep(loaded, run, comparison, 60_000, false),
    );
    act(() => vi.runAllTimers());
    const done = first.result.current;
    expect(done).not.toBeNull();
    // Mounted again with the same run: the same sweep, at once
    const again = renderHook(() =>
      useSweep(loaded, { ...run }, comparison, 60_000, false),
    );
    expect(again.result.current).toBe(done);
    // Another review starts over; a hidden one never starts
    const hidden = renderHook(() =>
      useSweep(review(), run, comparison, 60_000, true),
    );
    act(() => vi.runAllTimers());
    expect(hidden.result.current).toBeNull();
  });
});

describe("the dungeon sentence", () => {
  const MIN = 60_000;
  const wait: Wait = {
    after: null,
    copies: 1,
    icon: "hookshot",
    inferred: false,
    item: "hookshot",
    kind: "major",
    location: "eastern-palace/map-chest",
    name: "Hookshot",
    opened: [],
    place: "eastern-palace/map-chest",
    reach: 20 * MIN,
    sphere: 1,
    taken: 90 * MIN,
    takenKey: "item:hookshot",
    tradeOff: null,
    waited: 70 * MIN,
    where: "Eastern Palace - Map Chest",
  };
  const sweep: Sweep = {
    breaks: [],
    dungeonChecks: true,
    dungeons: [
      {
        atPartial: [
          "eastern-palace/compass-chest",
          "eastern-palace/cannonball-chest",
        ],
        entered: 30 * MIN,
        finished: null,
        full: 60 * MIN,
        fullAfter: null,
        id: "eastern-palace",
        name: "Eastern Palace",
        partial: 0,
        reaches: {
          "eastern-palace/big-chest": 60 * MIN,
          "eastern-palace/big-key-chest": 60 * MIN,
          "eastern-palace/boss": 60 * MIN,
          "eastern-palace/cannonball-chest": 0,
          "eastern-palace/compass-chest": 0,
          "eastern-palace/map-chest": 20 * MIN,
        },
        total: 6,
      },
    ],
    end: 100 * MIN,
    solves: 0,
    timerEnd: 100 * MIN,
    waits: [wait],
  };

  it("names the places in logic when the item came into logic, its own among them", () => {
    expect(dungeonContext(wait, sweep)).toBe(
      "Eastern Palace: 3 of 6 places were in logic then (Cannonball Chest, Compass Chest and Map Chest); one held the Hookshot. The whole dungeon was in logic from 1:00:00. You entered it at 30:00.",
    );
  });

  it("never says nothing waited over a list of what did", () => {
    const bigKey: Wait = {
      ...wait,
      item: "bigKeyP1",
      kind: "dungeon",
      name: "Eastern Palace Big Key",
    };
    render(
      <ReviewWaits
        comparison={{
          counted: [],
          rows: [],
          summary: {
            inOrder: 1,
            late: 0,
            missed: 0,
            required: 1,
            unknown: 0,
            untimed: 0,
          },
        }}
        sweep={{ ...sweep, waits: [bigKey] }}
      />,
    );
    const waits = screen.getByTestId("review-waits");
    expect(waits).not.toHaveTextContent("as soon as it was in logic");
    expect(within(waits).getByRole("listitem")).toHaveTextContent(
      "Eastern Palace Big Key",
    );
    expect(screen.getByTestId("review-tiles")).toHaveTextContent(
      "Longest wait1 h 10Eastern Palace Big Key",
    );
  });

  it("says nothing once the whole dungeon was in logic", () => {
    expect(dungeonContext({ ...wait, reach: 60 * MIN }, sweep)).toBeNull();
  });
});

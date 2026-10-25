import { INVERTED_MARKERS } from "@alltp/pack-alttpr";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ChecksPanel } from "@/games/alttpr/components/map/ChecksPanel";
import { MapTracker } from "@/games/alttpr/components/map/MapTracker";
import { Item } from "@/games/alttpr/components/tracker/items/Item";
import { Tooltip } from "@/games/alttpr/components/ui/Tooltip";
import { spoilerLog } from "@/games/alttpr/review/fixtures";
import {
  labelsOfLog,
  placesText,
  useMarkerHeld,
} from "@/games/alttpr/review/labels";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useReviewStore } from "@/review/store";
import { useTooltipStore } from "@/stores/tooltipStore";

const log = spoilerLog("9MQ9gO1wMD");
const labels = labelsOfLog(log);

/** The assets the board draws, by file name. */
const ASSETS = new Set(
  Object.keys(
    import.meta.glob("../../../../public/assets/*.png", { eager: false }),
  ).map((path) => path.slice(path.lastIndexOf("/") + 1)),
);

const inReview = () =>
  act(() =>
    useReviewStore.getState().open({
      binding: { facts: 0, verdict: "not-verified" },
      boundSeed: null,
      fileName: "x.txt",
      game: "alttpr",
      log,
    }),
  );

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useReviewStore.setState({ review: null });
});

describe("what a review lays on the board", () => {
  it("knows every location the log placed", () => {
    expect(labels.byLocation.size).toBe(log.placements.length);
  });

  it("holds every item's image in the assets", () => {
    const icons = new Set(
      [...labels.byLocation.values()].flatMap((held) =>
        held.icon === null ? [] : [held.icon],
      ),
    );
    expect(icons.size).toBeGreaterThan(10);
    expect([...icons].filter((icon) => !ASSETS.has(icon))).toEqual([]);
  });

  it("puts a required item before a dungeon's before the rest", () => {
    for (const marker of labels.byMarker.values()) {
      const ranks = marker.held.map(({ rank }) => rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(marker.top).toBe(marker.held[0]);
    }
    const required = [...labels.byLocation.values()].find(
      (held) => held.sphere !== null,
    );
    expect(required?.rank).toBe(0);
  });

  it("gathers a cave's several locations under its marker, in words", () => {
    const cave = INVERTED_MARKERS.find(
      (marker) => marker.dungeon === undefined && marker.locations.length > 2,
    );
    if (!cave) throw new Error("no cave");
    const held = labels.byMarker.get(cave.id);
    expect(held?.held).toHaveLength(
      cave.locations.filter((id) => labels.byLocation.has(id)).length,
    );
    expect(held?.words).toMatch(/ and \d+ more$|^.+ and .+$/);
  });

  it("lists where an item of the grid was, progressive ones in several places", () => {
    const swords = labels.byCell.get("sword");
    expect(swords?.length).toBeGreaterThan(1);
    expect(placesText(swords ?? [])).toMatch(/^\d+ places: /);
    const [one] = labels.byCell.get("hookshot") ?? [];
    expect(placesText(one ? [one] : [])).toBe(`at ${one?.where}`);
  });

  it("answers null for everything outside a review", () => {
    const Probe = () => (
      <p data-testid="probe">{String(useMarkerHeld("kings-tomb"))}</p>
    );
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });
});

describe("the map in a review", () => {
  const marker = INVERTED_MARKERS.find(
    (m) => m.dungeon === undefined && m.locations.length === 1,
  );

  it("says what a marker held, and draws it, only in a review", () => {
    if (!marker) throw new Error("no marker");
    render(<MapTracker />);
    const button = screen.getByTestId(`marker-${marker.id}`);
    const before = button.getAttribute("aria-label");
    expect(before).not.toContain("Held");
    expect(button).not.toHaveAttribute("data-review");

    inReview();
    const held = labels.byMarker.get(marker.id);
    expect(button).toHaveAttribute("data-review", "missed");
    expect(button.getAttribute("aria-label")).toBe(
      `${before}. Held: ${held?.words}; not all checked`,
    );
    if (held?.top.icon) {
      expect(button).toHaveAttribute("data-held");
      expect(button.style.getPropertyValue("--held")).toContain(held.top.icon);
    }

    // Checked: the ring says so, and so do the words
    act(() => useGameStore.getState().toggleChecks(marker.locations));
    expect(button).toHaveAttribute("data-review", "found");
    expect(button.getAttribute("aria-label")).toContain("; all checked");

    // Out of the review, the marker is what it was
    act(() => useReviewStore.getState().close());
    expect(button).not.toHaveAttribute("data-review");
    expect(button.getAttribute("aria-label")).not.toContain("Held");
  });
});

describe("the Checks list in a review", () => {
  it("names what each check held, and offers the ones missed", () => {
    render(<ChecksPanel />);
    expect(screen.queryByTestId("checks-missed-only")).toBeNull();
    expect(screen.queryAllByTestId(/^check-held-/)).toHaveLength(0);
    // A check the run can do from the start
    const id = screen
      .getAllByTestId(/^check-row-/)
      .map((row) => (row.dataset.testid ?? "").slice("check-row-".length))
      .find((location) => labels.byLocation.has(location));
    if (id === undefined) throw new Error("no check to look at");

    inReview();
    const held = labels.byLocation.get(id);
    const row = screen.getByTestId(`check-row-${id}`);
    expect(within(row).getByTestId(`check-held-${id}`)).toHaveTextContent(
      held?.name ?? "",
    );
    // In the checkbox's name, so a screen reader hears it with the check
    expect(
      within(row).getByRole("checkbox", { name: /held/ }),
    ).toBeInTheDocument();

    // Missed only: every check left, whatever the state filters say
    const total = screen.getAllByTestId(/^check-row-/).length;
    fireEvent.click(screen.getByTestId("checks-missed-only"));
    const missed = screen.getAllByTestId(/^check-row-/).length;
    expect(missed).toBeGreaterThan(total);
    act(() => useGameStore.getState().toggleChecks([id]));
    expect(screen.queryByTestId(`check-row-${id}`)).toBeNull();
    expect(screen.getAllByTestId(/^check-row-/)).toHaveLength(missed - 1);

    // Leaving the review takes it all away
    act(() => useReviewStore.getState().close());
    expect(screen.queryByTestId("checks-missed-only")).toBeNull();
    expect(screen.queryAllByTestId(/^check-held-/)).toHaveLength(0);
  });
});

describe("the grid in a review", () => {
  it("says where an item was, in its name", () => {
    render(<Item col={0} item="hookshot" row={0} />);
    const cell = screen.getByTestId("item-hookshot");
    const before = cell.getAttribute("aria-label") ?? "";
    expect(before).not.toContain(" at ");
    inReview();
    const [one] = labels.byCell.get("hookshot") ?? [];
    expect(cell.getAttribute("aria-label")).toBe(
      before.replace(". Click", `, at ${one?.where}. Click`),
    );
    act(() => useReviewStore.getState().close());
    expect(cell.getAttribute("aria-label")).toBe(before);
  });
});

describe("the tooltip in a review", () => {
  it("names what a cave's locations held and where an item was", () => {
    render(
      <>
        <MapTracker />
        <Item col={0} item="sword" row={0} />
        <Tooltip />
      </>,
    );
    fireEvent.pointerEnter(screen.getByTestId("marker-kakariko-well"), {
      pointerType: "mouse",
    });
    expect(screen.queryByTestId("tooltip-held-kakariko-well/top")).toBeNull();
    act(() => useTooltipStore.getState().hide());

    inReview();
    fireEvent.pointerEnter(screen.getByTestId("marker-kakariko-well"), {
      pointerType: "mouse",
    });
    for (const id of [
      "kakariko-well/top",
      "kakariko-well/left",
      "kakariko-well/bottom",
    ]) {
      expect(screen.getByTestId(`tooltip-held-${id}`)).toHaveTextContent(
        `→ ${labels.byLocation.get(id)?.name}`,
      );
    }
    act(() => useTooltipStore.getState().hide());

    fireEvent.pointerEnter(screen.getByTestId("item-sword"), {
      pointerType: "mouse",
    });
    expect(screen.getByTestId("tooltip-places")).toHaveTextContent(
      `Seed: ${placesText(labels.byCell.get("sword") ?? [])}`,
    );
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/games/alttpr/components/map/MapTracker";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { Tooltip } from "@/games/alttpr/components/ui/Tooltip";
import { analyzeNow } from "@/games/alttpr/hooks/useRunAnalysis";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { LONG_PRESS_MS } from "@/hooks/useTooltip";
import { useTooltipStore } from "@/stores/tooltipStore";

const tooltip = () => screen.queryByTestId("tooltip");

const renderMap = () =>
  render(
    <>
      <MapTracker />
      <Tooltip />
    </>,
  );

describe("Tooltip", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useTooltipStore.getState().hide();
      useAnalysisStore.setState({ analysis: null });
    });
  });

  afterEach(() => vi.useRealTimers());

  /** The rows of the tooltip's list: each location's label and state. */
  const rows = () =>
    [
      ...(screen.queryByTestId("tooltip-checks")?.querySelectorAll("li") ?? []),
    ].map((row) => `${row.textContent} ${row.className.replace(/^.*--/, "")}`);

  it("lists a marker's locations with their state on mouse hover", () => {
    act(() => useGameStore.getState().toggleChecks(["kakariko-well/top"]));
    renderMap();

    fireEvent.pointerEnter(screen.getByTestId("marker-kakariko-well"), {
      pointerType: "mouse",
    });

    expect(tooltip()).toHaveTextContent(/^Kakariko Well/);
    expect(rows()).toEqual([
      "Top opened",
      "Left available",
      "Middle available",
      "Right available",
      "Bottom available",
    ]);
    // The marker's own name says its name and state: only the rest, each
    // location's state, describes it
    const detail = screen.getByRole("tooltip");
    expect(detail).toBe(screen.getByTestId("tooltip-detail"));
    expect(detail).toContainElement(screen.getByTestId("tooltip-checks"));
    expect(
      screen.getByTestId("marker-kakariko-well"),
    ).toHaveAccessibleDescription(/^Top Left Middle Right Bottom$/);
    expect(
      tooltip()?.querySelector(".tooltip__title")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("says a one-location marker's state beside its name, out of its description", () => {
    act(() => analyzeNow());
    renderMap();
    const marker = screen.getByTestId("marker-links-house");

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });

    expect(rows()).toEqual(["Available available"]);
    // Nothing the name does not say: no description
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(marker).not.toHaveAttribute("aria-describedby");
  });

  it("says what a check out of logic is missing, and describes its marker with it", () => {
    act(() => analyzeNow());
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });

    expect(rows()).toEqual(["Out of logic unavailable"]);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      /^Missing: Titan's Mitt \+ Pegasus Boots$/,
    );
    expect(marker).toHaveAccessibleDescription(
      "Missing: Titan's Mitt + Pegasus Boots",
    );
    // Each thing with its cell's icon
    expect(
      [...screen.getByRole("tooltip").querySelectorAll("img")].map((img) =>
        img.getAttribute("src")?.split("/").at(-1),
      ),
    ).toEqual(["glove2.png", "boots.png"]);

    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    act(() => useTooltipStore.getState().hide());
    expect(marker).not.toHaveAttribute("aria-describedby");
  });

  it("waits for the run's analysis, and never shows another run's", () => {
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("marker-kings-tomb"), {
      pointerType: "mouse",
    });
    expect(screen.queryByTestId("tooltip-missing")).toBeNull();

    act(() => analyzeNow());
    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      "Titan's Mitt + Pegasus Boots",
    );

    // Boots found: the analysis waits for the browser's idle time
    act(() => useGameStore.getState().handleItemClick("boots"));
    expect(screen.queryByTestId("tooltip-missing")).toBeNull();
    act(() => analyzeNow());
    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      /^Missing: Titan's Mitt$/,
    );
  });

  it("names the checks of a cave that miss different things", () => {
    act(() => analyzeNow());
    renderMap();

    fireEvent.pointerEnter(screen.getByTestId("marker-hyrule-castle"), {
      pointerType: "mouse",
    });

    expect(
      screen
        .getAllByTestId("tooltip-missing")
        .map((entry) => entry.textContent),
    ).toEqual([
      // The escape's key may wait in a room the castle's other checks
      // need no more for
      "Boomerang Chest, Zelda's CellMaybe: Hyrule Castle's small key may be behind Sewers - Secret Room - Left, Sewers - Secret Room - Middle, Sewers - Secret Room - Right or Sewers - Dark Cross",
      "Sewers - Dark CrossMissing: Fire Rod, or Lantern",
    ]);
  });

  it("says what a dungeon's boss is missing, until beaten", () => {
    act(() => analyzeNow());
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("boss-marker-tower-of-hera"), {
      pointerType: "mouse",
    });

    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      /^BossMissing: Flute \+ Hammer \+ Hookshot, or /,
    );
    act(() => {
      useGameStore.getState().handleItemClick("boss2");
      analyzeNow();
    });
    expect(screen.queryByTestId("tooltip-missing")).toBeNull();
  });

  it("says why a check is only possible", () => {
    act(() => {
      const state = useGameStore.getState();
      for (const item of [
        "bombos",
        "flute",
        "hookshot",
        "lantern",
        "moonpearl",
      ]) {
        state.handleItemClick(item);
      }
      state.handleItemClick("glove");
      state.handleItemClick("glove");
      state.handleItemClick("sword");
      analyzeNow();
    });
    renderMap();

    fireEvent.pointerEnter(screen.getByTestId("boss-marker-misery-mire"), {
      pointerType: "mouse",
    });
    // The boss wants the Cane of Somaria too: out of logic
    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      "Possible with: Cane of Somaria",
    );
    act(() => {
      useGameStore.getState().handleItemClick("somaria");
      analyzeNow();
    });
    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      "In logic with: Ether Medallion + Quake Medallion" +
        "Maybe: Misery Mire's medallion is not noted yet",
    );
  });

  it("says a location seen from afar is visible, not reachable yet", () => {
    renderMap();

    fireEvent.pointerEnter(screen.getByTestId("marker-lake-hylia-island"), {
      pointerType: "mouse",
    });

    expect(rows()).toEqual(["Visible, not reachable yet seen"]);
    expect(
      screen.getByTestId("tooltip-checks").querySelector(".state-glyph"),
    ).toHaveClass("seen");
  });

  it("gives a dungeon's items left, those surely in logic, and each chest", () => {
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("boss-marker-eastern-palace"), {
      pointerType: "mouse",
    });

    // Its big key chest is dark, its big chest and boss want that key: the
    // three items left may all be there
    expect(screen.getByTestId("tooltip-count")).toHaveTextContent(
      /^3 items left$/,
    );
    expect(rows()).toEqual([
      "Compass Chest available",
      "Big Chest possible",
      "Cannonball Chest available",
      "Big Key Chest unavailable",
      "Map Chest available",
      "Boss unavailable",
    ]);

    act(() => {
      const state = useGameStore.getState();
      state.handleItemClick("bow");
      state.handleItemClick("bow");
      state.handleItemClick("lantern");
      state.handleItemClick("chest0");
    });

    expect(screen.getByTestId("tooltip-count")).toHaveTextContent(
      "2 items left, at least 2 in logic",
    );
    expect(rows().every((row) => row.endsWith(" available"))).toBe(true);
  });

  it("shows on keyboard focus and hides on blur", () => {
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");

    act(() => marker.focus());
    expect(tooltip()).toHaveTextContent("King's Tomb");

    act(() => marker.blur());
    expect(tooltip()).toBeNull();
  });

  it("is dismissed with Escape", () => {
    renderMap();
    act(() => screen.getByTestId("marker-kings-tomb").focus());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(tooltip()).toBeNull();
  });

  /** Lay the tooltip out at 100,100 – 300,140: jsdom does no layout. */
  const placeTooltip = () =>
    vi
      .spyOn(tooltip() as HTMLElement, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(100, 100, 200, 40));
  const mouse = { clientX: 150, clientY: 120, pointerType: "mouse" };

  it("stays while the pointer moves from its marker onto it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    placeTooltip();
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerMove(document.body, mouse);
    act(() => vi.advanceTimersByTime(500));

    expect(tooltip()).toHaveTextContent("King's Tomb");
  });

  it("stays when it opened under the pointer, which then moves within it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");
    const covered = screen.getByTestId("marker-dam");
    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    placeTooltip();
    // The browser moves the pointer again once the tooltip is laid out
    // over it: the pointer is on the tooltip before it has moved at all
    fireEvent.pointerMove(marker, mouse);

    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerEnter(covered, mouse);
    fireEvent.pointerMove(covered, mouse);
    act(() => vi.advanceTimersByTime(500));

    expect(tooltip()).toHaveTextContent("King's Tomb");
  });

  it("is not taken over by a control it covers, until the pointer leaves it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");
    const covered = screen.getByTestId("marker-dam");
    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    placeTooltip();

    // On the tooltip, over another marker: still the first one's
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerEnter(covered, mouse);
    fireEvent.pointerMove(covered, mouse);
    act(() => vi.advanceTimersByTime(500));
    expect(tooltip()).toHaveTextContent("King's Tomb");

    // Off the tooltip, still on that marker: now its own
    fireEvent.pointerMove(covered, { ...mouse, clientY: 200 });
    expect(tooltip()).not.toHaveTextContent("King's Tomb");
  });

  it("hides once the pointer leaves it for anything but its anchor", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");
    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    placeTooltip();
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerMove(document.body, mouse);

    fireEvent.pointerMove(document.body, { ...mouse, clientX: 400 });
    act(() => vi.advanceTimersByTime(500));

    expect(tooltip()).toBeNull();
  });

  it("hides on a press on it, which goes to the control it covers", () => {
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("marker-kings-tomb"), {
      pointerType: "mouse",
    });

    // The browser sends a press on the tooltip to what lies under it
    fireEvent.pointerDown(screen.getByTestId("marker-dam"), mouse);

    expect(tooltip()).toBeNull();
  });

  it("follows the medallion picked while a dungeon is shown", () => {
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("boss-marker-misery-mire"), {
      pointerType: "mouse",
    });
    const icon = () =>
      tooltip()?.querySelector("img[src$='medallion2.png']") ?? null;
    expect(icon()).toBeNull();

    act(() => useGameStore.getState().handleMedallionChange(8, 2));

    expect(icon()).not.toBeNull();
  });

  it("shows on a touch long-press without toggling the chest, then a tap elsewhere hides it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");

    fireEvent.pointerDown(marker, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerUp(marker, { pointerType: "touch" });
    fireEvent.click(marker);

    expect(tooltip()).toHaveTextContent("King's Tomb");
    expect(useGameStore.getState().checked).toEqual({});

    fireEvent.pointerDown(document.body);
    expect(tooltip()).toBeNull();
  });

  it("leaves a quick tap to the control", () => {
    renderMap();
    const marker = screen.getByTestId("marker-kings-tomb");

    fireEvent.pointerDown(marker, { pointerType: "touch" });
    fireEvent.pointerUp(marker, { pointerType: "touch" });
    fireEvent.click(marker);

    expect(useGameStore.getState().checked).toEqual({ "kings-tomb": true });
    expect(tooltip()).toBeNull();
  });

  it("names a grid item, and a boss cell shows what its dungeon needs", () => {
    render(
      <>
        <TrackerGrid itemLayout={[["powder", "boss8"]]} />
        <Tooltip />
      </>,
    );

    fireEvent.pointerEnter(screen.getByTestId("item-powder"), {
      pointerType: "mouse",
    });
    expect(tooltip()).toHaveTextContent("Magic Powder");

    fireEvent.pointerEnter(screen.getByTestId("item-boss8"), {
      pointerType: "mouse",
    });
    expect(tooltip()).toHaveTextContent("Misery Mire");
  });

  describe("keyboard shortcuts", () => {
    const renderGrid = () =>
      render(
        <>
          <TrackerGrid itemLayout={[["hookshot", "boss8", "net"]]} />
          <Tooltip />
        </>,
      );
    const hover = (testId: string) =>
      fireEvent.pointerEnter(screen.getByTestId(testId), {
        pointerType: "mouse",
      });
    const keys = () => screen.queryByTestId("tooltip-keys");

    it("shows an item's keys, forward and back, under its name", () => {
      renderGrid();

      hover("item-hookshot");

      expect(tooltip()).toHaveTextContent(/^Hookshot/);
      expect(keys()).toHaveTextContent(/^W\s*back\s*Shift\s*\+\s*W$/);
      // Two chords, each a <kbd> of <kbd> keys
      const chords = [...(keys()?.querySelectorAll("kbd") ?? [])].filter(
        (kbd) => kbd.parentElement?.tagName !== "KBD",
      );
      expect(chords).toHaveLength(2);
    });

    it("shows the keys of a dungeon's cell, each named", () => {
      act(() =>
        useGameStore.getState().setKeymap({
          "advance:chest8": "Digit9",
          "advance:medallion8": "BracketLeft",
        }),
      );
      renderGrid();

      hover("item-boss8");

      expect(keys()).toHaveTextContent(/^Medallion\s*\[\s*Chests\s*9$/);
    });

    it("shows no keys for an unbound item, nor while shortcuts are off", () => {
      act(() => useGameStore.getState().setKeymap({}));
      renderGrid();
      hover("item-net");
      expect(keys()).toBeNull();

      act(() => {
        useGameStore.getState().setKeymap({ "advance:net": "KeyM" });
        useGameStore.getState().setShortcutsEnabled(false);
      });
      hover("item-net");
      expect(tooltip()).toHaveTextContent("Bug Net");
      expect(keys()).toBeNull();
    });
  });
});

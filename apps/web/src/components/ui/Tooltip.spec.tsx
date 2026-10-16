import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { Tooltip } from "@/components/ui/Tooltip";
import { LONG_PRESS_MS } from "@/hooks/useTooltip";
import { useGameStore } from "@/stores/gameStore";
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
    });
  });

  afterEach(() => vi.useRealTimers());

  it("shows a chest's requirements, icons included, on mouse hover", () => {
    renderMap();

    fireEvent.pointerEnter(screen.getByTestId("chest-marker-0"), {
      pointerType: "mouse",
    });

    expect(tooltip()).toHaveTextContent("King's Tomb");
    expect(tooltip()?.querySelectorAll("img.mini")).toHaveLength(3);
    // The text is in the marker's own name already: keep it out of the a11y tree
    expect(tooltip()).toHaveAttribute("aria-hidden", "true");
  });

  it("shows on keyboard focus and hides on blur", () => {
    renderMap();
    const marker = screen.getByTestId("chest-marker-0");

    act(() => marker.focus());
    expect(tooltip()).toHaveTextContent("King's Tomb");

    act(() => marker.blur());
    expect(tooltip()).toBeNull();
  });

  it("is dismissed with Escape", () => {
    renderMap();
    act(() => screen.getByTestId("chest-marker-0").focus());

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
    const marker = screen.getByTestId("chest-marker-0");

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    placeTooltip();
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerMove(document.body, mouse);
    act(() => vi.advanceTimersByTime(500));

    expect(tooltip()).toHaveTextContent("King's Tomb");
  });

  it("is not taken over by a control it covers, until the pointer leaves it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("chest-marker-0");
    const covered = screen.getByTestId("chest-marker-1");
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
    const marker = screen.getByTestId("chest-marker-0");
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
    fireEvent.pointerEnter(screen.getByTestId("chest-marker-0"), {
      pointerType: "mouse",
    });

    // The browser sends a press on the tooltip to what lies under it
    fireEvent.pointerDown(screen.getByTestId("chest-marker-1"), mouse);

    expect(tooltip()).toBeNull();
  });

  it("follows the medallion picked while a dungeon is shown", () => {
    renderMap();
    fireEvent.pointerEnter(screen.getByTestId("boss-marker-8"), {
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
    const marker = screen.getByTestId("chest-marker-0");

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
    const marker = screen.getByTestId("chest-marker-0");

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
      expect(keys()).toHaveTextContent(/^W\s*back\s*Shift\+W$/);
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

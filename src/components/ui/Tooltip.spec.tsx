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

  it("stays while the pointer moves from its marker onto it", () => {
    vi.useFakeTimers();
    renderMap();
    const marker = screen.getByTestId("chest-marker-0");

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.pointerEnter(tooltip() as HTMLElement);
    act(() => vi.advanceTimersByTime(500));

    expect(tooltip()).not.toBeNull();
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
    expect(useGameStore.getState().chestsOpened[0]).toBe(false);

    fireEvent.pointerDown(document.body);
    expect(tooltip()).toBeNull();
  });

  it("leaves a quick tap to the control", () => {
    renderMap();
    const marker = screen.getByTestId("chest-marker-0");

    fireEvent.pointerDown(marker, { pointerType: "touch" });
    fireEvent.pointerUp(marker, { pointerType: "touch" });
    fireEvent.click(marker);

    expect(useGameStore.getState().chestsOpened[0]).toBe(true);
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
});

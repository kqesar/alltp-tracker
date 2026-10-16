import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { useGameStore } from "@/stores/gameStore";

/**
 * Drives the arrow keys against a real rendered grid: keys go to the focused
 * control and bubble to the grid, exactly as in the browser.
 */
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement as HTMLElement, { key, ...init });

const focused = () => document.activeElement?.getAttribute("data-testid");

/** Controls of the grid currently reachable with Tab. */
const tabStops = () =>
  document.querySelectorAll('[data-grid-row][tabindex="0"]');

const layout = [
  ["bow", "", "hammer"],
  ["sword", "boots", "flute"],
];

describe("grid keyboard navigation", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("is a single Tab stop that follows the last control used", () => {
    render(<TrackerGrid itemLayout={layout} />);

    expect(tabStops()).toHaveLength(1);
    expect(screen.getByTestId("item-bow")).toHaveAttribute("tabindex", "0");

    act(() => screen.getByTestId("item-boots").focus());

    expect(tabStops()).toHaveLength(1);
    expect(screen.getByTestId("item-boots")).toHaveAttribute("tabindex", "0");
  });

  it("moves along a row, skipping empty cells and wrapping within the row", () => {
    render(<TrackerGrid itemLayout={layout} />);
    act(() => screen.getByTestId("item-bow").focus());

    press("ArrowRight");
    expect(focused()).toBe("item-hammer");

    press("ArrowRight");
    expect(focused()).toBe("item-bow");

    press("ArrowLeft");
    expect(focused()).toBe("item-hammer");
  });

  it("moves to the nearest column of the next row, wrapping top to bottom", () => {
    render(<TrackerGrid itemLayout={layout} />);
    act(() => screen.getByTestId("item-hammer").focus());

    press("ArrowDown");
    expect(focused()).toBe("item-flute");

    act(() => screen.getByTestId("item-bow").focus());
    press("ArrowUp");
    expect(focused()).toBe("item-sword");
  });

  it("jumps to the ends of the row with Home / End, of the grid with Ctrl", () => {
    render(<TrackerGrid itemLayout={layout} />);
    act(() => screen.getByTestId("item-boots").focus());

    press("Home");
    expect(focused()).toBe("item-sword");
    press("End");
    expect(focused()).toBe("item-flute");
    press("Home", { ctrlKey: true });
    expect(focused()).toBe("item-bow");
    press("End", { ctrlKey: true });
    expect(focused()).toBe("item-flute");
  });

  it("reaches every overlay of a boss cell, in reading order", () => {
    render(<TrackerGrid itemLayout={[["boss8", "bow"]]} />);
    act(() => screen.getByTestId("item-boss8").focus());

    const visited = [focused()];
    for (let step = 0; step < 4; step++) {
      press("ArrowRight");
      visited.push(focused());
    }

    expect(visited).toEqual([
      "item-boss8",
      "medallion-overlay-8",
      "chest-overlay-8",
      "reward-overlay-8",
      "item-bow",
    ]);
  });

  it("reaches both keys of a keysanity cell", () => {
    act(() => useGameStore.getState().setBigKeysVisible(true));
    render(<TrackerGrid itemLayout={[["bigkey3", "bow"]]} />);
    act(() => screen.getByTestId("big-key-3").focus());

    press("ArrowRight");
    expect(focused()).toBe("small-key-3");
    press("ArrowRight");
    expect(focused()).toBe("item-bow");
  });

  it("keeps a Tab stop when the control holding it disappears", () => {
    act(() => useGameStore.getState().setBigKeysVisible(true));
    render(<TrackerGrid itemLayout={[["bigkey3", "bow"]]} />);
    act(() => screen.getByTestId("small-key-3").focus());

    act(() => useGameStore.getState().setBigKeysVisible(false));

    expect(tabStops()).toHaveLength(1);
    expect(screen.getByTestId("item-bow")).toHaveAttribute("tabindex", "0");
  });

  it("leaves focus alone for keys it does not handle", () => {
    render(<TrackerGrid itemLayout={layout} />);
    act(() => screen.getByTestId("item-boots").focus());

    press("a");

    expect(focused()).toBe("item-boots");
  });
});

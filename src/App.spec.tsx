import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import App from "./App";

// Mock the MapTracker component since it's tested separately
vi.mock("@/components/map/MapTracker", () => ({
  MapTracker: () => <div data-testid="map-tracker" />,
}));

// Mock CSS import
vi.mock("@/styles/index.css", () => ({}));

describe("App", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("renders the header, the item grid and the map", () => {
    render(<App />);

    expect(screen.getByText("ALLTP Tracker")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByTestId("item-grid")).toHaveAccessibleName(
      "Item tracker grid",
    );
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("toggles a boolean item on and off", () => {
    render(<App />);
    const hookshot = screen.getByTestId("item-hookshot");

    expect(hookshot).toHaveAccessibleName(/^Hookshot, not obtained\./);

    fireEvent.click(hookshot);
    expect(hookshot).toHaveAccessibleName(/^Hookshot, obtained\./);

    fireEvent.click(hookshot);
    expect(hookshot).toHaveAccessibleName(/^Hookshot, not obtained\./);
  });

  it("steps a progressive item up and wraps back to none", () => {
    render(<App />);
    const sword = screen.getByTestId("item-sword");

    for (let level = 1; level <= 4; level++) {
      fireEvent.click(sword);
      expect(sword).toHaveAccessibleName(
        new RegExp(`^Sword, level ${level}\\.`),
      );
    }

    fireEvent.click(sword);
    expect(sword).toHaveAccessibleName(/^Sword, not obtained\./);
  });

  it("announces a boss as alive until it is marked beaten", () => {
    render(<App />);
    const armos = screen.getByTestId("item-boss0");

    expect(armos).toHaveAccessibleName(/^Armos Knights, not defeated\./);

    fireEvent.click(armos);
    expect(armos).toHaveAccessibleName(/^Armos Knights, defeated\./);
  });

  it("gives every boss a chest counter and a reward, and a medallion to Misery Mire and Turtle Rock only", () => {
    render(<App />);

    for (let boss = 0; boss < 10; boss++) {
      expect(screen.getByTestId(`chest-overlay-${boss}`)).toBeInTheDocument();
      expect(screen.getByTestId(`reward-overlay-${boss}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^medallion-overlay-/)).toHaveLength(2);
    expect(screen.getByTestId("medallion-overlay-8")).toBeInTheDocument();
    expect(screen.getByTestId("medallion-overlay-9")).toBeInTheDocument();
  });

  it("counts a dungeon's chests down from its overlay without touching the boss", () => {
    render(<App />);
    const chestCounter = screen.getByTestId("chest-overlay-0");

    expect(chestCounter.style.backgroundImage).toContain("chest3.png");

    fireEvent.click(chestCounter);

    expect(chestCounter.style.backgroundImage).toContain("chest2.png");
    expect(useGameStore.getState().items.boss0).toBe(1);
  });

  it("stacks the map when the stacked layout is selected", () => {
    useGameStore.getState().setMapLayout("side-by-side");
    render(<App />);

    expect(screen.getByTestId("layout")).not.toHaveClass("layout--stacked");

    act(() => {
      useGameStore.getState().setMapLayout("stacked");
    });

    expect(screen.getByTestId("layout")).toHaveClass("layout--stacked");
  });
});

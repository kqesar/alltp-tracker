import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { useGameStore } from "@/stores/gameStore";

describe("MapTracker", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("draws one marker per chest, and a boss and a chest marker per dungeon", () => {
    render(<MapTracker />);

    expect(screen.getAllByTestId(/^chest-marker-/)).toHaveLength(chests.length);
    expect(screen.getAllByTestId(/^boss-marker-/)).toHaveLength(
      dungeons.length,
    );
    expect(screen.getAllByTestId(/^dungeon-marker-/)).toHaveLength(
      dungeons.length,
    );
  });

  it("renders without React warnings such as duplicate keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<MapTracker />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("recolours markers when the items held change", () => {
    render(<MapTracker />);
    // King's Tomb needs boots and either Titan's Mitt or the Dark World route
    const kingsTomb = screen.getByTestId("chest-marker-0");

    expect(kingsTomb).toHaveClass("unavailable");

    act(() => {
      const { handleItemClick } = useGameStore.getState();
      handleItemClick("boots");
      handleItemClick("glove");
      handleItemClick("glove");
    });

    expect(kingsTomb).toHaveClass("available");
  });

  it("does not demand big keys outside keysanity, even while they are displayed", () => {
    act(() => {
      const state = useGameStore.getState();
      state.setBigKeysVisible(true);
      state.handleItemClick("bow");
      state.handleItemClick("bow");
    });
    render(<MapTracker />);

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("available");
  });

  it("demands the big key in keysanity, even while key cells are hidden", () => {
    act(() => {
      const state = useGameStore.getState();
      state.applyPreset("keysanity");
      state.setBigKeysVisible(false);
      state.handleItemClick("bow");
      state.handleItemClick("bow");
    });
    render(<MapTracker />);

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("unavailable");

    act(() => useGameStore.getState().handleItemClick("bigkey0"));

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("available");
  });

  it("marks a chest opened when it is clicked", () => {
    render(<MapTracker />);

    fireEvent.click(screen.getByTestId("chest-marker-0"));

    expect(screen.getByTestId("chest-marker-0")).toHaveClass("opened");
    expect(useGameStore.getState().chestsOpened[0]).toBe(true);
  });
});

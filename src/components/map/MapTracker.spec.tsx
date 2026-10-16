import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { useGameStore } from "@/stores/gameStore";

describe("MapTracker", () => {
  beforeEach(() => {
    act(() => useGameStore.getState().applyPreset("open"));
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

  it("marks a chest opened when it is clicked", () => {
    render(<MapTracker />);

    fireEvent.click(screen.getByTestId("chest-marker-0"));

    expect(screen.getByTestId("chest-marker-0")).toHaveClass("opened");
    expect(useGameStore.getState().chestsState[0].isOpened).toBe(true);
  });
});

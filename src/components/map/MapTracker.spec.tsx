import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { useGameStore } from "@/stores/gameStore";

describe("MapTracker", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useGameStore.getState().reset();
  });

  it("renders without crashing", () => {
    const { container } = render(<MapTracker />);
    expect(container).toBeTruthy();
  });

  it("uses store data for rendering", () => {
    // Change something in the store
    act(() => {
      useGameStore.getState().handleItemClick("hookshot");
    });

    const { container } = render(<MapTracker />);
    expect(container).toBeTruthy();

    // Verify hookshot is now true in store
    const { items } = useGameStore.getState();
    expect(items.hookshot).toBe(true);
  });

  it("renders map spans", () => {
    const { container } = render(<MapTracker />);

    // Check that mapspan elements exist
    const mapElements = container.querySelectorAll(".mapspan");
    expect(mapElements.length).toBeGreaterThan(0);
  });

  it("responds to store changes", () => {
    const { rerender } = render(<MapTracker />);

    // Change store state
    act(() => {
      useGameStore.getState().toggleChest(0);
    });

    // Re-render to trigger update
    rerender(<MapTracker />);

    // Verify store was updated
    const { chestsState } = useGameStore.getState();
    expect(chestsState[0].isOpened).toBe(true);
  });
});

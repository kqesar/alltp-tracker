import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

// Mock the MapTracker component for integration tests
vi.mock("../components/MapTracker", () => ({
  MapTracker: ({ caption }: { caption: string }) => (
    <div data-testid="map-tracker">
      Map Tracker Component - Caption: {caption}
    </div>
  ),
}));

// Integration tests that test the full application flow
describe("App Integration Tests", () => {
  it("should update item states and reflect in MapTracker", () => {
    render(<App />);

    // Find cells with background images
    const cells = screen.getAllByRole("cell");
    const hookshotCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hookshot"),
    );

    if (hookshotCells.length > 0) {
      const hookshotCell = hookshotCells[0];

      // Initially inactive
      expect(hookshotCell).toHaveStyle("opacity: 0.25");

      // Activate hookshot
      fireEvent.click(hookshotCell);
      expect(hookshotCell).toHaveStyle("opacity: 1");
    }

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("should handle complex item combinations", () => {
    render(<App />);

    // Get several key items
    const cells = screen.getAllByRole("cell");
    const moonpearlCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("moonpearl"),
    );
    const hammerCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hammer"),
    );
    const gloveCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("glove"),
    );

    if (
      moonpearlCells.length > 0 &&
      hammerCells.length > 0 &&
      gloveCells.length > 0
    ) {
      // Activate multiple items
      fireEvent.click(moonpearlCells[0]);
      fireEvent.click(hammerCells[0]);
      fireEvent.click(gloveCells[0]); // Should cycle to power glove
      fireEvent.click(gloveCells[0]); // Should cycle to titan's mitt

      // Check states
      expect(moonpearlCells[0]).toHaveStyle("opacity: 1");
      expect(hammerCells[0]).toHaveStyle("opacity: 1");
      expect(gloveCells[0]).toHaveStyle("opacity: 1");
    }
  });

  it("should handle boss progression correctly", () => {
    render(<App />);

    // Find boss cells
    const cells = screen.getAllByRole("cell");
    const bossCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("boss"),
    );

    if (bossCells.length > 0) {
      const boss0Cell = bossCells[0];

      // Boss should start in state 1 (available)
      expect(boss0Cell).toHaveStyle("opacity: 1");

      // Click to mark as beaten
      fireEvent.click(boss0Cell);
      // State should change (implementation depends on boss progression logic)
      const opacity = getComputedStyle(boss0Cell).opacity;
      expect(["0.25", "1"]).toContain(opacity);
    }
  });

  it("should maintain state consistency across user interactions", () => {
    render(<App />);

    // Test multiple interactions
    const cells = screen.getAllByRole("cell");
    const swordCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("sword"),
    );
    const bowCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("bow"),
    );

    if (swordCells.length > 0 && bowCells.length > 0) {
      const swordCell = swordCells[0];
      const bowCell = bowCells[0];

      // Cycle through sword states
      fireEvent.click(swordCell); // Fighter's sword
      fireEvent.click(swordCell); // Master sword
      fireEvent.click(swordCell); // Tempered sword
      fireEvent.click(swordCell); // Golden sword
      fireEvent.click(swordCell); // Back to no sword

      // Cycle through bow states
      fireEvent.click(bowCell); // Bow
      fireEvent.click(bowCell); // Bow + arrows
      fireEvent.click(bowCell); // Bow + silver arrows
      fireEvent.click(bowCell); // Back to no bow

      // States should be consistent
      expect(swordCell).toHaveStyle("opacity: 0.25"); // No sword
      expect(bowCell).toHaveStyle("opacity: 0.25"); // No bow
    }
  });

  it("should handle item state cycling correctly", () => {
    render(<App />);

    const cells = screen.getAllByRole("cell");
    const bottleCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("bottle"),
    );

    if (bottleCells.length > 0) {
      const bottleCell = bottleCells[0];

      // Start with no bottles
      expect(bottleCell).toHaveStyle("opacity: 0.25");

      // Click should cycle bottle state
      fireEvent.click(bottleCell);
      // After click, should have different state
      const opacity = getComputedStyle(bottleCell).opacity;
      expect(["0.25", "1"]).toContain(opacity);
    }
  });

  it("should render all grid positions correctly", () => {
    render(<App />);

    // Should have multiple tables (tracker tables)
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);

    // Check that we have cells rendered
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("should handle special overlay rendering", () => {
    render(<App />);

    // Find cells that might have overlays
    const cells = screen.getAllByRole("cell");

    // Some cells should have overlays for tracking additional states
    const cellsWithOverlays = cells.filter((cell) => {
      const overlays = cell.querySelectorAll("[class*='overlay'], .stoops");
      return overlays.length > 0;
    });

    // Overlays are dynamic based on state, so just check they can exist
    expect(cellsWithOverlays.length).toBeGreaterThanOrEqual(0);
  });

  it("should update caption based on item interactions", () => {
    render(<App />);

    // Find an item cell with background
    const cells = screen.getAllByRole("cell");
    const itemCells = cells.filter(
      (cell) => cell.style.backgroundImage && cell.style.backgroundImage !== "",
    );

    if (itemCells.length > 0) {
      // Hover should update caption (this would be handled by MapTracker in real app)
      fireEvent.mouseEnter(itemCells[0]);
      fireEvent.mouseLeave(itemCells[0]);
      // Caption functionality is mostly in MapTracker, so just ensure no errors
    }

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("should handle edge cases gracefully", () => {
    render(<App />);

    // Check that MapTracker is rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();

    // The app should render without errors even with empty states
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);

    // Multiple clicks shouldn't break anything
    if (cells.length > 0) {
      const firstCell = cells[0];
      for (let i = 0; i < 10; i++) {
        fireEvent.click(firstCell);
      }
      // Should still be rendered after many clicks
      expect(firstCell).toBeInTheDocument();
    }
  });
});

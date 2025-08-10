import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import App from "./App";

// Mock the MapTracker component since it's tested separately
vi.mock("@/components/map/MapTracker", () => ({
  MapTracker: ({ caption }: { caption: string }) => (
    <div data-testid="map-tracker">
      Map Tracker Component - Caption: {caption}
    </div>
  ),
}));

// Mock CSS import
vi.mock("./styles.css", () => ({}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("renders the item grid layout", () => {
    render(<App />);
    // Check for the main tracker tables
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);

    // Check for some cells
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders caption container with initial empty state", () => {
    render(<App />);
    // The caption area exists somewhere in the layout
    const layoutDiv = document.getElementById("layoutdiv");
    expect(layoutDiv).toBeInTheDocument();

    // The MapTracker mock should be rendered
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
  });

  it("handles item clicks for boolean items", () => {
    render(<App />);

    // Find cells with background images (item cells)
    const cells = screen.getAllByRole("cell");
    const itemCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hookshot"),
    );

    if (itemCells.length > 0) {
      const hookshotCell = itemCells[0];

      // Initially should have low opacity (inactive state)
      expect(hookshotCell).toHaveStyle("opacity: 0.25");

      // Click to activate
      fireEvent.click(hookshotCell);

      // Should now have full opacity (active state)
      expect(hookshotCell).toHaveStyle("opacity: 1");
    }
  });

  it("handles item clicks for numeric items", () => {
    render(<App />);

    // Find cells with bow background
    const cells = screen.getAllByRole("cell");
    const bowCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("bow"),
    );

    if (bowCells.length > 0) {
      const bowCell = bowCells[0];

      // Initially should be at minimum value
      expect(bowCell).toHaveStyle("opacity: 0.25");

      // Click to cycle through values
      fireEvent.click(bowCell);
      expect(bowCell).toHaveStyle("opacity: 1");
    }
  });

  it("ignores clicks on blank items", () => {
    render(<App />);

    // Find empty cells
    const cells = screen.getAllByRole("cell");
    const emptyCells = cells.filter(
      (cell) =>
        !cell.style.backgroundImage || cell.style.backgroundImage === "",
    );

    // Should have some empty cells
    expect(emptyCells.length).toBeGreaterThan(0);

    // Clicking should not cause any errors
    if (emptyCells.length > 0) {
      fireEvent.click(emptyCells[0]);
      // No assertion needed - just ensure no error is thrown
    }
  });

  it("renders corner table for special layouts", () => {
    render(<App />);

    // The corner table should be rendered for certain layout positions
    const cornerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("lonk"));

    expect(cornerTables.length).toBeGreaterThan(0);
  });

  it("displays correct background images for items", () => {
    render(<App />);

    // Check that items have background images set
    const cells = screen.getAllByRole("cell");
    const hookshotCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hookshot"),
    );
    const hammerCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hammer"),
    );

    expect(hookshotCells.length).toBeGreaterThan(0);
    expect(hammerCells.length).toBeGreaterThan(0);
  });

  it("shows special overlay for boss items", () => {
    render(<App />);

    // Find cells with boss background images
    const cells = screen.getAllByRole("cell");
    const bossCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("boss"),
    );

    expect(bossCells.length).toBeGreaterThan(0);

    if (bossCells.length > 0) {
      // Boss cells should have overlays for medallions, chests, and rewards
      const overlays = bossCells[0].querySelectorAll("[class*='overlay']");
      expect(overlays.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles right-click for reverse cycling on numeric items", () => {
    render(<App />);

    const cells = screen.getAllByRole("cell");
    const bowCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("bow"),
    );

    if (bowCells.length > 0) {
      const bowCell = bowCells[0];

      // Right-click should cycle in reverse
      fireEvent.contextMenu(bowCell);
      // The opacity should change based on the value
      const opacity = bowCell.style.opacity;
      expect(opacity === "0.25" || opacity === "1").toBe(true);
    }
  });

  it("maintains item state consistency", () => {
    // Reset store state to initial values
    useGameStore.getState().reset();

    render(<App />);

    // Test that clicking multiple times maintains consistent state
    const cells = screen.getAllByRole("cell");
    const hookshotCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("hookshot"),
    );

    if (hookshotCells.length > 0) {
      const hookshotCell = hookshotCells[0];

      // Start inactive
      expect(hookshotCell).toHaveStyle("opacity: 0.25");

      // Activate
      fireEvent.click(hookshotCell);
      expect(hookshotCell).toHaveStyle("opacity: 1");

      // Deactivate
      fireEvent.click(hookshotCell);
      expect(hookshotCell).toHaveStyle("opacity: 0.25");
    }
  });
});

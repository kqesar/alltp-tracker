import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

/**
 * Integration tests to verify GridRow component integration in App
 */
describe("App - GridRow Integration", () => {
  it("should render all grid rows through GridRow component", () => {
    render(<App />);

    // The defaultItemGrid has 6 rows, so we should have 6 tables with class "tracker"
    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));
    expect(trackerTables).toHaveLength(6);
  });

  it("should render correct table structure for each row", () => {
    render(<App />);

    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));

    // Check first table structure
    if (trackerTables.length > 0) {
      const firstTable = trackerTables[0];

      // Should have tbody
      const tbody = firstTable.querySelector("tbody");
      expect(tbody).toBeInTheDocument();

      // Should have cells (halfcells + grid items) - we don't need to check tr count due to nested tables
      const cells = firstTable.querySelectorAll("td");
      expect(cells.length).toBeGreaterThanOrEqual(2); // At least 2 halfcells
    }
  });

  it("should maintain halfcell structure in all rows", () => {
    render(<App />);

    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));

    trackerTables.forEach((table) => {
      const cells = table.querySelectorAll("td");
      const halfCells = Array.from(cells).filter((cell) =>
        cell.className.includes("halfcell"),
      );

      // Each row should have exactly 2 halfcells (start and end)
      expect(halfCells).toHaveLength(2);

      // First and last cells should be halfcells
      expect(cells[0]).toHaveClass("halfcell");
      expect(cells[cells.length - 1]).toHaveClass("halfcell");
    });
  });

  it("should render items within grid rows correctly", () => {
    render(<App />);

    // Check that we have items rendered (with background images)
    const cells = screen.getAllByRole("cell");
    const itemCells = cells.filter(
      (cell) =>
        cell.style.backgroundImage?.includes("hookshot") ||
        cell.style.backgroundImage?.includes("hammer") ||
        cell.style.backgroundImage?.includes("boss"),
    );

    expect(itemCells.length).toBeGreaterThan(0);
  });

  it("should maintain grid layout consistency", () => {
    render(<App />);

    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));

    // Each row should be a table with consistent structure
    trackerTables.forEach((table) => {
      expect(table).toHaveClass("tracker");

      const tbody = table.querySelector("tbody");
      expect(tbody).toBeInTheDocument();

      const tr = tbody?.querySelector("tr");
      expect(tr).toBeInTheDocument();

      // Each row should have cells (2 halfcells + up to 7 grid items)
      const cells = tr?.querySelectorAll("td");
      expect(cells).toBeDefined();
      if (cells) {
        expect(cells.length).toBeGreaterThanOrEqual(2);
        expect(cells.length).toBeLessThanOrEqual(9); // 2 halfcells + 7 items max
      }
    });
  });

  it("should preserve app layout structure with grid rows", () => {
    render(<App />);

    // Check main layout structure is preserved
    const layoutDiv = document.getElementById("layoutdiv");
    expect(layoutDiv).toBeInTheDocument();

    const itemDiv = document.getElementById("itemdiv");
    expect(itemDiv).toBeInTheDocument();

    const mapDiv = document.getElementById("mapdiv");
    expect(mapDiv).toBeInTheDocument();

    const captionDiv = document.getElementById("caption");
    expect(captionDiv).toBeInTheDocument();

    // Grid rows should be within itemdiv
    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));

    trackerTables.forEach((table) => {
      expect(itemDiv).toContainElement(table);
    });
  });
});

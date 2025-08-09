import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

/**
 * Integration tests to verify GridItem component integration in App
 */
describe("App - GridItem Integration", () => {
  it("should render both boss and regular items through GridItem component", () => {
    render(<App />);

    // Check that we have regular items (with background images)
    const cells = screen.getAllByRole("cell");
    const regularItemCells = cells.filter(
      (cell) =>
        cell.style.backgroundImage?.includes("hookshot") ||
        cell.style.backgroundImage?.includes("hammer") ||
        cell.style.backgroundImage?.includes("sword"),
    );

    expect(regularItemCells.length).toBeGreaterThan(0);

    // Check that we have boss items (with boss background images)
    const bossItemCells = cells.filter((cell) =>
      cell.style.backgroundImage?.includes("boss"),
    );

    expect(bossItemCells.length).toBeGreaterThan(0);
  });

  it("should render the expected number of grid rows", () => {
    render(<App />);

    // The defaultItemGrid has 6 rows, so we should have 6 tables with class "tracker"
    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));
    expect(trackerTables).toHaveLength(6);
  });

  it("should render 7 items per row (excluding halfcell elements)", () => {
    render(<App />);

    const trackerTables = screen
      .getAllByRole("table")
      .filter((table) => table.className.includes("tracker"));

    // Check first table row
    if (trackerTables.length > 0) {
      const firstTable = trackerTables[0];
      const cells = firstTable.querySelectorAll("td");

      // Should have 9 cells total: 1 halfcell + 7 items + 1 halfcell
      expect(cells).toHaveLength(9);

      // First and last should be halfcells
      expect(cells[0]).toHaveClass("halfcell");
      expect(cells[8]).toHaveClass("halfcell");
    }
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

/**
 * Integration tests to verify GridRow component integration in App
 */
describe("App - GridRow Integration", () => {
  it("should render all grid rows through GridRow component", () => {
    render(<App />);

    // The defaultItemGrid has 7 rows (reorganized layout), so we should have 7 CSS grid rows
    const trackerRows = document.querySelectorAll(".tracker-row");
    expect(trackerRows).toHaveLength(7);
  });

  it("should render tracker grid with correct structure", () => {
    render(<App />);

    // Check for tracker grid container
    const trackerGrid = document.querySelector(".tracker");
    expect(trackerGrid).toBeInTheDocument();

    // Should have tracker rows
    const trackerRows = document.querySelectorAll(".tracker-row");
    expect(trackerRows.length).toBeGreaterThan(0);

    // Should have grid items and halfcells
    const gridItems = document.querySelectorAll("button.griditem");
    const halfcells = document.querySelectorAll(".halfcell");
    expect(gridItems.length).toBeGreaterThan(0);
    expect(halfcells.length).toBeGreaterThanOrEqual(2); // At least 2 halfcells
  });

  it("should maintain halfcell structure in all rows", () => {
    render(<App />);

    const trackerRows = document.querySelectorAll(".tracker-row");

    trackerRows.forEach((row) => {
      const halfCells = row.querySelectorAll(".halfcell");

      // Each row should have exactly 2 halfcells (start and end)
      expect(halfCells).toHaveLength(2);

      // Check that halfcells are positioned correctly within the row
      const children = Array.from(row.children);
      const firstHalfcell = children.find((child) =>
        child.classList.contains("halfcell"),
      );
      const lastHalfcell = children
        .reverse()
        .find((child) => child.classList.contains("halfcell"));

      expect(firstHalfcell).toBeInTheDocument();
      expect(lastHalfcell).toBeInTheDocument();
    });
  });

  it("should render items within grid rows correctly", () => {
    render(<App />);

    // Check that we have items rendered (with background images)
    const buttons = document.querySelectorAll("button.griditem");
    const itemButtons = Array.from(buttons).filter((button) => {
      const style = (button as HTMLElement).style;
      return (
        style.backgroundImage?.includes("hookshot") ||
        style.backgroundImage?.includes("hammer") ||
        style.backgroundImage?.includes("boss")
      );
    });

    expect(itemButtons.length).toBeGreaterThan(0);
  });

  it("should maintain grid layout consistency", () => {
    render(<App />);

    const trackerGrid = document.querySelector(".tracker");
    expect(trackerGrid).toBeInTheDocument();

    // Grid should use CSS Grid layout
    const trackerRows = document.querySelectorAll(".tracker-row");
    expect(trackerRows.length).toBeGreaterThan(0);

    // Each row should contain grid items
    trackerRows.forEach((row) => {
      const gridItems = row.querySelectorAll("button.griditem");
      expect(gridItems.length).toBeGreaterThan(0);
      expect(gridItems.length).toBeLessThanOrEqual(7); // Max 7 items per row

      // Each row should have halfcells for spacing
      const halfcells = row.querySelectorAll(".halfcell");
      expect(halfcells.length).toBe(2); // Left and right halfcells
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
    const trackerGrid = itemDiv?.querySelector(".tracker") as HTMLElement;
    expect(trackerGrid).toBeInTheDocument();
    if (trackerGrid && itemDiv) {
      expect(itemDiv).toContainElement(trackerGrid);
    }

    const trackerRows = itemDiv?.querySelectorAll(".tracker-row");
    expect(trackerRows).toBeDefined();
    if (trackerRows) {
      expect(trackerRows.length).toBeGreaterThan(0);
    }
  });
});

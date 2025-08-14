import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

/**
 * Integration tests to verify GridItem component integration in App
 */
describe("App - GridItem Integration", () => {
  it("should render both boss and regular items through GridItem component", () => {
    render(<App />);

    // Check that we have regular items (with background images)
    const buttons = screen.getAllByRole("button");
    const regularItemButtons = buttons.filter(
      (button) =>
        button.style.backgroundImage?.includes("hookshot") ||
        button.style.backgroundImage?.includes("hammer") ||
        button.style.backgroundImage?.includes("sword"),
    );

    expect(regularItemButtons.length).toBeGreaterThan(0);

    // Check that we have boss items (with boss background images)
    const bossItemButtons = buttons.filter((button) =>
      button.style.backgroundImage?.includes("boss"),
    );

    expect(bossItemButtons.length).toBeGreaterThan(0);
  });

  it("should render the expected number of grid rows", () => {
    render(<App />);

    // The defaultItemGrid has 7 rows (reorganized layout), so we should have 7 CSS grid rows
    const trackerRows = document.querySelectorAll(".tracker-row");
    expect(trackerRows).toHaveLength(7);
  });

  it("should render the correct number of items per row (excluding empty cells)", () => {
    render(<App />);

    // Check first row has 7 grid items (buttons) - all items in first row are now non-empty
    const firstRow = document.querySelector(".tracker-row");
    expect(firstRow).toBeInTheDocument();

    const gridButtons = firstRow?.querySelectorAll("button.griditem");
    expect(gridButtons).toHaveLength(7); // ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"] = 7 items

    // Should have 2 halfcells for grid alignment (one at start, one at end)
    const halfcells = firstRow?.querySelectorAll(".halfcell");
    expect(halfcells).toHaveLength(2);
  });
});

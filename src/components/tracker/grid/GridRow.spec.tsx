import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GridRow } from "@/components/tracker/grid/GridRow";

// Mock the GridItem component
vi.mock("./GridItem", () => ({
  GridItem: ({
    row,
    col,
    item,
  }: {
    row: number;
    col: number;
    item: string;
  }) => (
    <button
      data-col={col}
      data-item={item}
      data-row={row}
      data-testid="grid-item"
      type="button"
    >
      GridItem {item} at ({row},{col})
    </button>
  ),
}));

describe("GridRow", () => {
  describe("Basic rendering", () => {
    it("should render a tracker row with correct structure", () => {
      const testRow = [
        "hookshot",
        "hammer",
        "firerod",
        "icerod",
        "boomerang",
        "",
        "boss0",
      ];

      render(<GridRow row={testRow} rowIndex={0} />);

      const trackerRow = screen.getByTestId("tracker-row-0");
      expect(trackerRow).toBeInTheDocument();
      expect(trackerRow).toHaveClass("tracker-row");

      // Check that we have halfcells
      const halfCells = document.querySelectorAll(".halfcell");
      expect(halfCells).toHaveLength(2);
    });

    it("should render div structure instead of table elements", () => {
      const testRow = ["sword", "shield", "tunic"];

      render(<GridRow row={testRow} rowIndex={1} />);

      const trackerRow = screen.getByTestId("tracker-row-1");
      expect(trackerRow).toBeInTheDocument();
      expect(trackerRow).toHaveClass("tracker-row");
    });

    it("should render halfcell elements at start and end", () => {
      const testRow = ["bow", "lantern"];

      const { container } = render(<GridRow row={testRow} rowIndex={2} />);
      const halfCells = container.querySelectorAll(".halfcell");

      expect(halfCells).toHaveLength(2);
      expect(halfCells[0]).toHaveClass("halfcell");
      expect(halfCells[halfCells.length - 1]).toHaveClass("halfcell");
    });
  });

  describe("GridItem rendering", () => {
    it("should render GridItems for all items in row (up to 7)", () => {
      const testRow = [
        "hookshot",
        "hammer",
        "firerod",
        "icerod",
        "boomerang",
        "bow",
        "boss0",
      ];

      render(<GridRow row={testRow} rowIndex={0} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(7);
    });

    it("should slice row to maximum 7 items", () => {
      const testRow = [
        "item1",
        "item2",
        "item3",
        "item4",
        "item5",
        "item6",
        "item7",
        "item8",
        "item9",
      ];

      render(<GridRow row={testRow} rowIndex={1} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(7);

      // Check that items 8 and 9 are not rendered
      expect(
        screen.queryByText("GridItem item8 at (1,7)"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("GridItem item9 at (1,8)"),
      ).not.toBeInTheDocument();
    });

    it("should handle rows with fewer than 7 items", () => {
      const testRow = ["sword", "shield"];

      render(<GridRow row={testRow} rowIndex={2} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(2);
    });

    it("should handle empty items in row", () => {
      const testRow = ["", "hammer", "", "firerod", ""];

      render(<GridRow row={testRow} rowIndex={3} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(5);

      // Check that empty items are still rendered
      const emptyItems = gridItems.filter(
        (item) => item.getAttribute("data-item") === "",
      );
      expect(emptyItems).toHaveLength(3);
    });
  });

  describe("Props passing", () => {
    it("should pass correct rowIndex to all GridItems", () => {
      const testRow = ["hookshot", "hammer", "firerod"];

      render(<GridRow row={testRow} rowIndex={5} />);

      const gridItems = screen.getAllByTestId("grid-item");
      gridItems.forEach((item) => {
        expect(item).toHaveAttribute("data-row", "5");
      });
    });

    it("should pass correct column indices to GridItems", () => {
      const testRow = ["hookshot", "hammer", "firerod"];

      render(<GridRow row={testRow} rowIndex={1} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems[0]).toHaveAttribute("data-col", "0");
      expect(gridItems[1]).toHaveAttribute("data-col", "1");
      expect(gridItems[2]).toHaveAttribute("data-col", "2");
    });

    it("should pass correct item values to GridItems", () => {
      const testRow = ["hookshot", "hammer", "boss0"];

      render(<GridRow row={testRow} rowIndex={0} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems[0]).toHaveAttribute("data-item", "hookshot");
      expect(gridItems[1]).toHaveAttribute("data-item", "hammer");
      expect(gridItems[2]).toHaveAttribute("data-item", "boss0");
    });

    it("should generate correct keys for GridItems", () => {
      const testRow = ["hookshot", "hammer"];

      render(<GridRow row={testRow} rowIndex={2} />);

      // Keys are internal to React, but we can verify the content is rendered correctly
      expect(
        screen.getByText("GridItem hookshot at (2,0)"),
      ).toBeInTheDocument();
      expect(screen.getByText("GridItem hammer at (2,1)")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should return null for null row", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with null
      const { container } = render(<GridRow row={null as any} rowIndex={0} />);
      expect(container.firstChild).toBeNull();
    });

    it("should return null for undefined row", () => {
      const { container } = render(
        // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with undefined
        <GridRow row={undefined as any} rowIndex={0} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("should handle empty row array", () => {
      const { container } = render(<GridRow row={[]} rowIndex={1} />);

      const trackerRow = screen.getByTestId("tracker-row-1");
      expect(trackerRow).toBeInTheDocument();

      // Should still have halfcells but no GridItems
      // Use direct DOM query since halfcells are aria-hidden
      const halfCells = container.querySelectorAll(".halfcell");
      const gridItems = screen.queryAllByTestId("grid-item");

      expect(halfCells).toHaveLength(2); // Only halfcells (aria-hidden)
      expect(gridItems).toHaveLength(0);
    });

    it("should handle row with all empty strings", () => {
      const testRow = ["", "", "", "", "", "", ""];

      render(<GridRow row={testRow} rowIndex={4} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(7);

      gridItems.forEach((item) => {
        expect(item).toHaveAttribute("data-item", "");
      });
    });

    it("should handle very long row gracefully", () => {
      const testRow = Array(100)
        .fill(0)
        .map((_, i) => `item${i}`);

      render(<GridRow row={testRow} rowIndex={0} />);

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(7); // Should be capped at 7

      // Verify first 7 items are rendered
      for (let i = 0; i < 7; i++) {
        expect(gridItems[i]).toHaveAttribute("data-item", `item${i}`);
      }
    });
  });

  describe("CSS Grid structure", () => {
    it("should have correct total number of elements", () => {
      const testRow = ["hookshot", "hammer", "firerod"];

      const { container } = render(<GridRow row={testRow} rowIndex={0} />);

      // Use direct DOM query to include aria-hidden cells
      const halfCells = container.querySelectorAll(".halfcell");
      // Only accessible GridItem buttons should be found via role
      const accessibleButtons = screen.getAllByRole("button");

      expect(halfCells).toHaveLength(2); // 2 halfcells
      expect(accessibleButtons).toHaveLength(3); // 3 GridItems
    });

    it("should maintain CSS Grid structure with maximum items", () => {
      const testRow = [
        "item1",
        "item2",
        "item3",
        "item4",
        "item5",
        "item6",
        "item7",
      ];

      const { container } = render(<GridRow row={testRow} rowIndex={1} />);

      // Use direct DOM query to include aria-hidden cells
      const halfCells = container.querySelectorAll(".halfcell");
      // Only accessible GridItem buttons should be found via role
      const accessibleButtons = screen.getAllByRole("button");

      expect(halfCells).toHaveLength(2); // 2 halfcells
      expect(accessibleButtons).toHaveLength(7); // 7 GridItems

      const gridItems = screen.getAllByTestId("grid-item");
      expect(gridItems).toHaveLength(7);
    });
  });
});

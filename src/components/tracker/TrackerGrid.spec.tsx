import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";

// Mock the GridRow component
vi.mock("./grid/GridRow", () => ({
  GridRow: ({ rowIndex, row }: { rowIndex: number; row: string[] }) => (
    <div
      data-row-index={rowIndex}
      data-row-length={row.length}
      data-testid="grid-row"
    >
      GridRow {rowIndex}: {row.join(",")}
    </div>
  ),
}));

describe("TrackerGrid", () => {
  describe("Basic rendering", () => {
    it("should render itemdiv container with correct classes and id", () => {
      const testLayout = [
        ["item1", "item2"],
        ["item3", "item4"],
      ];

      render(<TrackerGrid itemLayout={testLayout} />);

      const container = document.getElementById("itemdiv");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("itemdiv");
    });

    it("should render correct number of GridRow components", () => {
      const testLayout = [
        ["hookshot", "hammer"],
        ["sword", "shield"],
        ["bow", "boomerang"],
      ];

      render(<TrackerGrid itemLayout={testLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(3);
    });

    it("should pass correct props to each GridRow", () => {
      const testLayout = [
        ["hookshot", "hammer", "firerod"],
        ["sword", "shield"],
      ];

      render(<TrackerGrid itemLayout={testLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");

      expect(gridRows[0]).toHaveAttribute("data-row-index", "0");
      expect(gridRows[0]).toHaveAttribute("data-row-length", "3");
      expect(gridRows[0]).toHaveTextContent(
        "GridRow 0: hookshot,hammer,firerod",
      );

      expect(gridRows[1]).toHaveAttribute("data-row-index", "1");
      expect(gridRows[1]).toHaveAttribute("data-row-length", "2");
      expect(gridRows[1]).toHaveTextContent("GridRow 1: sword,shield");
    });
  });

  describe("Grid layout handling", () => {
    it("should handle empty grid layout", () => {
      render(<TrackerGrid itemLayout={[]} />);

      const container = document.getElementById("itemdiv");
      expect(container).toBeInTheDocument();

      // Container should only have the screen reader heading
      const heading = screen.getByText("Item Tracker");
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass("sr-only");

      const gridRows = screen.queryAllByTestId("grid-row");
      expect(gridRows).toHaveLength(0);
    });

    it("should handle rows with empty items", () => {
      const testLayout = [
        ["", "hammer", ""],
        ["sword", "", "shield"],
      ];

      render(<TrackerGrid itemLayout={testLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(2);

      expect(gridRows[0]).toHaveTextContent("GridRow 0: ,hammer,");
      expect(gridRows[1]).toHaveTextContent("GridRow 1: sword,,shield");
    });

    it("should handle single row", () => {
      const testLayout = [["hookshot", "hammer", "firerod", "icerod"]];

      render(<TrackerGrid itemLayout={testLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(1);
      expect(gridRows[0]).toHaveAttribute("data-row-index", "0");
      expect(gridRows[0]).toHaveAttribute("data-row-length", "4");
    });

    it("should handle large grid layout", () => {
      const testLayout = Array(10)
        .fill(0)
        .map((_, i) =>
          Array(7)
            .fill(0)
            .map((_, j) => `item${i}-${j}`),
        );

      render(<TrackerGrid itemLayout={testLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(10);

      // Check first and last rows
      expect(gridRows[0]).toHaveAttribute("data-row-index", "0");
      expect(gridRows[9]).toHaveAttribute("data-row-index", "9");
    });
  });

  describe("Key generation", () => {
    it("should generate unique keys for each row", () => {
      const testLayout = [
        ["hookshot", "hammer"],
        ["sword", "shield"],
        ["bow", "boomerang"],
      ];

      render(<TrackerGrid itemLayout={testLayout} />);

      // Keys are internal to React, but we can verify all rows render correctly
      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(3);

      gridRows.forEach((row, index) => {
        expect(row).toHaveAttribute("data-row-index", index.toString());
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle typical LttP tracker layout structure", () => {
      const lttpLayout = [
        ["", "hookshot", "hammer", "firerod", "icerod", "boomerang", ""],
        ["bow", "lantern", "flute", "sword", "tunic", "shield", "boss0"],
        ["flute", "book", "mirror", "bombos", "ether", "quake", "boss1"],
        ["shovel", "glove", "bottle", "somaria", "byrna", "boots", "boss2"],
        [
          "powder",
          "mushroom",
          "cape",
          "mirror",
          "moonpearl",
          "flippers",
          "agahnim",
        ],
        ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
      ];

      render(<TrackerGrid itemLayout={lttpLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(6);

      // Check that boss items are in the right places
      expect(gridRows[1]).toHaveTextContent("boss0");
      expect(gridRows[2]).toHaveTextContent("boss1");
      expect(gridRows[5]).toHaveTextContent(
        "boss3,boss4,boss5,boss6,boss7,boss8,boss9",
      );
    });

    it("should handle boss-heavy row correctly", () => {
      const bossRow = [
        ["boss0", "boss1", "boss2", "boss3", "boss4", "boss5", "boss6"],
      ];

      render(<TrackerGrid itemLayout={bossRow} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(1);
      expect(gridRows[0]).toHaveTextContent(
        "boss0,boss1,boss2,boss3,boss4,boss5,boss6",
      );
    });

    it("should handle mixed item types in rows", () => {
      const mixedLayout = [
        ["hookshot", "", "boss0", "sword", "", "shield", "boss1"],
        ["", "", "", "", "", "", ""],
        ["item1", "item2", "item3", "item4", "item5", "item6", "item7"],
      ];

      render(<TrackerGrid itemLayout={mixedLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(3);

      expect(gridRows[0]).toHaveTextContent(
        "hookshot,,boss0,sword,,shield,boss1",
      );
      expect(gridRows[1]).toHaveTextContent(",,,,,,");
      expect(gridRows[2]).toHaveTextContent(
        "item1,item2,item3,item4,item5,item6,item7",
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle rows with different lengths", () => {
      const unevenLayout = [
        ["item1"],
        ["item2", "item3", "item4"],
        ["item5", "item6"],
      ];

      render(<TrackerGrid itemLayout={unevenLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(3);

      expect(gridRows[0]).toHaveAttribute("data-row-length", "1");
      expect(gridRows[1]).toHaveAttribute("data-row-length", "3");
      expect(gridRows[2]).toHaveAttribute("data-row-length", "2");
    });

    it("should handle very long item names", () => {
      const longItemLayout = [
        [
          "very-long-item-name-that-exceeds-normal-length",
          "another-extremely-long-item-identifier",
        ],
      ];

      render(<TrackerGrid itemLayout={longItemLayout} />);

      const gridRows = screen.getAllByTestId("grid-row");
      expect(gridRows).toHaveLength(1);
      expect(gridRows[0]).toHaveTextContent(
        "very-long-item-name-that-exceeds-normal-length,another-extremely-long-item-identifier",
      );
    });
  });
});

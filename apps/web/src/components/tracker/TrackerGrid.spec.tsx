import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";

/** Query the grid cell rendered at a given layout position. */
const cellAt = (row: number, col: number) =>
  document.querySelector(`[data-grid-row="${row}"][data-grid-col="${col}"]`);

describe("TrackerGrid", () => {
  it("renders the labelled grid container", () => {
    render(<TrackerGrid itemLayout={[["hookshot", "hammer"]]} />);

    const container = document.getElementById("itemdiv");
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass("itemdiv");
    expect(container).toHaveAttribute("aria-label", "Item tracker grid");
  });

  it("renders one row per layout row, tagged with its index and length", () => {
    render(
      <TrackerGrid
        itemLayout={[
          ["hookshot", "hammer", "firerod"],
          ["sword", "shield"],
        ]}
      />,
    );

    const rows = screen.getAllByTestId("grid-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-row-index", "0");
    expect(rows[0]).toHaveAttribute("data-row-length", "3");
    expect(rows[1]).toHaveAttribute("data-row-index", "1");
    expect(rows[1]).toHaveAttribute("data-row-length", "2");
  });

  it("renders an interactive button per item, addressable by grid position", () => {
    render(
      <TrackerGrid
        itemLayout={[
          ["hookshot", "hammer"],
          ["sword", "boss0"],
        ]}
      />,
    );

    expect(cellAt(0, 0)).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Hookshot"),
    );
    expect(cellAt(1, 0)).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Sword"),
    );
    expect(cellAt(1, 1)).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Armos Knights"),
    );
  });

  it("renders a hidden spacer instead of a button for empty cells", () => {
    render(<TrackerGrid itemLayout={[["", "hammer"]]} />);

    // The empty cell produces no addressable button...
    expect(cellAt(0, 0)).toBeNull();
    expect(cellAt(0, 1)).toBeInTheDocument();

    // ...but still occupies a grid slot so columns stay aligned.
    const spacer = document.querySelector(".grid-spacer");
    expect(spacer).toBeInTheDocument();
    expect(spacer).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps each row flanked by half-cell spacers", () => {
    render(<TrackerGrid itemLayout={[["hookshot"]]} />);

    const row = screen.getByTestId("grid-row");
    expect(row.querySelectorAll(".halfcell")).toHaveLength(2);
  });

  it("caps a row at seven columns", () => {
    const tenItems = Array.from({ length: 10 }, (_, i) => `item${i}`);

    render(<TrackerGrid itemLayout={[tenItems]} />);

    expect(cellAt(0, 6)).toBeInTheDocument();
    expect(cellAt(0, 7)).toBeNull();
  });

  it("renders an empty layout without crashing", () => {
    render(<TrackerGrid itemLayout={[]} />);

    expect(document.getElementById("itemdiv")).toBeInTheDocument();
    expect(screen.queryAllByTestId("grid-row")).toHaveLength(0);
    expect(screen.getByText("Item Tracker")).toHaveClass("sr-only");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CornerTable } from "./CornerTable";

describe("CornerTable", () => {
  it("renders without crashing", () => {
    render(<CornerTable />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("has the correct CSS class", () => {
    render(<CornerTable />);
    const table = screen.getByRole("table");
    expect(table).toHaveClass("lonk");
  });

  it("renders the correct table structure", () => {
    render(<CornerTable />);

    // Check for table body
    const tbody = screen.getByRole("rowgroup");
    expect(tbody).toBeInTheDocument();

    // Check for 4 corner cells (2 rows x 2 columns)
    const cornerCells = screen.getAllByRole("columnheader");
    expect(cornerCells).toHaveLength(4);

    // Each cell should have the corner class
    cornerCells.forEach((cell) => {
      expect(cell).toHaveClass("corner");
    });
  });

  it("renders exactly 2 rows", () => {
    render(<CornerTable />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
  });

  it("each row has exactly 2 cells", () => {
    render(<CornerTable />);

    const rows = screen.getAllByRole("row");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("th");
      expect(cells).toHaveLength(2);
    });
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CornerTable } from "@/components/CornerTable";

describe("CornerTable", () => {
  it("renders without crashing", () => {
    const { container } = render(<CornerTable />);
    const cornerGrid = container.querySelector(".lonk");
    expect(cornerGrid).toBeInTheDocument();
  });

  it("has the correct CSS class", () => {
    const { container } = render(<CornerTable />);
    const cornerGrid = container.querySelector(".lonk");
    expect(cornerGrid).toHaveClass("lonk");
  });

  it("renders the correct grid structure", () => {
    const { container } = render(<CornerTable />);

    // Check for main grid container
    const cornerGrid = container.querySelector(".lonk");
    expect(cornerGrid).toBeInTheDocument();

    // Check for 4 corner divs (2x2 CSS Grid)
    const cornerCells = container.querySelectorAll(".corner");
    expect(cornerCells).toHaveLength(4);

    // Each cell should have the corner class
    cornerCells.forEach((cell) => {
      expect(cell).toHaveClass("corner");
    });
  });

  it("renders exactly 4 corner cells", () => {
    const { container } = render(<CornerTable />);

    const corners = container.querySelectorAll(".corner");
    expect(corners).toHaveLength(4);
  });

  it("has proper CSS Grid structure", () => {
    const { container } = render(<CornerTable />);

    const cornerGrid = container.querySelector(".lonk");
    expect(cornerGrid).toBeInTheDocument();

    // Verify all 4 corners are direct children
    const directChildren = cornerGrid?.children;
    expect(directChildren).toHaveLength(4);

    // All children should be corner elements
    Array.from(directChildren || []).forEach((child) => {
      expect(child).toHaveClass("corner");
    });
  });
});

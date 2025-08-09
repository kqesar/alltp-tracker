import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import { RegularItem } from "./RegularItem";

// Mock the game store
vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

// Mock the data/items
vi.mock("../data/items", () => ({
  itemsMin: {
    boomerang: 0,
    boots: 0,
    bow: 0,
    hookshot: 0,
  },
}));

// Mock the CornerTable component
vi.mock("./CornerTable", () => ({
  CornerTable: () => <div data-testid="corner-table">CornerTable</div>,
}));

describe("RegularItem", () => {
  const mockHandleItemClick = vi.fn();
  const mockItems = {
    blank: "", // blank item
    boomerang: 0, // number item at minimum
    boots: false, // boolean item (not acquired)
    bow: 1, // number item with minimum
    hookshot: true, // boolean item
    sword: 2, // number item
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleItemClick: mockHandleItemClick,
      items: mockItems,
    });
  });

  it("renders regular item with correct classes", () => {
    const { container } = render(<RegularItem col={0} item="sword" row={0} />);

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();
    expect(td).toHaveClass("griditem", "grid-item-base");
    expect(td).not.toHaveClass("grid-item-relative");
  });

  it("renders CornerTable component", () => {
    const { getByTestId } = render(
      <RegularItem col={0} item="sword" row={0} />,
    );

    expect(getByTestId("corner-table")).toBeInTheDocument();
  });

  it("calls handleItemClick when clicked", () => {
    const { container } = render(
      <RegularItem col={2} item="hookshot" row={1} />,
    );

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();

    if (td) {
      fireEvent.click(td);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("hookshot");
  });

  it("renders with correct structure", () => {
    const { container } = render(<RegularItem col={4} item="boots" row={3} />);

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();
    expect(td).toHaveClass("griditem", "grid-item-base");
  });

  describe("background image handling", () => {
    it("renders correct background image for boolean items (acquired)", () => {
      const { container } = render(
        <RegularItem col={0} item="hookshot" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        backgroundImage: "url(/assets/hookshot.png)",
      });
    });

    it("renders correct background image for number items", () => {
      const { container } = render(
        <RegularItem col={0} item="sword" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        backgroundImage: "url(/assets/sword2.png)",
      });
    });

    it("renders empty background for blank items", () => {
      const { container } = render(
        <RegularItem col={0} item="blank" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        backgroundImage: "",
      });
    });

    it("renders empty background for empty item string", () => {
      const { container } = render(<RegularItem col={0} item="" row={0} />);

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        backgroundImage: "",
      });
    });
  });

  describe("opacity handling", () => {
    it("renders full opacity for acquired boolean items", () => {
      const { container } = render(
        <RegularItem col={0} item="hookshot" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        opacity: "1",
      });
    });

    it("renders low opacity for unacquired boolean items", () => {
      const { container } = render(
        <RegularItem col={0} item="boots" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        opacity: "0.25",
      });
    });

    it("renders full opacity for number items above minimum", () => {
      const { container } = render(<RegularItem col={0} item="bow" row={0} />);

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        opacity: "1",
      });
    });

    it("renders low opacity for number items at minimum", () => {
      const { container } = render(
        <RegularItem col={0} item="boomerang" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        opacity: "0.25",
      });
    });

    it("renders low opacity for blank items", () => {
      const { container } = render(
        <RegularItem col={0} item="blank" row={0} />,
      );

      const td = container.querySelector("td");
      expect(td).toHaveStyle({
        opacity: "0.25",
      });
    });
  });

  it("handles different row and column values correctly", () => {
    const { container: container1 } = render(
      <RegularItem col={6} item="sword" row={5} />,
    );
    const { container: container2 } = render(
      <RegularItem col={2} item="hookshot" row={1} />,
    );

    const td1 = container1.querySelector("td");
    const td2 = container2.querySelector("td");

    expect(td1).toBeInTheDocument();
    expect(td2).toBeInTheDocument();

    // Both should have the same classes but render different items
    expect(td1).toHaveClass("griditem", "grid-item-base");
    expect(td2).toHaveClass("griditem", "grid-item-base");
  });
});

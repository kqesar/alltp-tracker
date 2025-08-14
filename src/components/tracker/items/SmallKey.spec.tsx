import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmallKey } from "@/components/tracker/items/SmallKey";
import { useGameStore } from "@/stores/gameStore";

// Mock getAssetPath
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
}));

// Mock useGameStore
const mockHandleSmallKeyClick = vi.fn();

vi.mock("@/stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    handleSmallKeyClick: mockHandleSmallKeyClick,
    smallKeys: [0, 1, 2, 3, 0, 3, 1, 2, 3, 4], // Test values for each dungeon (dungeon 3 max is 3)
  })),
}));

const mockUseGameStore = vi.mocked(useGameStore);

describe("SmallKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct count and maximum for Eastern Palace (dungeon 0)", () => {
    render(<SmallKey col={5} dungeonIndex={0} row={2} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 0: 0/1",
    );
    expect(button).toHaveAttribute("title", "Small keys: 0/1");

    // Small key overlay should be present without maxed state
    expect(button).not.toHaveClass("small-key-overlay--maxed");
  });

  it("renders with correct count for Desert Palace (dungeon 1)", () => {
    render(<SmallKey col={5} dungeonIndex={1} row={2} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 1: 1/1",
    );
    expect(button).toHaveAttribute("title", "Small keys: 1/1");

    // Small key overlay should have maxed state
    expect(button).toHaveClass("small-key-overlay--maxed");
  });

  it("renders with correct count for Palace of Darkness (dungeon 3) - max 6", () => {
    render(<SmallKey col={5} dungeonIndex={3} row={4} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 3: 3/6",
    );
    expect(button).toHaveAttribute("title", "Small keys: 3/6");

    // 3 < 6, so not maxed
    expect(button).not.toHaveClass("small-key-overlay--maxed");
  });

  it("applies maxed styles when count equals maximum", () => {
    render(<SmallKey col={5} dungeonIndex={1} row={2} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("small-key-overlay--maxed");
  });

  it("does not apply maxed styles when count is below maximum", () => {
    render(<SmallKey col={5} dungeonIndex={0} row={2} />);

    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("small-key-overlay--maxed");
  });

  it("calls handleSmallKeyClick when clicked", () => {
    render(<SmallKey col={5} dungeonIndex={2} row={2} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockHandleSmallKeyClick).toHaveBeenCalledWith(2);
  });

  it("stops propagation and prevents default on click", () => {
    render(<SmallKey col={5} dungeonIndex={2} row={2} />);

    const button = screen.getByRole("button");
    const clickEvent = new MouseEvent("click", { bubbles: true });
    const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
    const stopPropagationSpy = vi.spyOn(clickEvent, "stopPropagation");

    fireEvent(button, clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("renders with correct background image for small key icon", () => {
    render(<SmallKey col={5} dungeonIndex={0} row={2} />);

    const icon = document.querySelector(".small-key-icon");
    expect(icon).toHaveStyle({
      backgroundImage: "url(/mocked/path/smallkey.png)",
    });
  });

  it("has correct data attributes for positioning", () => {
    render(<SmallKey col={5} dungeonIndex={3} row={2} />);

    const overlay = document.querySelector(".small-key-overlay");
    expect(overlay).toHaveAttribute("data-dungeon", "3");
    expect(overlay).toHaveAttribute("data-grid-col", "5");
    expect(overlay).toHaveAttribute("data-grid-row", "2");
  });

  it("handles missing smallKeys gracefully", () => {
    mockUseGameStore.mockReturnValue({
      handleSmallKeyClick: mockHandleSmallKeyClick,
      smallKeys: [], // Empty array
    });

    render(<SmallKey col={5} dungeonIndex={0} row={2} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 0: 0/1",
    );
  });

  it("handles Skull Woods (dungeon 5) with max 3 keys", () => {
    // Ensure the mock returns the correct smallKeys array
    mockUseGameStore.mockReturnValue({
      handleSmallKeyClick: mockHandleSmallKeyClick,
      smallKeys: [0, 1, 2, 3, 0, 3, 1, 2, 3, 4], // Test values for each dungeon (dungeon 3 max is 3)
    });

    render(<SmallKey col={5} dungeonIndex={5} row={6} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 5: 3/3",
    );

    // Check overlay is displayed correctly
    const overlay = screen.getByRole("button");
    expect(overlay).toHaveClass("small-key-overlay");
  });

  it("handles Turtle Rock (dungeon 9) with max 4 keys", () => {
    // Ensure the mock returns the correct smallKeys array
    mockUseGameStore.mockReturnValue({
      handleSmallKeyClick: mockHandleSmallKeyClick,
      smallKeys: [0, 1, 2, 3, 0, 3, 1, 2, 3, 4], // Test values for each dungeon (dungeon 3 max is 3)
    });

    render(<SmallKey col={6} dungeonIndex={9} row={5} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Small keys for dungeon 9: 4/4",
    );

    // Check overlay is displayed correctly
    const overlay = screen.getByRole("button");
    expect(overlay).toHaveClass("small-key-overlay");
  });
});

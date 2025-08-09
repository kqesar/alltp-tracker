import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../stores/gameStore";
import { ChestOverlay } from "./ChestOverlay";

// Mock the game store
vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("ChestOverlay", () => {
  const mockHandleItemClick = vi.fn();
  const mockItems = {
    chest0: 3,
    chest1: 1,
    chest2: 0,
    chest3: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleItemClick: mockHandleItemClick,
      items: mockItems,
    });
  });

  it("renders chest overlay with correct background image", () => {
    const { container } = render(<ChestOverlay bossNumber={0} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-left",
    );
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/chest3.png)",
    });
  });

  it("calls handleItemClick with correct chest key when clicked", () => {
    const { container } = render(<ChestOverlay bossNumber={1} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-left",
    );
    expect(overlay).toBeInTheDocument();
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("chest1");
  });

  it("handles click events correctly", () => {
    const { container } = render(<ChestOverlay bossNumber={2} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-left",
    );
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("chest2");
  });

  it("renders with different boss numbers correctly", () => {
    const { container, rerender } = render(<ChestOverlay bossNumber={2} />);

    let overlay = container.querySelector(".overlay-base.overlay--bottom-left");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/chest0.png)",
    });

    rerender(<ChestOverlay bossNumber={3} />);
    overlay = container.querySelector(".overlay-base.overlay--bottom-left");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/chest5.png)",
    });
  });

  it("has correct CSS classes", () => {
    const { container } = render(<ChestOverlay bossNumber={0} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-left",
    );
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("overlay-base", "overlay--bottom-left");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../../../stores/gameStore";
import { ChestOverlay } from "./ChestOverlay";

// Mock the game store
vi.mock("../../../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../../../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("ChestOverlay", () => {
  const mockHandleChestClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: Mocking test function
    (useGameStore as any).mockReturnValue({
      chests: [0, 1, 2, 3, 4, 5],
      handleChestClick: mockHandleChestClick,
    });
  });

  it("should render chest overlay with correct boss number", () => {
    render(<ChestOverlay bossNumber={0} />);

    const overlay = screen.getByTestId("chest-overlay-0");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("overlay-base", "overlay--bottom-left");
  });

  it("should display correct chest count background image", () => {
    render(<ChestOverlay bossNumber={2} />);

    const overlay = screen.getByTestId("chest-overlay-2");
    expect(overlay).toHaveStyle("background-image: url(/assets/chest2.png)");
  });

  it("should handle chest click correctly", () => {
    render(<ChestOverlay bossNumber={1} />);

    const overlay = screen.getByTestId("chest-overlay-1");
    fireEvent.click(overlay);

    expect(mockHandleChestClick).toHaveBeenCalledWith(1);
  });

  it("should stop event propagation on click", () => {
    const parentClickHandler = vi.fn();

    render(
      <div onClick={parentClickHandler}>
        <ChestOverlay bossNumber={0} />
      </div>,
    );

    const overlay = screen.getByTestId("chest-overlay-0");
    fireEvent.click(overlay);

    expect(mockHandleChestClick).toHaveBeenCalledWith(0);
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it("should render for all boss numbers", () => {
    for (let bossNumber = 0; bossNumber < 10; bossNumber++) {
      const { rerender } = render(<ChestOverlay bossNumber={bossNumber} />);

      const overlay = screen.getByTestId(`chest-overlay-${bossNumber}`);
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveStyle(
        `background-image: url(/assets/chest${bossNumber}.png)`,
      );

      rerender(<></>);
    }
  });
});

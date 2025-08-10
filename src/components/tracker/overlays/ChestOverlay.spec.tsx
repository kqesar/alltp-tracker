import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChestOverlay } from "@/components/tracker/overlays/ChestOverlay";
import { useGameStore } from "@/stores/gameStore";

// Mock the game store
vi.mock("@/stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("ChestOverlay", () => {
  const mockHandleItemClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: Mocking test function
    (useGameStore as any).mockReturnValue({
      handleItemClick: mockHandleItemClick,
      items: {
        chest0: 0,
        chest1: 1,
        chest2: 2,
        chest3: 3,
        chest4: 4,
        chest5: 5,
        chest6: 6,
        chest7: 7,
        chest8: 8,
        chest9: 9,
      },
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

    expect(mockHandleItemClick).toHaveBeenCalledWith("chest1");
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

    expect(mockHandleItemClick).toHaveBeenCalledWith("chest0");
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

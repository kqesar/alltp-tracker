import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../../../stores/gameStore";
import { RewardOverlay } from "./RewardOverlay";

// Mock the game store
vi.mock("../../../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../../../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("RewardOverlay", () => {
  const mockHandleRewardClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: Mocking test function
    (useGameStore as any).mockReturnValue({
      handleRewardClick: mockHandleRewardClick,
      rewards: [0, 1, 2, 3, 4, 5],
    });
  });

  it("should render reward overlay with correct boss number", () => {
    render(<RewardOverlay bossNumber={0} />);

    const overlay = screen.getByTestId("reward-overlay-0");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("overlay-base", "overlay--bottom-right");
  });

  it("should display correct reward background image", () => {
    render(<RewardOverlay bossNumber={2} />);

    const overlay = screen.getByTestId("reward-overlay-2");
    expect(overlay).toHaveStyle("background-image: url(/assets/crystal0.png)");
  });

  it("should handle reward click correctly", () => {
    render(<RewardOverlay bossNumber={1} />);

    const overlay = screen.getByTestId("reward-overlay-1");
    fireEvent.click(overlay);

    expect(mockHandleRewardClick).toHaveBeenCalledWith(1);
  });

  it("should stop event propagation on click", () => {
    const parentClickHandler = vi.fn();

    render(
      <div onClick={parentClickHandler}>
        <RewardOverlay bossNumber={0} />
      </div>,
    );

    const overlay = screen.getByTestId("reward-overlay-0");
    fireEvent.click(overlay);

    expect(mockHandleRewardClick).toHaveBeenCalledWith(0);
    expect(parentClickHandler).not.toHaveBeenCalled();
  });
});

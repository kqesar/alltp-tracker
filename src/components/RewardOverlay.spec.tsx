import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import { RewardOverlay } from "./RewardOverlay";

// Mock the game store
vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("RewardOverlay", () => {
  const mockHandleItemClick = vi.fn();
  const mockItems = {
    reward0: 1,
    reward1: 2,
    reward2: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleItemClick: mockHandleItemClick,
      items: mockItems,
    });
  });

  it("renders reward overlay with correct background image", () => {
    const { container } = render(<RewardOverlay bossNumber={0} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-right",
    );
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/dungeon1.png)",
    });
  });

  it("calls handleItemClick with correct reward key when clicked", () => {
    const { container } = render(<RewardOverlay bossNumber={1} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-right",
    );
    expect(overlay).toBeInTheDocument();
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("reward1");
  });

  it("handles click events correctly", () => {
    const { container } = render(<RewardOverlay bossNumber={0} />);

    const overlay = container.querySelector(
      ".overlay-base.overlay--bottom-right",
    );
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("reward0");
  });

  it("renders with different boss numbers correctly", () => {
    const { container, rerender } = render(<RewardOverlay bossNumber={2} />);

    let overlay = container.querySelector(
      ".overlay-base.overlay--bottom-right",
    );
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/dungeon0.png)",
    });

    rerender(<RewardOverlay bossNumber={1} />);
    overlay = container.querySelector(".overlay-base.overlay--bottom-right");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/dungeon2.png)",
    });
  });
});

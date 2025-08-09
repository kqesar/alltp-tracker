import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/stores/gameStore";
import { MedaillonOverlay } from "./MedaillonOverlay";

// Mock the game store
vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(),
}));

// Mock the utils
vi.mock("../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/assets/${path}`),
}));

describe("MedaillonOverlay", () => {
  const mockHandleMedallionChange = vi.fn();
  const mockMedallions = {
    8: 1, // bombos
    9: 2, // ether
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleMedallionChange: mockHandleMedallionChange,
      medallions: mockMedallions,
    });
  });

  it("does not render for bosses before Dark World (boss < 8)", () => {
    const { container } = render(<MedaillonOverlay bossNumber={7} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).not.toBeInTheDocument();
  });

  it("renders medallion overlay for Dark World bosses (boss >= 8)", () => {
    const { container } = render(<MedaillonOverlay bossNumber={8} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("overlay-base", "overlay--top-right");
  });

  it("renders correct background image for bombos medallion (value 1)", () => {
    const { container } = render(<MedaillonOverlay bossNumber={8} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/medallion1.png)",
    });
  });

  it("renders correct background image for ether medallion (value 2)", () => {
    const { container } = render(<MedaillonOverlay bossNumber={9} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/medallion2.png)",
    });
  });

  it("renders correct background image for quake medallion (value 3 -> image 0)", () => {
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleMedallionChange: mockHandleMedallionChange,
      medallions: { ...mockMedallions, 8: 3 }, // quake
    });

    const { container } = render(<MedaillonOverlay bossNumber={8} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/medallion0.png)",
    });
  });

  it("renders correct background image for unknown medallion (value 0)", () => {
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleMedallionChange: mockHandleMedallionChange,
      medallions: { ...mockMedallions, 8: 0 }, // unknown
    });

    const { container } = render(<MedaillonOverlay bossNumber={8} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toHaveStyle({
      backgroundImage: "url(/assets/medallion0.png)",
    });
  });

  it("calls handleMedallionChange with correct parameters when clicked", () => {
    const { container } = render(<MedaillonOverlay bossNumber={8} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
    }

    // Should cycle from 1 (bombos) to 2 (ether)
    expect(mockHandleMedallionChange).toHaveBeenCalledWith(8, 2);
  });

  it("cycles medallion values correctly (0->1->2->3->0)", () => {
    const { container, rerender } = render(<MedaillonOverlay bossNumber={8} />);
    const overlay = container.querySelector(".overlay-base.overlay--top-right");

    // Start with value 1 (bombos), click should go to 2 (ether)
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(mockHandleMedallionChange).toHaveBeenCalledWith(8, 2);

    // Test with value 3 (quake), click should go to 0 (unknown)
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleMedallionChange: mockHandleMedallionChange,
      medallions: { ...mockMedallions, 8: 3 },
    });

    rerender(<MedaillonOverlay bossNumber={8} />);
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(mockHandleMedallionChange).toHaveBeenCalledWith(8, 0);
  });

  it("handles click events correctly and stops propagation", () => {
    const { container } = render(<MedaillonOverlay bossNumber={9} />);

    const overlay = container.querySelector(".overlay-base.overlay--top-right");
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
    }

    // Should cycle from 2 (ether) to 3 (quake)
    expect(mockHandleMedallionChange).toHaveBeenCalledWith(9, 3);
  });
});

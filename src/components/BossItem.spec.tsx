import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../stores/gameStore";
import { BossItem } from "./BossItem";

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
    boss0: 0,
    boss1: 0,
  },
}));

// Mock the overlay components
vi.mock("./MedaillonOverlay", () => ({
  MedaillonOverlay: ({ bossNumber }: { bossNumber: number }) => (
    <div data-testid={`medallion-overlay-${bossNumber}`}>MedaillonOverlay</div>
  ),
}));

vi.mock("./ChestOverlay", () => ({
  ChestOverlay: ({ bossNumber }: { bossNumber: number }) => (
    <div data-testid={`chest-overlay-${bossNumber}`}>ChestOverlay</div>
  ),
}));

vi.mock("./RewardOverlay", () => ({
  RewardOverlay: ({ bossNumber }: { bossNumber: number }) => (
    <div data-testid={`reward-overlay-${bossNumber}`}>RewardOverlay</div>
  ),
}));

vi.mock("./CornerTable", () => ({
  CornerTable: () => <div data-testid="corner-table">CornerTable</div>,
}));

describe("BossItem", () => {
  const mockHandleItemClick = vi.fn();
  const mockItems = {
    boss0: 1, // boss item
    boss1: 2, // boss item
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      handleItemClick: mockHandleItemClick,
      items: mockItems,
    });
  });

  it("renders boss item with correct classes", () => {
    const { container } = render(
      <BossItem bossNumber={0} col={0} item="boss0" row={0} />,
    );

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();
    expect(td).toHaveClass("griditem", "grid-item-base", "grid-item-relative");
  });

  it("renders all overlay components with correct boss number", () => {
    const { getByTestId } = render(
      <BossItem bossNumber={1} col={0} item="boss1" row={0} />,
    );

    expect(getByTestId("medallion-overlay-1")).toBeInTheDocument();
    expect(getByTestId("chest-overlay-1")).toBeInTheDocument();
    expect(getByTestId("reward-overlay-1")).toBeInTheDocument();
    expect(getByTestId("corner-table")).toBeInTheDocument();
  });

  it("calls handleItemClick when clicked", () => {
    const { container } = render(
      <BossItem bossNumber={0} col={2} item="boss0" row={1} />,
    );

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();

    if (td) {
      fireEvent.click(td);
    }

    expect(mockHandleItemClick).toHaveBeenCalledWith("boss0");
  });

  it("renders correct background image for boss items", () => {
    const { container } = render(
      <BossItem bossNumber={0} col={0} item="boss0" row={0} />,
    );

    const td = container.querySelector("td");
    expect(td).toHaveStyle({
      backgroundImage: "url(/assets/boss01.png)",
    });
  });

  it("renders with full opacity for boss items", () => {
    const { container } = render(
      <BossItem bossNumber={1} col={0} item="boss1" row={0} />,
    );

    const td = container.querySelector("td");
    expect(td).toHaveStyle({
      opacity: "1",
    });
  });

  it("handles different boss numbers correctly", () => {
    const { getByTestId: getByTestId1 } = render(
      <BossItem bossNumber={0} col={0} item="boss0" row={0} />,
    );
    const { getByTestId: getByTestId2 } = render(
      <BossItem bossNumber={1} col={1} item="boss1" row={1} />,
    );

    expect(getByTestId1("medallion-overlay-0")).toBeInTheDocument();
    expect(getByTestId1("chest-overlay-0")).toBeInTheDocument();
    expect(getByTestId1("reward-overlay-0")).toBeInTheDocument();

    expect(getByTestId2("medallion-overlay-1")).toBeInTheDocument();
    expect(getByTestId2("chest-overlay-1")).toBeInTheDocument();
    expect(getByTestId2("reward-overlay-1")).toBeInTheDocument();
  });

  it("renders with correct structure and positioning", () => {
    const { container } = render(
      <BossItem bossNumber={1} col={4} item="boss1" row={3} />,
    );

    const td = container.querySelector("td");
    expect(td).toBeInTheDocument();
    expect(td).toHaveClass("grid-item-relative");

    // Check that all overlays are children of the td
    const overlays = container.querySelectorAll('[data-testid*="overlay"]');
    expect(overlays).toHaveLength(3); // medallion, chest, reward
  });
});

import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapChest } from "@/components/map/MapChest";
import type { ChestItem, ItemState } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";

// Mock getAssetPath
vi.mock("../../utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
}));

// Mock useGameStore
const mockToggleChest = vi.fn();
const mockSetCaption = vi.fn();

vi.mock("@/stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    items: mockItems,
    mapOrientation: "horizontal",
    medallions: mockMedallions,
    setCaption: mockSetCaption,
    toggleChest: mockToggleChest,
  })),
}));

const mockUseGameStore = vi.mocked(useGameStore);

const mockChest: ChestItem = {
  id: 1,
  isAvailable: vi.fn(() => "available"),
  isOpened: false,
  name: "Test Chest",
  x: "50%",
  y: "50%",
};

const mockItems: ItemState = {
  agahnim: 0,
  blank: false,
  bombos: false,
  book: false,
  boomerang: 0,
  boots: false,
  boss0: 0,
  boss1: 0,
  boss2: 0,
  boss3: 0,
  boss4: 0,
  boss5: 0,
  boss6: 0,
  boss7: 0,
  boss8: 0,
  boss9: 0,
  bottle: 0,
  bow: 0,
  bow1: false,
  byrna: false,
  cape: false,
  chest0: 0,
  chest1: 0,
  chest2: 0,
  chest3: 0,
  chest4: 0,
  chest5: 0,
  chest6: 0,
  chest7: 0,
  chest8: 0,
  chest9: 0,
  dungeon: 0,
  ether: false,
  firerod: false,
  flippers: false,
  flute: false,
  glove: 0,
  hammer: false,
  hookshot: false,
  icerod: false,
  lantern: false,
  mirror: false,
  moonpearl: false,
  mushroom: false,
  net: false,
  powder: false,
  quake: false,
  reward0: 0,
  reward1: 0,
  reward2: 0,
  reward3: 0,
  reward4: 0,
  reward5: 0,
  reward6: 0,
  reward7: 0,
  reward8: 0,
  reward9: 0,
  shield: 0,
  shovel: false,
  somaria: false,
  sword: 0,
  tunic: 0,
};

const mockMedallions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const defaultProps = {
  chest: mockChest,
  index: 1,
};

describe("MapChest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct initial properties", () => {
    render(<MapChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.chest");
    expect(chestElement).toHaveClass(
      "mapspan",
      "chest",
      "map-element-base",
      "map-chest",
    );
    expect(chestElement).toHaveStyle({
      backgroundImage: "url(/mocked/path/poi.png)",
      left: "50%",
      top: "50%",
    });
  });

  it("calls toggleChest when clicked", async () => {
    const user = userEvent.setup();
    render(<MapChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.chest");
    if (chestElement) {
      await user.click(chestElement);
    }

    expect(mockToggleChest).toHaveBeenCalledWith(1);
  });

  it("sets caption when hovered", async () => {
    const user = userEvent.setup();
    render(<MapChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.chest");
    if (chestElement) {
      await user.hover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("Test Chest");
  });

  it("clears caption when mouse leaves", async () => {
    const user = userEvent.setup();
    render(<MapChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.chest");
    if (chestElement) {
      await user.hover(chestElement);
      await user.unhover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("");
  });

  it("shows 'opened' class when chest is opened", () => {
    const openedChest = { ...mockChest, isOpened: true };
    render(<MapChest {...defaultProps} chest={openedChest} />);

    const chestElement = document.querySelector(".mapspan.chest");
    expect(chestElement).toHaveClass("opened");
  });

  it("transforms coordinates correctly for vertical orientation", () => {
    mockUseGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: "vertical",
      medallions: mockMedallions,
      setCaption: mockSetCaption,
      toggleChest: mockToggleChest,
    });

    const chestWithCoords = {
      ...mockChest,
      x: "75%", // > 50%, should be transformed
      y: "60%",
    };

    render(<MapChest {...defaultProps} chest={chestWithCoords} />);

    const chestElement = document.querySelector(".mapspan.chest");
    // For x > 50%: (0.75 - 0.5) * 2 * 100 = 50%
    // For y: (0.6 / 2 + 0.5) * 100 = 80%
    expect(chestElement).toHaveStyle({
      left: "50%",
      top: "80%",
    });
  });

  it("calls chest.isAvailable with items and medallions", () => {
    const mockIsAvailable = vi.fn(() => "unavailable");
    const chestWithMock = {
      ...mockChest,
      isAvailable: mockIsAvailable,
    };

    render(<MapChest {...defaultProps} chest={chestWithMock} />);

    expect(mockIsAvailable).toHaveBeenCalledWith(mockItems, mockMedallions);
  });
});

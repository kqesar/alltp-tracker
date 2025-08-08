import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DungeonItem, ItemState } from "../data/chests";
import { DungeonChest } from "./DungeonChest";

// Mock getAssetPath
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
}));

// Mock useGameStore
const mockSetCaption = vi.fn();

vi.mock("../stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    items: mockItems,
    mapOrientation: false,
    medallions: mockMedallions,
    setCaption: mockSetCaption,
  })),
}));

const mockDungeon: DungeonItem = {
  canGetChest: vi.fn(() => "available"),
  id: 1,
  image: "boss01.png",
  isBeatable: vi.fn(() => "available"),
  isBeaten: false,
  name: "Test Dungeon",
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
  chestCount: 5,
  dungeon: mockDungeon,
  index: 1,
};

describe("DungeonChest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct initial properties", () => {
    render(<DungeonChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.dungeon");
    expect(chestElement).toHaveClass("mapspan", "dungeon", "map-element-base");
    expect(chestElement).toHaveStyle({
      backgroundImage: "url(/mocked/path/poi.png)",
      left: "50%",
      top: "50%",
    });
  });

  it("sets caption when hovered", async () => {
    const user = userEvent.setup();
    render(<DungeonChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.dungeon");
    if (chestElement) {
      await user.hover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("Test Dungeon");
  });

  it("clears caption when mouse leaves", async () => {
    const user = userEvent.setup();
    render(<DungeonChest {...defaultProps} />);

    const chestElement = document.querySelector(".mapspan.dungeon");
    if (chestElement) {
      await user.hover(chestElement);
      await user.unhover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("&nbsp;");
  });

  it("shows 'opened' class when chestCount is 0", () => {
    render(<DungeonChest {...defaultProps} chestCount={0} />);

    const chestElement = document.querySelector(".mapspan.dungeon");
    expect(chestElement).toHaveClass("opened");
  });

  it("transforms coordinates correctly for vertical orientation", () => {
    const useGameStore = vi.mocked(require("../stores/gameStore").useGameStore);
    useGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: true,
      medallions: mockMedallions,
      setCaption: mockSetCaption,
    });

    const dungeonWithCoords = {
      ...mockDungeon,
      x: "75%", // > 50%, should be transformed
      y: "60%",
    };

    render(<DungeonChest {...defaultProps} dungeon={dungeonWithCoords} />);

    const chestElement = document.querySelector(".mapspan.dungeon");
    // For x > 50%: (0.75 - 0.5) * 2 * 100 = 50%
    // For y: (0.6 / 2 + 0.5) * 100 = 80%
    expect(chestElement).toHaveStyle({
      left: "50%",
      top: "80%",
    });
  });

  it("updates medallion info for Misery Mire (index 8)", async () => {
    const user = userEvent.setup();
    const dungeonWithMedallion = {
      ...mockDungeon,
      name: "Misery Mire <img src='medallion0.png' />",
    };

    const useGameStore = vi.mocked(require("../stores/gameStore").useGameStore);
    useGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: false,
      medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0], // bombos for Misery Mire
      setCaption: mockSetCaption,
    });

    render(
      <DungeonChest
        {...defaultProps}
        dungeon={dungeonWithMedallion}
        index={8}
      />,
    );

    const chestElement = document.querySelector(".mapspan.dungeon");
    if (chestElement) {
      await user.hover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith(
      "Misery Mire <img src='medallion1.png' />",
    );
  });

  it("updates medallion info for Turtle Rock (index 9)", async () => {
    const user = userEvent.setup();
    const dungeonWithMedallion = {
      ...mockDungeon,
      name: "Turtle Rock <img src='medallion0.png' />",
    };

    const useGameStore = vi.mocked(require("../stores/gameStore").useGameStore);
    useGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: false,
      medallions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2], // ether for Turtle Rock
      setCaption: mockSetCaption,
    });

    render(
      <DungeonChest
        {...defaultProps}
        dungeon={dungeonWithMedallion}
        index={9}
      />,
    );

    const chestElement = document.querySelector(".mapspan.dungeon");
    if (chestElement) {
      await user.hover(chestElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith(
      "Turtle Rock <img src='medallion2.png' />",
    );
  });

  it("calls dungeon.canGetChest with items and medallions", () => {
    const mockCanGetChest = vi.fn(() => "unavailable");
    const dungeonWithMock = {
      ...mockDungeon,
      canGetChest: mockCanGetChest,
    };

    render(<DungeonChest {...defaultProps} dungeon={dungeonWithMock} />);

    expect(mockCanGetChest).toHaveBeenCalledWith(mockItems, mockMedallions);
  });
});

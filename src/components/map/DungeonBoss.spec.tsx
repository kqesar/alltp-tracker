import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DungeonBoss } from "@/components/map/DungeonBoss";
import type { DungeonItem, ItemState } from "@/data/chests";
import { useGameStore } from "@/stores/gameStore";

// Mock getAssetPath
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
}));

// Mock useGameStore
const mockToggleDungeonBoss = vi.fn();
const mockSetCaption = vi.fn();

const mockItems: ItemState = {
  agahnim: 0,
  bigkey0: 0,
  bigkey1: 0,
  bigkey2: 0,
  bigkey3: 0,
  bigkey4: 0,
  bigkey5: 0,
  bigkey6: 0,
  bigkey7: 0,
  bigkey8: 0,
  bigkey9: 0,
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

vi.mock("@/stores/gameStore", () => ({
  useGameStore: vi.fn(() => ({
    bigKeysVisible: true,
    items: mockItems,
    mapOrientation: false,
    medallions: mockMedallions,
    setCaption: mockSetCaption,
    toggleDungeonBoss: mockToggleDungeonBoss,
  })),
}));

const mockUseGameStore = vi.mocked(useGameStore);

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

const defaultProps = {
  dungeon: mockDungeon,
  index: 1,
};

describe("DungeonBoss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct initial properties", () => {
    render(<DungeonBoss {...defaultProps} />);

    const bossElement = document.querySelector(".mapspan.boss");
    expect(bossElement).toHaveClass("mapspan", "boss", "map-element-base");
    expect(bossElement).toHaveStyle({
      backgroundImage: "url(/mocked/path/boss01.png)",
      left: "50%",
      top: "50%",
    });
  });

  it("calls toggleDungeonBoss when clicked", async () => {
    const user = userEvent.setup();
    render(<DungeonBoss {...defaultProps} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.click(bossElement);
    }

    expect(mockToggleDungeonBoss).toHaveBeenCalledWith(1);
  });

  it("sets caption when hovered", async () => {
    const user = userEvent.setup();
    render(<DungeonBoss {...defaultProps} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.hover(bossElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("Test Dungeon");
  });

  it("clears caption when mouse leaves", async () => {
    const user = userEvent.setup();
    render(<DungeonBoss {...defaultProps} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.hover(bossElement);
      await user.unhover(bossElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith("");
  });

  it("shows 'opened' class when boss is beaten (value 2)", () => {
    mockUseGameStore.mockReturnValue({
      items: { ...mockItems, boss1: 2 },
      mapOrientation: false,
      medallions: mockMedallions,
      setCaption: mockSetCaption,
      toggleDungeonBoss: mockToggleDungeonBoss,
    });

    render(<DungeonBoss {...defaultProps} />);

    const bossElement = document.querySelector(".mapspan.boss");
    expect(bossElement).toHaveClass("opened");
  });

  it("shows 'opened' class when dungeon is beaten", () => {
    const beatenDungeon = { ...mockDungeon, isBeaten: true };

    render(<DungeonBoss {...defaultProps} dungeon={beatenDungeon} />);

    const bossElement = document.querySelector(".mapspan.boss");
    expect(bossElement).toHaveClass("opened");
  });

  it("transforms coordinates correctly for vertical orientation", () => {
    mockUseGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: true,
      medallions: mockMedallions,
      setCaption: mockSetCaption,
      toggleDungeonBoss: mockToggleDungeonBoss,
    });

    const dungeonWithCoords = {
      ...mockDungeon,
      x: "75%", // > 50%, should be transformed
      y: "60%",
    };

    render(<DungeonBoss {...defaultProps} dungeon={dungeonWithCoords} />);

    const bossElement = document.querySelector(".mapspan.boss");
    // For x > 50%: (0.75 - 0.5) * 2 * 100 = 50%
    // For y: (0.6 / 2 + 0.5) * 100 = 80%
    expect(bossElement).toHaveStyle({
      left: "50%",
      top: "80%",
    });
  });

  it("transforms coordinates correctly for vertical orientation when x <= 50%", () => {
    mockUseGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: true,
      medallions: mockMedallions,
      setCaption: mockSetCaption,
      toggleDungeonBoss: mockToggleDungeonBoss,
    });

    const dungeonWithCoords = {
      ...mockDungeon,
      x: "25%", // <= 50%, different transformation
      y: "60%",
    };

    render(<DungeonBoss {...defaultProps} dungeon={dungeonWithCoords} />);

    const bossElement = document.querySelector(".mapspan.boss");
    // For x <= 50%: 0.25 * 2 * 100 = 50%
    // For y: (0.6 / 2) * 100 = 30%
    expect(bossElement).toHaveStyle({
      left: "50%",
      top: "30%",
    });
  });

  it("calls dungeon.isBeatable with items, medallions, and bigKeysVisible", () => {
    const mockIsBeatable = vi.fn(() => "unavailable");
    const dungeonWithMock = {
      ...mockDungeon,
      isBeatable: mockIsBeatable,
    };

    // Ensure the mock returns the expected values
    mockUseGameStore.mockReturnValue({
      bigKeysVisible: true,
      items: mockItems,
      mapOrientation: false,
      medallions: mockMedallions,
      setCaption: mockSetCaption,
      toggleDungeonBoss: mockToggleDungeonBoss,
    });

    render(<DungeonBoss {...defaultProps} dungeon={dungeonWithMock} />);

    expect(mockIsBeatable).toHaveBeenCalledWith(
      mockItems,
      mockMedallions,
      true,
    );
  });

  it("updates medallion info for Misery Mire (index 8)", async () => {
    const user = userEvent.setup();
    const dungeonWithMedallion = {
      ...mockDungeon,
      name: "Misery Mire <img src='medallion0.png' />",
    };

    mockUseGameStore.mockReturnValue({
      items: mockItems,
      mapOrientation: false,
      medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0], // bombos for Misery Mire
      setCaption: mockSetCaption,
      toggleDungeonBoss: mockToggleDungeonBoss,
    });

    render(
      <DungeonBoss
        {...defaultProps}
        dungeon={dungeonWithMedallion}
        index={8}
      />,
    );

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.hover(bossElement);
    }

    expect(mockSetCaption).toHaveBeenCalledWith(
      "Misery Mire <img src='medallion1.png' />",
    );
  });
});

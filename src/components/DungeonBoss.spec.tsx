import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DungeonItem, ItemState } from "../data/chests";
import { DungeonBoss } from "./DungeonBoss";

// Mock getAssetPath
vi.mock("@/utils", () => ({
  getAssetPath: vi.fn((path: string) => `/mocked/path/${path}`),
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
  // Add other required properties for ItemState
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
  dungeon: mockDungeon,
  index: 1,
  items: mockItems,
  mapOrientation: false,
  medallions: mockMedallions,
  onHighlight: vi.fn(),
  onToggle: vi.fn(),
  onUnhighlight: vi.fn(),
};

describe("DungeonBoss", () => {
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

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<DungeonBoss {...defaultProps} onToggle={onToggle} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.click(bossElement);
    }

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("calls onHighlight when hovered", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();

    render(<DungeonBoss {...defaultProps} onHighlight={onHighlight} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.hover(bossElement);
    }

    expect(onHighlight).toHaveBeenCalledWith(1);
  });

  it("calls onUnhighlight when mouse leaves", async () => {
    const user = userEvent.setup();
    const onUnhighlight = vi.fn();

    render(<DungeonBoss {...defaultProps} onUnhighlight={onUnhighlight} />);

    const bossElement = document.querySelector(".mapspan.boss");
    if (bossElement) {
      await user.hover(bossElement);
      await user.unhover(bossElement);
    }

    expect(onUnhighlight).toHaveBeenCalled();
  });

  it("shows 'opened' class when boss is beaten (value 2)", () => {
    const itemsWithBeatenBoss = { ...mockItems, boss1: 2 };

    render(<DungeonBoss {...defaultProps} items={itemsWithBeatenBoss} />);

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
    const dungeonWithCoords = {
      ...mockDungeon,
      x: "75%", // > 50%, should be transformed
      y: "60%",
    };

    render(
      <DungeonBoss
        {...defaultProps}
        dungeon={dungeonWithCoords}
        mapOrientation={true}
      />,
    );

    const bossElement = document.querySelector(".mapspan.boss");
    // For x > 50%: (0.75 - 0.5) * 2 * 100 = 50%
    // For y: (0.6 / 2 + 0.5) * 100 = 80%
    expect(bossElement).toHaveStyle({
      left: "50%",
      top: "80%",
    });
  });

  it("transforms coordinates correctly for vertical orientation when x <= 50%", () => {
    const dungeonWithCoords = {
      ...mockDungeon,
      x: "25%", // <= 50%, different transformation
      y: "60%",
    };

    render(
      <DungeonBoss
        {...defaultProps}
        dungeon={dungeonWithCoords}
        mapOrientation={true}
      />,
    );

    const bossElement = document.querySelector(".mapspan.boss");
    // For x <= 50%: 0.25 * 2 * 100 = 50%
    // For y: (0.6 / 2) * 100 = 30%
    expect(bossElement).toHaveStyle({
      left: "50%",
      top: "30%",
    });
  });

  it("calls dungeon.isBeatable with items and medallions", () => {
    const mockIsBeatable = vi.fn(() => "unavailable");
    const dungeonWithMock = {
      ...mockDungeon,
      isBeatable: mockIsBeatable,
    };

    render(<DungeonBoss {...defaultProps} dungeon={dungeonWithMock} />);

    expect(mockIsBeatable).toHaveBeenCalledWith(mockItems, mockMedallions);
  });
});

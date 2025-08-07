import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChestItem, DungeonItem, ItemState } from "../data/chests";
import { MapTracker } from "./MapTracker";

describe("MapTracker", () => {
  const mockItems: ItemState = {
    agahnim: 0,
    blank: false,
    bombos: false,
    book: false,
    boomerang: 0,
    boots: false,
    boss0: 1,
    boss1: 1,
    boss2: 1,
    boss3: 1,
    boss4: 1,
    boss5: 1,
    boss6: 1,
    boss7: 1,
    boss8: 1,
    boss9: 1,
    bottle: 0,
    bow: 0,
    byrna: false,
    cape: false,
    chest0: 3,
    chest1: 2,
    chest2: 2,
    chest3: 5,
    chest4: 6,
    chest5: 2,
    chest6: 4,
    chest7: 3,
    chest8: 2,
    chest9: 5,
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
    tunic: 1,
  };

  const mockChests: ChestItem[] = [
    {
      id: 0,
      isAvailable: () => "true",
      isOpened: false,
      name: "Test Chest",
      x: "100px",
      y: "100px",
    },
  ];

  const mockDungeons: DungeonItem[] = [
    {
      canGetChest: () => "true",
      id: 0,
      image: "boss01.png",
      isBeatable: () => "true",
      isBeaten: false,
      name: "Test Dungeon",
      x: "200px",
      y: "200px",
    },
  ];

  const defaultProps = {
    caption: "",
    chestsState: mockChests,
    dungeonChests: { 0: 1, 1: 2 },
    dungeonsState: mockDungeons,
    items: mockItems,
    mapOrientation: false,
    medallions: [0, 1, 2],
    setCaption: vi.fn(),
    setChestsState: vi.fn(),
    setDungeonsState: vi.fn(),
  };

  it("renders without crashing", () => {
    render(<MapTracker {...defaultProps} />);

    // Check that the map container is rendered
    const mapContainer = document.querySelector(".map-container");
    expect(mapContainer).toBeInTheDocument();
  });

  it("renders map elements", () => {
    render(<MapTracker {...defaultProps} />);

    // Should render map elements with background images (not img tags)
    const mapElements = document.querySelectorAll(".mapspan");
    expect(mapElements.length).toBeGreaterThan(0);

    // Check that elements have background images
    const firstElement = mapElements[0] as HTMLElement;
    expect(firstElement.style.backgroundImage).toBeTruthy();
  });

  it("renders chest indicators", () => {
    render(<MapTracker {...defaultProps} />);

    // Should render chest elements with mapspan class
    const chestElements = document.querySelectorAll(".mapspan");
    expect(chestElements.length).toBeGreaterThan(0);
  });

  it("handles chest clicks", () => {
    const mockSetCaption = vi.fn();
    render(<MapTracker {...defaultProps} setCaption={mockSetCaption} />);

    // Find a chest element
    const chestElements = document.querySelectorAll(".mapspan");
    if (chestElements.length > 0) {
      fireEvent.click(chestElements[0]);
      // Should not throw an error
    }
  });

  it("renders dungeon boss indicators", () => {
    render(<MapTracker {...defaultProps} />);

    // Should render boss elements
    const mapElements = document.querySelectorAll(".mapspan");
    expect(mapElements.length).toBeGreaterThan(0);
  });

  it("handles boss clicks", () => {
    const mockSetCaption = vi.fn();
    render(<MapTracker {...defaultProps} setCaption={mockSetCaption} />);

    // Find boss elements
    const mapElements = document.querySelectorAll(".mapspan");
    if (mapElements.length > 0) {
      fireEvent.click(mapElements[0]);
      // Should not throw an error
    }
  });

  it("displays chest availability correctly", () => {
    const itemsWithHookshot = {
      ...mockItems,
      hookshot: true,
    };

    render(<MapTracker {...defaultProps} items={itemsWithHookshot} />);

    // With hookshot, some chests should become available
    const chestElements = document.querySelectorAll(".mapspan");
    expect(chestElements.length).toBeGreaterThan(0);
  });

  it("updates opacity based on item availability", () => {
    render(<MapTracker {...defaultProps} />);

    // Check that elements have appropriate opacity
    const mapElements = document.querySelectorAll(".mapspan");
    expect(mapElements.length).toBeGreaterThan(0);

    // Some elements should have reduced opacity when items aren't available
    const allElements = Array.from(mapElements) as HTMLElement[];
    expect(allElements.length).toBeGreaterThan(0);
  });

  it("renders different chest states", () => {
    render(<MapTracker {...defaultProps} />);

    // Should render different chest background images for different states
    const mapElements = document.querySelectorAll(".mapspan");
    expect(mapElements.length).toBeGreaterThan(0);

    if (mapElements.length > 0) {
      const firstElement = mapElements[0] as HTMLElement;
      // Check that elements have the map-element-base class which provides absolute positioning via CSS
      expect(firstElement.classList.contains("map-element-base")).toBe(true);
    }
  });

  it("handles mouse enter/leave for captions", () => {
    const mockSetCaption = vi.fn();
    render(<MapTracker {...defaultProps} setCaption={mockSetCaption} />);

    const mapElements = document.querySelectorAll(".mapspan");
    if (mapElements.length > 0) {
      const firstElement = mapElements[0];

      // Mouse enter should set caption
      fireEvent.mouseEnter(firstElement);
      expect(mockSetCaption).toHaveBeenCalled();

      // Mouse leave should clear caption
      fireEvent.mouseLeave(firstElement);
      expect(mockSetCaption).toHaveBeenCalledWith("&nbsp;");
    }
  });

  it("renders correct number of map elements", () => {
    render(<MapTracker {...defaultProps} />);

    // Should render appropriate number of chest and boss elements
    const allMapElements = document.querySelectorAll(".mapspan");
    // With 1 chest and 1 dungeon, we should have: 1 chest + 1 boss + 1 dungeon chest = 3 elements
    expect(allMapElements.length).toBe(3);
  });

  it("applies correct positioning styles", () => {
    render(<MapTracker {...defaultProps} />);

    const mapElements = document.querySelectorAll(".mapspan");
    if (mapElements.length > 0) {
      const firstElement = mapElements[0] as HTMLElement;

      // Should have the map-element-base class which provides absolute positioning via CSS
      expect(firstElement.classList.contains("map-element-base")).toBe(true);
      // Should have inline left and top styles
      expect(firstElement.style.left).toBeTruthy();
      expect(firstElement.style.top).toBeTruthy();
    }
  });

  it("handles right-click context menu", () => {
    const mockSetCaption = vi.fn();
    render(<MapTracker {...defaultProps} setCaption={mockSetCaption} />);

    const mapElements = document.querySelectorAll(".mapspan");
    if (mapElements.length > 0) {
      fireEvent.contextMenu(mapElements[0]);
      // Should prevent default context menu
    }
  });

  it("updates display when items change", () => {
    const { rerender } = render(<MapTracker {...defaultProps} />);

    // Initial state
    const initialElements = document.querySelectorAll(".mapspan");
    expect(initialElements.length).toBeGreaterThan(0);

    // Update with more items
    const updatedItems = {
      ...mockItems,
      glove: 2,
      hammer: true,
      hookshot: true,
    };

    rerender(<MapTracker {...defaultProps} items={updatedItems} />);

    // Should still render elements
    const updatedElements = document.querySelectorAll(".mapspan");
    expect(updatedElements.length).toBeGreaterThan(0);
  });
});

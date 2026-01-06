import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/constants";
import { defaultItemGrid } from "@/data/items";
import { useGameStore } from "@/stores/gameStore";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    clear: () => {
      store = {};
    },
    getItem: vi.fn((key: string) => store[key] ?? null),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("GameStore", () => {
  beforeEach(() => {
    // Clear localStorage mock
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset the store before each test
    useGameStore.getState().reset();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("initializes with default state", () => {
    const state = useGameStore.getState();

    expect(state.caption).toBe("");
    expect(state.medallions).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.mapOrientation).toBe(false);
    expect(state.items).toBeDefined();
    expect(state.chestsState).toBeDefined();
    expect(state.dungeonsState).toBeDefined();
  });

  it("updates caption", () => {
    const { setCaption } = useGameStore.getState();

    setCaption("Test caption");

    expect(useGameStore.getState().caption).toBe("Test caption");
  });

  it("handles boolean item clicks", () => {
    const { handleItemClick, items } = useGameStore.getState();

    // Assuming hookshot is a boolean item that starts as false
    const initialValue = items.hookshot;

    handleItemClick("hookshot");

    expect(useGameStore.getState().items.hookshot).toBe(!initialValue);
  });

  it("handles numeric item clicks", () => {
    const { handleItemClick } = useGameStore.getState();

    // Test increment logic for bow (assuming it's numeric)
    const initialBow = useGameStore.getState().items.bow;

    handleItemClick("bow");

    const newBow = useGameStore.getState().items.bow;
    expect(newBow).not.toBe(initialBow);
  });

  it("handles chest item clicks (decrement logic)", () => {
    const { handleItemClick } = useGameStore.getState();

    // Chest items should decrement
    const initialChest = useGameStore.getState().items.chest0;

    handleItemClick("chest0");

    const newChest = useGameStore.getState().items.chest0;
    expect(newChest).toBeLessThanOrEqual(initialChest);
  });

  it("ignores blank item clicks", () => {
    const { handleItemClick } = useGameStore.getState();
    const initialState = { ...useGameStore.getState().items };

    handleItemClick("");
    handleItemClick("blank");

    expect(useGameStore.getState().items).toEqual(initialState);
  });

  it("handles medallion changes", () => {
    const { handleMedallionChange } = useGameStore.getState();

    handleMedallionChange(8, 2);

    const medallions = useGameStore.getState().medallions;
    expect(medallions[8]).toBe(2);
  });

  it("updates caption when medallion changes for dungeon in caption", () => {
    const { setCaption, handleMedallionChange } = useGameStore.getState();

    // Set caption to show something with Misery Mire (to trigger the logic)
    setCaption("Misery Mire something");

    // Change medallion for boss 8 (Misery Mire)
    handleMedallionChange(8, 1);

    const caption = useGameStore.getState().caption;
    // The caption should now contain the updated medallion image
    expect(caption).toContain("medallion1.png");
    // And should contain the full dungeon name from the data
    expect(caption).toContain("Misery Mire");
  });

  it("toggles chest state", () => {
    const { toggleChest } = useGameStore.getState();
    const initialIsOpened = useGameStore.getState().chestsState[0].isOpened;

    toggleChest(0);

    const newIsOpened = useGameStore.getState().chestsState[0].isOpened;
    expect(newIsOpened).toBe(!initialIsOpened);
  });

  it("toggles dungeon boss state", () => {
    const { toggleDungeonBoss } = useGameStore.getState();
    const initialIsBeaten = useGameStore.getState().dungeonsState[0].isBeaten;

    toggleDungeonBoss(0);

    const newIsBeaten = useGameStore.getState().dungeonsState[0].isBeaten;
    expect(newIsBeaten).toBe(!initialIsBeaten);
  });

  it("sets chests state", () => {
    const { setChestsState } = useGameStore.getState();
    const newChests = [
      { ...useGameStore.getState().chestsState[0], isOpened: true },
    ];

    setChestsState(newChests);

    expect(useGameStore.getState().chestsState).toEqual(newChests);
  });

  it("sets dungeons state", () => {
    const { setDungeonsState } = useGameStore.getState();
    const newDungeons = [
      { ...useGameStore.getState().dungeonsState[0], isBeaten: true },
    ];

    setDungeonsState(newDungeons);

    expect(useGameStore.getState().dungeonsState).toEqual(newDungeons);
  });

  it("resets to initial state", () => {
    const { setCaption, handleMedallionChange, reset } =
      useGameStore.getState();

    // Make some changes
    setCaption("Changed");
    handleMedallionChange(8, 3);

    // Reset
    reset();

    const state = useGameStore.getState();
    expect(state.caption).toBe("");
    expect(state.medallions[8]).toBe(0);
  });

  describe("Small Keys", () => {
    it("initializes with zero small keys for all dungeons", () => {
      const { smallKeys } = useGameStore.getState();
      expect(smallKeys).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("increments small key count for Eastern Palace (max 1)", () => {
      const { handleSmallKeyClick } = useGameStore.getState();

      handleSmallKeyClick(0); // Eastern Palace
      expect(useGameStore.getState().smallKeys[0]).toBe(1);

      // Should reset to 0 when clicking at max
      handleSmallKeyClick(0);
      expect(useGameStore.getState().smallKeys[0]).toBe(0);
    });

    it("increments small key count for Palace of Darkness (max 6)", () => {
      const { handleSmallKeyClick } = useGameStore.getState();

      // Test incrementing to max
      for (let i = 1; i <= 6; i++) {
        handleSmallKeyClick(3); // Palace of Darkness
        expect(useGameStore.getState().smallKeys[3]).toBe(i);
      }

      // Should reset to 0 when clicking at max
      handleSmallKeyClick(3);
      expect(useGameStore.getState().smallKeys[3]).toBe(0);
    });

    it("increments small key count for Skull Woods (max 3)", () => {
      const { handleSmallKeyClick } = useGameStore.getState();

      // Test incrementing to max
      for (let i = 1; i <= 3; i++) {
        handleSmallKeyClick(5); // Skull Woods
        expect(useGameStore.getState().smallKeys[5]).toBe(i);
      }

      // Should reset to 0 when clicking at max
      handleSmallKeyClick(5);
      expect(useGameStore.getState().smallKeys[5]).toBe(0);
    });

    it("increments small key count for Turtle Rock (max 4)", () => {
      const { handleSmallKeyClick } = useGameStore.getState();

      // Test incrementing to max
      for (let i = 1; i <= 4; i++) {
        handleSmallKeyClick(9); // Turtle Rock
        expect(useGameStore.getState().smallKeys[9]).toBe(i);
      }

      // Should reset to 0 when clicking at max
      handleSmallKeyClick(9);
      expect(useGameStore.getState().smallKeys[9]).toBe(0);
    });

    it("handles all dungeons correctly with their respective maximums", () => {
      const { handleSmallKeyClick } = useGameStore.getState();
      const maxValues = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4];

      // Test each dungeon
      maxValues.forEach((max, dungeonIndex) => {
        // Reset store to ensure clean state
        useGameStore.getState().reset();

        // Increment to maximum
        for (let i = 1; i <= max; i++) {
          handleSmallKeyClick(dungeonIndex);
          expect(useGameStore.getState().smallKeys[dungeonIndex]).toBe(i);
        }

        // One more click should reset to 0
        handleSmallKeyClick(dungeonIndex);
        expect(useGameStore.getState().smallKeys[dungeonIndex]).toBe(0);
      });
    });

    it("resets small keys when store is reset", () => {
      const { handleSmallKeyClick, reset } = useGameStore.getState();

      // Add some small keys
      handleSmallKeyClick(0);
      handleSmallKeyClick(3);
      handleSmallKeyClick(5);

      expect(useGameStore.getState().smallKeys[0]).toBe(1);
      expect(useGameStore.getState().smallKeys[3]).toBe(1);
      expect(useGameStore.getState().smallKeys[5]).toBe(1);

      // Reset
      reset();

      expect(useGameStore.getState().smallKeys).toEqual([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);
    });
  });

  describe("Item Layout Persistence", () => {
    it("saves item layout to localStorage when setItemLayout is called", () => {
      const { setItemLayout } = useGameStore.getState();
      const newLayout = [
        ["bow", "hookshot"],
        ["boots", "glove"],
      ];

      setItemLayout(newLayout);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ITEM_LAYOUT,
        JSON.stringify(newLayout),
      );
    });

    it("clears localStorage when resetItemLayout is called", () => {
      const { setItemLayout, resetItemLayout } = useGameStore.getState();

      // First set a custom layout
      setItemLayout([["bow", "hookshot"]]);

      // Then reset
      resetItemLayout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ITEM_LAYOUT,
      );
      expect(useGameStore.getState().itemLayout).toEqual(
        defaultItemGrid.map((row) => [...row]),
      );
    });

    it("updates store state when setItemLayout is called", () => {
      const { setItemLayout } = useGameStore.getState();
      const newLayout = [
        ["bow", "hookshot"],
        ["boots", "glove"],
      ];

      setItemLayout(newLayout);

      expect(useGameStore.getState().itemLayout).toEqual(newLayout);
    });

    it("resets to default layout when resetItemLayout is called", () => {
      const { setItemLayout, resetItemLayout } = useGameStore.getState();

      // First set a custom layout
      setItemLayout([["bow", "hookshot"]]);

      // Then reset
      resetItemLayout();

      expect(useGameStore.getState().itemLayout).toEqual(
        defaultItemGrid.map((row) => [...row]),
      );
    });
  });
});

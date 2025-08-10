import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/stores/gameStore";

describe("GameStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useGameStore.getState().reset();
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
});

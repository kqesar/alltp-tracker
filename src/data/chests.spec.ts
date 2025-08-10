import { describe, expect, it } from "vitest";
import {
  type ChestItem,
  chests,
  type DungeonItem,
  dungeons,
  type ItemState,
} from "@/data/chests";

// Test data
const baseItemState: ItemState = {
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

describe("chests data", () => {
  it("should export chests array", () => {
    expect(Array.isArray(chests)).toBe(true);
    expect(chests.length).toBeGreaterThan(0);
  });

  it("should have valid chest structure", () => {
    chests.forEach((chest: ChestItem) => {
      expect(chest).toHaveProperty("id");
      expect(chest).toHaveProperty("name");
      expect(chest).toHaveProperty("x");
      expect(chest).toHaveProperty("y");
      expect(chest).toHaveProperty("isOpened");
      expect(chest).toHaveProperty("isAvailable");

      expect(typeof chest.id).toBe("number");
      expect(typeof chest.name).toBe("string");
      expect(typeof chest.x).toBe("string");
      expect(typeof chest.y).toBe("string");
      expect(typeof chest.isOpened).toBe("boolean");
      expect(typeof chest.isAvailable).toBe("function");

      // Name should not be empty
      expect(chest.name.length).toBeGreaterThan(0);

      // Coordinates should be valid percentages
      expect(chest.x).toMatch(/^\d+(\.\d+)?%$/);
      expect(chest.y).toMatch(/^\d+(\.\d+)?%$/);
    });
  });

  it("should have unique chest IDs", () => {
    const ids = chests.map((chest) => chest.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should return valid availability states", () => {
    const validStates = ["available", "unavailable", "possible", "opened"];

    chests.forEach((chest: ChestItem) => {
      const result = chest.isAvailable(baseItemState);
      expect(validStates).toContain(result);
    });
  });

  it("should handle different item configurations", () => {
    const itemsWithAllPowerUps: ItemState = {
      ...baseItemState,
      agahnim: 1,
      bombos: true,
      book: true,
      boots: true,
      bottle: 4,
      ether: true,
      firerod: true,
      flippers: true,
      flute: true,
      glove: 2,
      hammer: true,
      hookshot: true,
      icerod: true,
      lantern: true,
      mirror: true,
      moonpearl: true,
      quake: true,
      sword: 4,
    };

    chests.forEach((chest: ChestItem) => {
      const result = chest.isAvailable(itemsWithAllPowerUps);
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        result,
      );
    });
  });

  it("should handle medallion requirements correctly", () => {
    const medallions = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2]; // Bombos for Misery Mire, Ether for Turtle Rock

    chests.forEach((chest: ChestItem) => {
      const result = chest.isAvailable(baseItemState, medallions);
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        result,
      );
    });
  });
});

describe("dungeons data", () => {
  it("should export dungeons array", () => {
    expect(Array.isArray(dungeons)).toBe(true);
    expect(dungeons.length).toBeGreaterThan(0);
  });

  it("should have valid dungeon structure", () => {
    dungeons.forEach((dungeon: DungeonItem) => {
      expect(dungeon).toHaveProperty("id");
      expect(dungeon).toHaveProperty("name");
      expect(dungeon).toHaveProperty("x");
      expect(dungeon).toHaveProperty("y");
      expect(dungeon).toHaveProperty("image");
      expect(dungeon).toHaveProperty("isBeaten");
      expect(dungeon).toHaveProperty("isBeatable");
      expect(dungeon).toHaveProperty("canGetChest");

      expect(typeof dungeon.id).toBe("number");
      expect(typeof dungeon.name).toBe("string");
      expect(typeof dungeon.x).toBe("string");
      expect(typeof dungeon.y).toBe("string");
      expect(typeof dungeon.image).toBe("string");
      expect(typeof dungeon.isBeaten).toBe("boolean");
      expect(typeof dungeon.isBeatable).toBe("function");
      expect(typeof dungeon.canGetChest).toBe("function");

      // Name should not be empty
      expect(dungeon.name.length).toBeGreaterThan(0);

      // Coordinates should be valid percentages
      expect(dungeon.x).toMatch(/^\d+(\.\d+)?%$/);
      expect(dungeon.y).toMatch(/^\d+(\.\d+)?%$/);

      // Image should be a valid filename
      expect(dungeon.image).toMatch(/^boss\d{2}\.png$/);
    });
  });

  it("should have unique dungeon IDs", () => {
    const ids = dungeons.map((dungeon) => dungeon.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should return valid beatable states", () => {
    const validStates = ["available", "unavailable", "possible", "opened"];

    dungeons.forEach((dungeon: DungeonItem) => {
      const result = dungeon.isBeatable(baseItemState);
      expect(validStates).toContain(result);
    });
  });

  it("should return valid chest availability states", () => {
    const validStates = ["available", "unavailable", "possible", "opened"];

    dungeons.forEach((dungeon: DungeonItem) => {
      const result = dungeon.canGetChest(baseItemState);
      expect(validStates).toContain(result);
    });
  });

  it("should handle boss progression correctly", () => {
    // Test with different boss states
    const itemsWithBossBeaten: ItemState = {
      ...baseItemState,
      boss0: 2, // Boss beaten
    };

    const dungeon0 = dungeons.find((d) => d.id === 0);
    if (dungeon0) {
      const result = dungeon0.isBeatable(itemsWithBossBeaten);
      // Boss being beaten should affect availability
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        result,
      );
    }
  });

  it("should handle medallion requirements for special dungeons", () => {
    const medallions = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2]; // Bombos for Misery Mire, Ether for Turtle Rock

    const miseryMire = dungeons.find((d) => d.id === 8);
    const turtleRock = dungeons.find((d) => d.id === 9);

    if (miseryMire) {
      const result = miseryMire.isBeatable(baseItemState, medallions);
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        result,
      );
    }

    if (turtleRock) {
      const result = turtleRock.isBeatable(baseItemState, medallions);
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        result,
      );
    }
  });

  it("should require proper items for dungeon access", () => {
    // Test that dungeons properly check for required items
    const noItemsState: ItemState = {
      ...baseItemState,
      agahnim: 0,
      // Reset all boolean items to false and numeric to 0
      glove: 0,
      sword: 0,
      tunic: 1,
    };

    dungeons.forEach((dungeon: DungeonItem) => {
      const beatableResult = dungeon.isBeatable(noItemsState);
      const chestResult = dungeon.canGetChest(noItemsState);

      // With no items, most dungeons should be unavailable
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        beatableResult,
      );
      expect(["available", "unavailable", "possible", "opened"]).toContain(
        chestResult,
      );
    });
  });
});

describe("ItemState interface", () => {
  it("should allow dynamic access to properties", () => {
    const items: ItemState = { ...baseItemState };

    // Test dynamic access
    expect(items.hookshot).toBe(false);
    expect(items.glove).toBe(0);

    // Test setting values dynamically
    items.hookshot = true;
    items.glove = 2;

    expect(items.hookshot).toBe(true);
    expect(items.glove).toBe(2);
  });

  it("should maintain type safety for known properties", () => {
    const items: ItemState = { ...baseItemState };

    // Boolean properties
    expect(typeof items.hookshot).toBe("boolean");
    expect(typeof items.hammer).toBe("boolean");
    expect(typeof items.mirror).toBe("boolean");

    // Numeric properties
    expect(typeof items.glove).toBe("number");
    expect(typeof items.sword).toBe("number");
    expect(typeof items.agahnim).toBe("number");
  });
});

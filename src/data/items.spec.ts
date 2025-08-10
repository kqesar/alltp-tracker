import { describe, expect, it } from "vitest";
import {
  defaultItemGrid,
  dungeonchests,
  items,
  itemsMax,
  itemsMin,
} from "@/data/items";

describe("items data", () => {
  it("should export a valid items object", () => {
    expect(typeof items).toBe("object");
    expect(items).not.toBeNull();
    expect(Object.keys(items).length).toBeGreaterThan(0);
  });

  it("should have consistent boolean items", () => {
    const booleanItems = [
      "blank",
      "bombos",
      "book",
      "boots",
      "byrna",
      "cape",
      "ether",
      "firerod",
      "flippers",
      "flute",
      "hammer",
      "hookshot",
      "icerod",
      "lantern",
      "mirror",
      "moonpearl",
      "mushroom",
      "net",
      "powder",
      "quake",
      "shovel",
      "somaria",
    ];

    booleanItems.forEach((item) => {
      expect(items).toHaveProperty(item);
      expect(typeof items[item]).toBe("boolean");
    });
  });

  it("should have consistent numeric items", () => {
    const numericItems = [
      "agahnim",
      "boomerang",
      "boss0",
      "boss1",
      "boss2",
      "boss3",
      "boss4",
      "boss5",
      "boss6",
      "boss7",
      "boss8",
      "boss9",
      "bottle",
      "bow",
      "chest0",
      "chest1",
      "chest2",
      "chest3",
      "chest4",
      "chest5",
      "chest6",
      "chest7",
      "chest8",
      "chest9",
      "dungeon",
      "glove",
      "reward0",
      "reward1",
      "reward2",
      "reward3",
      "reward4",
      "reward5",
      "reward6",
      "reward7",
      "reward8",
      "reward9",
      "shield",
      "sword",
      "tunic",
    ];

    numericItems.forEach((item) => {
      expect(items).toHaveProperty(item);
      expect(typeof items[item]).toBe("number");
      expect(items[item]).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have valid initial values", () => {
    // Check some specific initial values
    expect(items.tunic).toBe(1); // Should start with green tunic
    expect(items.agahnim).toBe(0); // Should start without Agahnim defeated
    expect(items.hookshot).toBe(false); // Should start without hookshot
    expect(items.glove).toBe(0); // Should start without gloves

    // Boss states should start at 1 (not beaten)
    for (let i = 0; i <= 9; i++) {
      expect(items[`boss${i}`]).toBe(1);
    }

    // Chest counts should be positive
    for (let i = 0; i <= 9; i++) {
      expect(items[`chest${i}`]).toBeGreaterThan(0);
    }
  });
});

describe("defaultItemGrid", () => {
  it("should export a valid grid layout", () => {
    expect(Array.isArray(defaultItemGrid)).toBe(true);
    expect(defaultItemGrid.length).toBeGreaterThan(0);

    // Each row should be an array
    defaultItemGrid.forEach((row) => {
      expect(Array.isArray(row)).toBe(true);
      expect(row.length).toBeGreaterThan(0);
    });
  });

  it("should have consistent row lengths", () => {
    const firstRowLength = defaultItemGrid[0].length;

    defaultItemGrid.forEach((row) => {
      expect(row.length).toBe(firstRowLength);
    });
  });

  it("should contain valid item identifiers", () => {
    const validItems = new Set([
      ...Object.keys(items),
      "", // Empty cells are allowed
      "blank", // Blank cells are allowed
    ]);

    defaultItemGrid.forEach((row) => {
      row.forEach((item) => {
        expect(validItems.has(item)).toBe(true);
      });
    });
  });

  it("should have expected dimensions", () => {
    expect(defaultItemGrid.length).toBe(6); // 6 rows
    expect(defaultItemGrid[0].length).toBe(7); // 7 columns
  });

  it("should contain core items", () => {
    const flatGrid = defaultItemGrid.flat();
    const coreItems = ["hookshot", "hammer", "sword", "bow", "glove"];

    coreItems.forEach((item) => {
      expect(flatGrid).toContain(item);
    });
  });
});

describe("dungeonchests", () => {
  it("should export valid dungeon chest counts", () => {
    expect(typeof dungeonchests).toBe("object");
    expect(dungeonchests).not.toBeNull();
  });

  it("should have 10 dungeons (0-9)", () => {
    for (let i = 0; i <= 9; i++) {
      expect(dungeonchests).toHaveProperty(i.toString());
      expect(typeof dungeonchests[i]).toBe("number");
      expect(dungeonchests[i]).toBeGreaterThan(0);
    }
  });

  it("should match chest counts in items", () => {
    for (let i = 0; i <= 9; i++) {
      expect(dungeonchests[i]).toBe(items[`chest${i}`]);
    }
  });
});

describe("itemsMin", () => {
  it("should export valid minimum values", () => {
    expect(typeof itemsMin).toBe("object");
    expect(itemsMin).not.toBeNull();
  });

  it("should have minimum values for numeric items", () => {
    const numericItems = [
      "agahnim",
      "boomerang",
      "boss0",
      "boss1",
      "boss2",
      "boss3",
      "boss4",
      "boss5",
      "boss6",
      "boss7",
      "boss8",
      "boss9",
      "bottle",
      "bow",
      "chest0",
      "chest1",
      "chest2",
      "chest3",
      "chest4",
      "chest5",
      "chest6",
      "chest7",
      "chest8",
      "chest9",
      "dungeon",
      "glove",
      "reward0",
      "reward1",
      "reward2",
      "reward3",
      "reward4",
      "reward5",
      "reward6",
      "reward7",
      "reward8",
      "reward9",
      "shield",
      "sword",
      "tunic",
    ];

    numericItems.forEach((item) => {
      expect(itemsMin).toHaveProperty(item);
      expect(typeof itemsMin[item]).toBe("number");
      expect(itemsMin[item]).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have reasonable minimum values", () => {
    // Check some specific minimum values
    expect(itemsMin.agahnim).toBe(0);
    expect(itemsMin.tunic).toBe(1); // Green tunic minimum
    expect(itemsMin.glove).toBe(0);
    expect(itemsMin.sword).toBe(0);
  });
});

describe("itemsMax", () => {
  it("should export valid maximum values", () => {
    expect(typeof itemsMax).toBe("object");
    expect(itemsMax).not.toBeNull();
  });

  it("should have maximum values for numeric items", () => {
    const numericItems = [
      "agahnim",
      "boomerang",
      "boss0",
      "boss1",
      "boss2",
      "boss3",
      "boss4",
      "boss5",
      "boss6",
      "boss7",
      "boss8",
      "boss9",
      "bottle",
      "bow",
      "chest0",
      "chest1",
      "chest2",
      "chest3",
      "chest4",
      "chest5",
      "chest6",
      "chest7",
      "chest8",
      "chest9",
      "dungeon",
      "glove",
      "reward0",
      "reward1",
      "reward2",
      "reward3",
      "reward4",
      "reward5",
      "reward6",
      "reward7",
      "reward8",
      "reward9",
      "shield",
      "sword",
      "tunic",
    ];

    numericItems.forEach((item) => {
      expect(itemsMax).toHaveProperty(item);
      expect(typeof itemsMax[item]).toBe("number");
      expect(itemsMax[item]).toBeGreaterThan(itemsMin[item]);
    });
  });

  it("should have reasonable maximum values", () => {
    // Check some specific maximum values
    expect(itemsMax.agahnim).toBeGreaterThan(0);
    expect(itemsMax.tunic).toBeGreaterThan(1); // Should allow blue and red tunics
    expect(itemsMax.glove).toBeGreaterThan(0);
    expect(itemsMax.sword).toBeGreaterThan(0);
    expect(itemsMax.bottle).toBeGreaterThan(0);
  });

  it("should maintain min <= initial <= max relationship", () => {
    Object.keys(itemsMin).forEach((item) => {
      if (typeof items[item] === "number") {
        expect(itemsMin[item]).toBeLessThanOrEqual(items[item] as number);
        expect(items[item] as number).toBeLessThanOrEqual(itemsMax[item]);
      }
    });
  });
});

describe("data consistency", () => {
  it("should have consistent item definitions across exports", () => {
    // All items in itemsMin should exist in items
    Object.keys(itemsMin).forEach((item) => {
      expect(items).toHaveProperty(item);
    });

    // All items in itemsMax should exist in items
    Object.keys(itemsMax).forEach((item) => {
      expect(items).toHaveProperty(item);
    });
  });

  it("should have proper boss count consistency", () => {
    // Should have 10 bosses (0-9)
    for (let i = 0; i <= 9; i++) {
      expect(items).toHaveProperty(`boss${i}`);
      expect(items).toHaveProperty(`chest${i}`);
      expect(items).toHaveProperty(`reward${i}`);
    }
  });

  it("should have grid items exist in items definition", () => {
    const gridItems = defaultItemGrid.flat().filter((item) => item !== "");

    gridItems.forEach((item) => {
      if (item !== "blank") {
        expect(items).toHaveProperty(item);
      }
    });
  });
});

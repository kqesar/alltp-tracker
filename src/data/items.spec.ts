import { describe, expect, it } from "vitest";
import {
  defaultItemGrid,
  itemLabels,
  items,
  itemsMax,
  itemsMin,
} from "@/data/items";

const dungeonIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("item ranges", () => {
  it("starts every progressive item inside its own bounds", () => {
    Object.keys(itemsMin).forEach((name) => {
      const value = items[name] as number;

      expect(itemsMin[name]).toBeLessThanOrEqual(itemsMax[name]);
      expect(value).toBeGreaterThanOrEqual(itemsMin[name]);
      expect(value).toBeLessThanOrEqual(itemsMax[name]);
    });
  });

  it("bounds min and max to exactly the progressive items", () => {
    expect(Object.keys(itemsMin).sort()).toEqual(Object.keys(itemsMax).sort());

    Object.keys(itemsMin).forEach((name) => {
      expect(typeof items[name]).toBe("number");
    });
  });

  it("keeps the documented bounds for the progressive items", () => {
    expect([itemsMin.sword, itemsMax.sword]).toEqual([0, 4]);
    expect([itemsMin.glove, itemsMax.glove]).toEqual([0, 2]);
    expect([itemsMin.bow, itemsMax.bow]).toEqual([0, 3]);
    expect([itemsMin.bottle, itemsMax.bottle]).toEqual([0, 4]);
    // The tunic is never lost, so it starts at and never drops below 1.
    expect([itemsMin.tunic, itemsMax.tunic, items.tunic]).toEqual([1, 3, 1]);
  });

  it("starts each dungeon with its full chest count and a live boss", () => {
    const expectedChests = [3, 2, 2, 5, 6, 2, 4, 3, 2, 5];

    dungeonIndices.forEach((index) => {
      // Chest counters start full and are counted down.
      expect(items[`chest${index}`]).toBe(expectedChests[index]);
      expect(itemsMax[`chest${index}`]).toBe(expectedChests[index]);
      expect(itemsMin[`chest${index}`]).toBe(0);

      expect(items[`boss${index}`]).toBe(1);
      expect(items[`bigkey${index}`]).toBe(0);
      expect(items[`reward${index}`]).toBe(0);
    });
  });

  it("starts every non-progressive item unheld", () => {
    Object.entries(items)
      .filter(([, value]) => typeof value === "boolean")
      .forEach(([, value]) => {
        expect(value).toBe(false);
      });
  });
});

describe("defaultItemGrid", () => {
  it("is a 7x7 grid", () => {
    expect(defaultItemGrid).toHaveLength(7);
    defaultItemGrid.forEach((row) => {
      expect(row).toHaveLength(7);
    });
  });

  it("only places items the store knows about", () => {
    defaultItemGrid.flat().forEach((item) => {
      expect(items).toHaveProperty(item);
    });
  });

  it("lays out all ten bosses and all ten big keys", () => {
    const flat = defaultItemGrid.flat();

    dungeonIndices.forEach((index) => {
      expect(flat).toContain(`boss${index}`);
      expect(flat).toContain(`bigkey${index}`);
    });
  });
});

describe("itemLabels", () => {
  it("spells out ids that are not just capitalised", () => {
    expect(itemLabels("moonpearl")).toBe("Moon Pearl");
    expect(itemLabels("book")).toBe("Book of Mudora");
  });

  it("capitalises anything else", () => {
    expect(itemLabels("hookshot")).toBe("Hookshot");
  });

  it("names bosses rather than their index", () => {
    expect(itemLabels("boss0")).toBe("Armos Knights");
    expect(itemLabels("boss9")).toBe("Trinexx");
  });

  it("describes empty slots", () => {
    expect(itemLabels("blank")).toBe("Empty slot");
    expect(itemLabels("")).toBe("Empty slot");
  });
});

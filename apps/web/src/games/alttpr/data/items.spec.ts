import { describe, expect, it } from "vitest";
import {
  defaultItemGrid,
  isKeyCell,
  itemGridFor,
  itemLabels,
  items,
  itemsMax,
  itemsMin,
  TOGGLE_ITEMS,
} from "@/games/alttpr/data/items";

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

describe("the half magic", () => {
  it("is a cell of the equipment row, between the tunic and the boots", () => {
    expect(defaultItemGrid[1]).toEqual([
      "bow",
      "lantern",
      "shield",
      "sword",
      "tunic",
      "magic",
      "boots",
    ]);
    // Agahnim stands with Castle Tower's keys, in every run
    for (const grid of [defaultItemGrid, itemGridFor({ mode: "retro" })]) {
      expect(grid.flat().filter((id) => id === "agahnim")).toHaveLength(1);
      expect(grid.at(-1)?.[2]).toBe("agahnim");
    }
  });

  it("counts a half and a quarter, a plain toggle on the board", () => {
    expect([itemsMin.magic, itemsMax.magic, items.magic]).toEqual([0, 2, 0]);
    expect(TOGGLE_ITEMS.has("magic")).toBe(true);
    expect(itemLabels("magic")).toBe("Half Magic");
  });
});

describe("defaultItemGrid", () => {
  it("is 7 wide, 8 rows with the castle dungeons' keys", () => {
    expect(defaultItemGrid).toHaveLength(8);
    defaultItemGrid.forEach((row) => {
      expect(row).toHaveLength(7);
    });
  });

  it("only places items the store knows about, and key cells", () => {
    defaultItemGrid
      .flat()
      // Ganon's Tower's boss cell steps Agahnim 2 (agahnim2)
      .filter((id) => id !== "" && !isKeyCell(id) && id !== "boss12")
      .forEach((item) => {
        expect(items).toHaveProperty(item);
      });
  });

  it("lays out the ten bosses, thirteen key cells and the castles' labels", () => {
    const flat = defaultItemGrid.flat();

    dungeonIndices.forEach((index) => {
      expect(flat).toContain(`boss${index}`);
    });
    for (let index = 0; index < 13; index++) {
      expect(flat).toContain(`keys${index}`);
    }
    expect(defaultItemGrid.at(-1)).toEqual([
      "keylabel10",
      "keys10",
      "agahnim",
      "keys11",
      "keylabel12",
      "keys12",
      "boss12",
    ]);
  });
});

describe("itemGridFor", () => {
  it("lays a retro run's shops where the castles' key cells stand", () => {
    expect(itemGridFor({ mode: "open" })).toBe(defaultItemGrid);
    const retro = itemGridFor({ mode: "retro" });
    expect(retro.slice(0, -1)).toEqual(defaultItemGrid.slice(0, -1));
    expect(retro.at(-1)).toEqual([
      "shoparrow",
      "shopkey",
      "agahnim",
      "",
      "keylabel12",
      "keys12",
      "boss12",
    ]);
    expect(items).toMatchObject({ shoparrow: false, shopkey: false });
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

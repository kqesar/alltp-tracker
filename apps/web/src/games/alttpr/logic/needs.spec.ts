import type { Atom } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { needOf, sameWays, waysOf, waysText } from "@/games/alttpr/logic/needs";
import { RECORDED_LEVELS } from "@/games/alttpr/logic/packItems";

const item = (id: string, min = 1): Atom => ({ item: id, min });

/** The icons the app ships, by file name. */
const ASSETS = new Set(
  Object.keys(import.meta.glob("../../../../public/assets/*.png")).map(
    (path) => path.split("/").at(-1) ?? path,
  ),
);

describe("needOf", () => {
  it("names an item by its cell, a level by the item it is", () => {
    expect(needOf(item("hammer"))).toEqual({
      icon: "hammer.png",
      key: "hammer>=1",
      label: "Hammer",
    });
    expect(needOf(item("moonPearl")).label).toBe("Moon Pearl");
    expect(needOf(item("sword", 2))).toMatchObject({
      icon: "sword2.png",
      label: "Master Sword",
    });
    expect(needOf(item("glove", 2))).toMatchObject({
      icon: "glove2.png",
      label: "Titan's Mitt",
    });
    // The tunic's cell starts at 1, the green one Link wears
    expect(needOf(item("armor", 1))).toMatchObject({
      icon: "tunic2.png",
      label: "Blue Mail",
    });
    expect(needOf(item("bottle", 2)).label).toBe("2 Bottles");
    expect(needOf(item("bottle")).label).toBe("Bottle");
  });

  it("draws a bit of a shared cell with that bit's picture", () => {
    expect(needOf(item("silverArrowUpgrade"))).toMatchObject({
      icon: "bow1.png",
      label: "Silver Arrows",
    });
    expect(needOf(item("bow"))).toMatchObject({ icon: "bow2.png" });
    expect(needOf(item("redBoomerang"))).toMatchObject({
      icon: "boomerang2.png",
      label: "Red Boomerang",
    });
  });

  it("names prizes, events, a crystal count and a dungeon's own items", () => {
    expect(needOf({ group: "crystal", min: 7 })).toEqual({
      icon: "dungeon3.png",
      key: "crystal>=7",
      label: "7 crystals",
    });
    expect(needOf(item("crystal5"))).toMatchObject({
      icon: "dungeon4.png",
      label: "Crystal 5",
    });
    expect(needOf(item("pendantOfCourage")).label).toBe("Pendant of Courage");
    expect(needOf(item("defeatAgahnim")).label).toBe("Agahnim");
    expect(needOf(item("bigKeyD1"))).toMatchObject({
      icon: "bigkey.png",
      label: "Palace of Darkness big key",
    });
    expect(needOf(item("keyD1", 4)).label).toBe(
      "4 Palace of Darkness small keys",
    );
    expect(needOf(item("keyP2")).label).toBe("Desert Palace small key");
    expect(needOf(item("compassP1")).label).toBe("Eastern Palace compass");
  });

  it("has an existing icon for every level of what the player can mark", () => {
    expect(ASSETS.size).toBeGreaterThan(50);
    expect(RECORDED_LEVELS.size).toBeGreaterThan(40);
    const missing: string[] = [];
    for (const [id, top] of RECORDED_LEVELS) {
      for (let level = 1; level <= top; level++) {
        const { icon, label } = needOf(item(id, level));
        if (label === id) missing.push(`${id} has no name`);
        if (icon === undefined || !ASSETS.has(icon)) {
          missing.push(`${id} ${level}: ${icon}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("waysText", () => {
  it("joins atoms with +, sets with or, and says when some were cut", () => {
    const ways = waysOf({
      sets: [[item("hammer")], [item("moonPearl"), item("glove")]],
      truncated: false,
    });
    expect(waysText(ways)).toBe("Hammer, or Moon Pearl + Power Glove");
    expect(waysText({ ...ways, truncated: true })).toBe(
      "Hammer, or Moon Pearl + Power Glove, and more",
    );
  });
});

describe("sameWays", () => {
  it("compares the sets atom by atom", () => {
    const a = waysOf({ sets: [[item("hammer")]], truncated: false });
    expect(sameWays(a, a)).toBe(true);
    expect(
      sameWays(a, waysOf({ sets: [[item("sword", 2)]], truncated: false })),
    ).toBe(false);
    expect(sameWays(a, waysOf({ sets: [], truncated: false }))).toBe(false);
  });
});

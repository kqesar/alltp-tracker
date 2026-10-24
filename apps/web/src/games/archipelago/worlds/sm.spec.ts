import { describe, expect, it } from "vitest";
import {
  NO_PROBLEM,
  skinProblems,
  worldNames,
} from "@/games/archipelago/fixtures";
import {
  countsOf,
  type ItemCell,
  rowsOf,
} from "@/games/archipelago/worlds/skin";
import { SM_SKIN } from "@/games/archipelago/worlds/sm";

/**
 * Super Metroid's progression items: the pool `create_items` builds in AP
 * 0.6.8's worlds/sm/__init__.py (commit 54803be0) classes every item
 * progression but those of VARIA's `Nothing` category (Nothing, No Energy)
 * and the packs past the first three missiles, two supers and three power
 * bombs; every item with an id but those and `Generic`
 * (variaRandomizer/rando/Items.py).
 */
const PROGRESSION = [
  "Energy Tank",
  "Missile",
  "Super Missile",
  "Power Bomb",
  "Bomb",
  "Charge Beam",
  "Ice Beam",
  "Hi-Jump Boots",
  "Speed Booster",
  "Wave Beam",
  "Spazer",
  "Spring Ball",
  "Varia Suit",
  "Gravity Suit",
  "X-Ray Scope",
  "Plasma Beam",
  "Grappling Beam",
  "Space Jump",
  "Screw Attack",
  "Morph Ball",
  "Reserve Tank",
];

const names = worldNames("Super Metroid");

/** A cell's level, words and sprite, holding these items. */
const levelOf = (id: string, held: Record<string, number>) => {
  const found = SM_SKIN.cells.find(
    (c): c is ItemCell => c.id === id && c.kind === "item",
  );
  if (found === undefined) throw new Error(`No cell ${id}`);
  const level = found.level(
    countsOf(
      Object.entries(held).map(([name, count]) => ({ count, flags: 1, name })),
    ),
  );
  return [level, found.describe(level), found.sprite(level)];
};

describe("the Super Metroid skin, against AP 0.6.8's name data", () => {
  it("maps VARIA's names, every progression item a cell", () => {
    expect(names.checksum).toBe("4fd6c0bb6c0f0ab1157fb5dbda01a572ae3d0da6");
    expect(skinProblems(SM_SKIN, names, PROGRESSION)).toEqual(NO_PROBLEM);
    // Map Rando's names are not AP's
    expect(names.itemIds.has("Morphing Ball")).toBe(false);
    expect(names.itemIds.has("Morph Ball")).toBe(true);
  });

  it("lays three full rows of seven, in the SM board's order", () => {
    expect(rowsOf(SM_SKIN).map((row) => row.map((cell) => cell.id))).toEqual([
      ["charge", "ice", "wave", "spazer", "plasma", "xray", "grapple"],
      ["morph", "bombs", "springball", "screw", "varia", "gravity", "hijump"],
      ["spacejump", "speed", "etank", "reserve", "missile", "super", "pb"],
    ]);
  });

  it("puts every location in one of VARIA's areas", () => {
    const groups = SM_SKIN.groups ?? {};
    expect(Object.keys(groups)).toHaveLength(10);
    expect(groups["Kraid's Lair"]).toEqual([
      "Energy Tank, Kraid",
      "Varia Suit",
      "Missile (Kraid)",
    ]);
    // The checks catch a table out of step with the name data
    const broken = {
      ...SM_SKIN,
      groups: {
        ...groups,
        "Kraid's Lair": ["Varia Suit", "Kraid"],
        Twice: ["Bomb"],
      },
    };
    expect(skinProblems(broken, names, PROGRESSION)).toEqual({
      ...NO_PROBLEM,
      groupedTwice: ["Bomb"],
      ungrouped: ["Energy Tank, Kraid", "Missile (Kraid)"],
      unknownGrouped: ["Kraid"],
    });
  });
});

describe("a Super Metroid cell", () => {
  it("draws Map Rando's sheet, a counter counting its packs", () => {
    expect(levelOf("morph", {})).toEqual([0, "not received", { frame: 19 }]);
    expect(levelOf("morph", { "Morph Ball": 1 })[1]).toBe("received");
    expect(levelOf("missile", { Missile: 7 })).toEqual([
      7,
      "7 received",
      { frame: 1 },
    ]);
    const missile = SM_SKIN.cells.find((c) => c.id === "missile");
    expect(missile?.kind === "item" && missile.counter).toBe(true);
    expect(missile?.kind === "item" && missile.caps).toEqual({});
  });
});

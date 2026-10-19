import { describe, expect, it } from "vitest";
import {
  BEATEN_CELLS,
  boardItems,
  cellsFromPack,
  joinValues,
  mostShown,
  PRIZE_CELLS,
  prizeOf,
} from "@/games/alttpr/autotrack/table";
import { items, itemsMax, itemsMin } from "@/games/alttpr/data/items";
import { PACK_ITEMS, packReading } from "@/games/alttpr/logic/packItems";

/** Every value a cell takes: false and true, or its range. */
const valuesOf = (id: string): (number | boolean)[] =>
  typeof items[id] === "boolean"
    ? [false, true]
    : Array.from(
        { length: itemsMax[id] - itemsMin[id] + 1 },
        (_, step) => itemsMin[id] + step,
      );

/** The pack items a cell counts, each held 0 times. */
const nothingHeldBy = (id: string): Record<string, number> => {
  const entry = PACK_ITEMS[id];
  const counted =
    entry.kind === "count"
      ? [entry.item]
      : entry.kind === "bits"
        ? entry.items
        : [];
  return Object.fromEntries(counted.map((item) => [item, 0]));
};

describe("the board's cells, read from the game through PACK_ITEMS", () => {
  it("reads every value of every counted cell back from what it records", () => {
    const misread: string[] = [];
    const counted = Object.keys(PACK_ITEMS).filter(
      (id) => Object.keys(nothingHeldBy(id)).length > 0,
    );
    for (const id of counted) {
      for (const value of valuesOf(id)) {
        const game = {
          ...nothingHeldBy(id),
          ...packReading({ [id]: value } as never).items,
        };
        const back = cellsFromPack(game)[id];
        if (back !== value) misread.push(`${id}=${value} read ${back}`);
      }
    }

    // Items, levels, the bow's and boomerangs' bits, keys, maps, compasses
    expect(counted).toEqual(
      expect.arrayContaining(["bow", "boomerang", "map0", "compass9"]),
    );
    expect(misread).toEqual([]);
  });

  it("leaves a cell alone while the game leaves an item it counts unknown", () => {
    const cells = cellsFromPack({ bow: 1, hookshot: 1, sword: 3 });

    expect(cells).toMatchObject({ hookshot: true, sword: 3 });
    // The bow cell counts the silver arrows too
    expect(cells).not.toHaveProperty("bow");
    expect(cells).not.toHaveProperty("hammer");
    expect(cells).not.toHaveProperty("boss0");
  });

  it("shows a count above a cell's range at its top", () => {
    expect(cellsFromPack({ flute: 2 })).toEqual({ flute: true });
    expect(cellsFromPack({ bottle: 9 })).toEqual({ bottle: 4 });
    expect(mostShown("bow")).toBe(1);
    expect(mostShown("sword")).toBe(4);
    expect(mostShown("armor")).toBe(2);
    expect(mostShown("magic")).toBe(0);
  });

  it("finds the cells that say a boss is beaten, and their values", () => {
    expect(BEATEN_CELLS).toEqual(
      expect.arrayContaining([
        { alive: 1, at: 2, dungeon: "eastern-palace", id: "boss0" },
        { alive: 0, at: 1, dungeon: "castle-tower", id: "agahnim" },
        { alive: 0, at: 1, dungeon: "ganons-tower", id: "agahnim2" },
      ]),
    );
    expect(BEATEN_CELLS).toHaveLength(12);
  });

  it("finds each dungeon's prize cell, and the value of each prize", () => {
    expect(PRIZE_CELLS).toHaveLength(10);
    const turtleRock = PRIZE_CELLS.find((cell) => cell.id === "reward9");
    expect(turtleRock).toEqual({
      dungeon: "turtle-rock",
      id: "reward9",
      values: { crystal: 3, greenPendant: 1, pendant: 2, redCrystal: 4 },
    });
    expect(prizeOf(PRIZE_CELLS[0], 4)).toBe("redCrystal");
    expect(prizeOf(PRIZE_CELLS[0], 0)).toBeUndefined();
  });

  it("joins the player's value and the game's into the least holding both", () => {
    expect(joinValues("sword", 3, 2)).toBe(3);
    expect(joinValues("sword", 1, 2)).toBe(2);
    expect(joinValues("hookshot", true, false)).toBe(true);
    expect(joinValues("hookshot", false, true)).toBe(true);
    expect(joinValues("hookshot", false, false)).toBe(false);
    // The blue boomerang marked, the red one in the game: both
    expect(joinValues("boomerang", 1, 2)).toBe(3);
    // The silver arrows marked, the bow in the game: both
    expect(joinValues("bow", 1, 2)).toBe(3);
    expect(joinValues("tunic", 1, 3)).toBe(3);
    // A boss beaten on either side is beaten
    expect(joinValues("boss0", 2, 1)).toBe(2);
    expect(joinValues("boss0", 1, 2)).toBe(2);
    // A prize the player named stays; an unknown one takes the game's
    expect(joinValues("reward0", 3, 4)).toBe(3);
    expect(joinValues("reward0", 0, 4)).toBe(4);
    // A counter is no item: the board's stays
    expect(joinValues("chest0", 1, 3)).toBe(1);
  });

  it("names the pack items the board marks", () => {
    const shown = boardItems(false);
    for (const item of [
      "hookshot",
      "lamp",
      "silverArrowUpgrade",
      "redBoomerang",
      "bigKeyD7",
      "mapP1",
      "compassD7",
      "mapH2",
      "bigKeyA2",
      "crystal5",
      "pendantOfCourage",
    ] as const) {
      expect(shown.has(item)).toBe(true);
    }
    for (const item of [
      "magic",
      "tenBombs",
      "heartContainer",
      "keyD1",
      "keyA2",
      "rescueZelda",
    ] as const) {
      expect(shown.has(item)).toBe(false);
    }
    // With keysanity the key cells count their dungeons' small keys, the
    // castles' included
    expect(boardItems(true).has("keyD1")).toBe(true);
    expect(boardItems(true).has("keyA2")).toBe(true);
    expect(boardItems(true).has("keyH2")).toBe(true);
  });
});

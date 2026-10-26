import { ROOM_TILES, TILE } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  directionWords,
  KIND_NAMES,
  kindsIn,
  LEGEND_ORDER,
  pathOf,
  roomWords,
} from "@/games/alttpr/autotrack/darkRoom";

const chest = (x0: number, y0: number, x1 = x0 + 1, y1 = y0 + 1) => ({
  x0,
  x1,
  y0,
  y1,
});
const NO_TORCHES = { total: 0, unlit: 0 };

describe("directionWords", () => {
  it("counts tiles one way then the other, and drops a zero", () => {
    expect(directionWords(-6, -3)).toBe("6 tiles left, 3 tiles up");
    expect(directionWords(1, 0)).toBe("1 tile right");
    expect(directionWords(0, 4)).toBe("4 tiles down");
    expect(directionWords(0, 0)).toBe("right where you stand");
  });
});

describe("roomWords", () => {
  const link = { x: 40, y: 40 }; // his middle is tile (41, 41)

  it("names the nearest closed chest, not the first", () => {
    const words = roomWords(
      { chests: [chest(10, 10), chest(44, 41)], torches: NO_TORCHES },
      link,
    );
    // The second chest's middle is (45, 42): 4 right, 1 down
    expect(words).toBe("Nearest unopened chest: 4 tiles right, 1 tile down.");
  });

  it("says so when none is left", () => {
    expect(roomWords({ chests: [], torches: NO_TORCHES }, link)).toBe(
      "No unopened chest in this room.",
    );
  });

  it("counts the torches that are not lit", () => {
    const torches = (total: number, unlit: number) =>
      roomWords({ chests: [], torches: { total, unlit } }, link);
    expect(torches(3, 2)).toMatch(/2 of 3 torches not lit\.$/);
    expect(torches(1, 1)).toMatch(/1 of 1 torch not lit\.$/);
    expect(torches(4, 0)).toMatch(/All 4 torches are lit\.$/);
    expect(torches(1, 0)).toMatch(/The torch is lit\.$/);
  });
});

describe("the plan's drawing helpers", () => {
  const kinds = new Uint8Array(ROOM_TILES * ROOM_TILES).fill(TILE.wall);
  const set = (x: number, y: number, kind: number) => {
    kinds[y * ROOM_TILES + x] = kind;
  };
  for (const x of [5, 6, 7, 9]) set(x, 3, TILE.floor);
  set(6, 4, TILE.chest);
  const bounds = { x0: 4, x1: 10, y0: 2, y1: 5 };

  it("fills a kind with one rectangle per horizontal run", () => {
    expect(pathOf(kinds, bounds, TILE.floor)).toBe("M5 3h3v1h-3zM9 3h1v1h-1z");
    expect(pathOf(kinds, bounds, TILE.chest)).toBe("M6 4h1v1h-1z");
    expect(pathOf(kinds, bounds, TILE.pit)).toBe("");
  });

  it("lists the kinds a room holds in the legend's order, each once", () => {
    expect(kindsIn(kinds, bounds)).toEqual([TILE.floor, TILE.wall, TILE.chest]);
    // Only inside the bounds
    expect(kindsIn(kinds, { x0: 5, x1: 5, y0: 3, y1: 3 })).toEqual([
      TILE.floor,
    ]);
  });

  it("names every kind the legend knows, and the legend every kind", () => {
    for (const kind of Object.values(TILE)) {
      expect(KIND_NAMES[kind], String(kind)).toBeTruthy();
      expect(LEGEND_ORDER, String(kind)).toContain(kind);
    }
    expect(new Set(Object.values(KIND_NAMES)).size).toBe(
      Object.values(TILE).length,
    );
  });
});

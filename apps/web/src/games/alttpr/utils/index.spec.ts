import { describe, expect, it } from "vitest";
import { defaultItemGrid } from "@/games/alttpr/data/items";
import {
  getItemBackground,
  isItemDimmed,
  toWorldPosition,
  visibleRows,
} from "@/games/alttpr/utils";

describe("toWorldPosition", () => {
  it("spreads a Light World marker across its own square", () => {
    expect(toWorldPosition("0%", "0%")).toEqual({ world: "light", x: 0, y: 0 });
    expect(toWorldPosition("25%", "50%")).toEqual({
      world: "light",
      x: 50,
      y: 50,
    });
  });

  it("counts the midpoint as Light World", () => {
    expect(toWorldPosition("50%", "10%")).toEqual({
      world: "light",
      x: 100,
      y: 10,
    });
  });

  it("moves a marker past the midpoint into the Dark World", () => {
    const eastern = toWorldPosition("97%", "40%");

    expect(eastern.world).toBe("dark");
    expect(eastern.x).toBeCloseTo(94);
    expect(eastern.y).toBe(40);
  });

  it("keeps every marker inside its world", () => {
    const samples = ["0%", "12.5%", "49.9%", "50%", "50.1%", "87.3%", "100%"];

    for (const x of samples) {
      for (const y of samples) {
        const position = toWorldPosition(x, y);
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(100);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("visibleRows", () => {
  it("keeps every row while the key cells are shown", () => {
    expect(visibleRows(defaultItemGrid, true)).toBe(defaultItemGrid);
  });

  it("drops a row of nothing but key cells, labels and gaps while they are hidden", () => {
    const rows = visibleRows(defaultItemGrid, false);

    // The two rows of key cells under the dungeons' rows
    expect(rows).toHaveLength(defaultItemGrid.length - 2);
    expect(rows.flat()).not.toContain("keys3");
    expect(rows.flat()).not.toContain("keys0");
    expect(rows.flat()).not.toContain("keylabel10");
    // A key cell sharing its row with other cells keeps its place
    expect(visibleRows([["keys0", "boss0"]], false)).toEqual([
      ["keys0", "boss0"],
    ]);
    // Ganon's Tower's boss cell stays, with the Light World's dungeons
    expect(rows[5]).toContain("boss12");
  });
});

describe("the half magic cell", () => {
  it("draws one picture, dimmed until held, a quarter magic as the half", () => {
    for (const value of [0, 1, 2]) {
      expect(getItemBackground("magic", value)).toBe("url(/assets/magic.png)");
    }
    expect(isItemDimmed("magic", 0)).toBe(true);
    expect(isItemDimmed("magic", 1)).toBe(false);
    expect(isItemDimmed("magic", 2)).toBe(false);
  });
});

describe("a boss cell", () => {
  it("draws its one portrait whether beaten or not", () => {
    expect(getItemBackground("boss3", 1)).toBe("url(/assets/boss32.png)");
    expect(getItemBackground("boss3", 2)).toBe(getItemBackground("boss3", 1));
  });

  it("is dimmed until its boss is beaten", () => {
    expect(isItemDimmed("boss3", 1)).toBe(true);
    expect(isItemDimmed("boss3", 2)).toBe(false);
  });
});

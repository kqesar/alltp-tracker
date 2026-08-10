import { describe, expect, it } from "vitest";
import { transformMapCoordinates } from "@/utils";

describe("transformMapCoordinates", () => {
  it("leaves coordinates untouched side by side", () => {
    expect(transformMapCoordinates("46.8%", "38.8%", "side-by-side")).toEqual({
      x: "46.8%",
      y: "38.8%",
    });
  });

  describe("stacked", () => {
    const stack = (x: string, y: string) =>
      transformMapCoordinates(x, y, "stacked");

    it("spreads a Light World marker across the top half", () => {
      // The left half of the asset becomes the full width of the top row.
      expect(stack("0%", "0%")).toEqual({ x: "0%", y: "0%" });
      expect(stack("25%", "50%")).toEqual({ x: "50%", y: "25%" });
      expect(stack("50%", "100%")).toEqual({ x: "100%", y: "50%" });
    });

    it("spreads a Dark World marker across the bottom half", () => {
      // Anything past the midpoint belongs to the Dark World and moves below.
      expect(stack("50.1%", "0%").y).toBe("50%");
      expect(stack("75%", "50%")).toEqual({ x: "50%", y: "75%" });
      expect(stack("100%", "100%")).toEqual({ x: "100%", y: "100%" });
    });

    it("keeps every marker inside the frame", () => {
      const samples = ["0%", "12.5%", "49.9%", "50%", "50.1%", "87.3%", "100%"];

      samples.forEach((x) => {
        samples.forEach((y) => {
          const { x: outX, y: outY } = stack(x, y);

          expect(Number.parseFloat(outX)).toBeGreaterThanOrEqual(0);
          expect(Number.parseFloat(outX)).toBeLessThanOrEqual(100);
          expect(Number.parseFloat(outY)).toBeGreaterThanOrEqual(0);
          expect(Number.parseFloat(outY)).toBeLessThanOrEqual(100);
        });
      });
    });

    it("never maps the two worlds onto the same spot", () => {
      // A Light and a Dark marker at mirrored positions must stay apart.
      expect(stack("20%", "40%")).not.toEqual(stack("70%", "40%"));
    });
  });
});

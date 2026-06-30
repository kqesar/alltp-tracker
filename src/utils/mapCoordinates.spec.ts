import { describe, expect, it } from "vitest";
import { transformMapCoordinates } from "@/utils";

describe("transformMapCoordinates", () => {
  it("returns coordinates unchanged in horizontal orientation", () => {
    expect(transformMapCoordinates("46.8%", "38.8%", false)).toEqual({
      x: "46.8%",
      y: "38.8%",
    });
  });

  it("maps the left half (light world) to the top when vertical", () => {
    // x <= 50%: x doubles, y halves
    expect(transformMapCoordinates("25%", "40%", true)).toEqual({
      x: "50%",
      y: "20%",
    });
  });

  it("maps the right half (dark world) to the bottom when vertical", () => {
    // x > 50%: shifted left then doubled, y halved then offset to bottom half
    expect(transformMapCoordinates("75%", "40%", true)).toEqual({
      x: "50%",
      y: "70%",
    });
  });
});

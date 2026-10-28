import { INVERTED_MARKERS, MARKERS, RUPEE_COSTS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { markerTitle, withCost, withRupees } from "@/games/alttpr/logic/costs";
import { findName } from "@/games/alttpr/logic/runLog";

const BOTH_WORLDS = [...INVERTED_MARKERS, ...MARKERS];

describe("withCost", () => {
  it("puts a paid check's price in parentheses after its name", () => {
    expect(withCost("Bottle Merchant", "bottle-merchant")).toBe(
      "Bottle Merchant (100 rupees)",
    );
    expect(withCost("King Zora", "king-zora")).toBe("King Zora (500 rupees)");
  });

  it("leaves a free check's name alone", () => {
    expect(withCost("Hobo", "hobo")).toBe("Hobo");
    expect(withRupees("Hobo", undefined)).toBe("Hobo");
  });

  it("is in the run log's name for a find", () => {
    expect(findName("check:digging-game")).toBe("Digging Game (80 rupees)");
    expect(findName("check:hobo")).toBe("Hobo");
  });
});

describe("markerTitle", () => {
  it("prices the marker of a paid check, in every world that has one", () => {
    const titles = new Map(
      BOTH_WORLDS.map((marker) => [marker.id, markerTitle(marker)]),
    );
    expect(titles.get("chest-game")).toBe("Chest Game (30 rupees)");
    expect(titles.get("blacksmith")).toBe("Blacksmith (10 rupees)");
    expect(titles.get("bomb-merchant")).toBe("Bomb Merchant (100 rupees)");
    expect(titles.get("hobo")).toBe("Hobo");
  });

  it("prices every paid check's marker and no other", () => {
    const priced = BOTH_WORLDS.filter(
      (marker) => markerTitle(marker) !== marker.name,
    ).map((marker) => marker.locations[0]);
    expect(new Set(priced)).toEqual(new Set(Object.keys(RUPEE_COSTS)));
  });
});

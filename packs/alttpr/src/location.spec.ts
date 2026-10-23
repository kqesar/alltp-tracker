import { describe, expect, it } from "vitest";
import { loadLocationIndex } from "../test/fixtures";
import { LOCATION_KINDS, locationId, locationKind } from "./location";

const index = loadLocationIndex();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

describe("locationId", () => {
  it("gives every upstream location of the three worlds its own id", () => {
    // A location Inverted moves is built again under the same name
    const names = [...new Set(index.locations.map((l) => l.name))];
    // 234 checks, the two medallion pads (app/Region/Standard) and
    // Inverted's Bomb Merchant
    expect(names).toHaveLength(237);
    const ids = names.map(locationId);
    for (const id of ids) expect(id).toMatch(SLUG);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("locationKind", () => {
  it("names a kind for every upstream location class", () => {
    const kinds = new Set(index.locations.map((l) => locationKind(l.kind)));
    // Every kind is used upstream, and no class is left out
    expect([...kinds].sort()).toEqual([...LOCATION_KINDS]);
    expect(locationKind("Prize\\Crystal")).toBe("prize");
    expect(locationKind("BigChest")).toBe("bigChest");
  });

  it("rejects a class it does not know", () => {
    expect(() => locationKind("Shop")).toThrow(
      /Unknown upstream location class "Shop"/,
    );
  });
});

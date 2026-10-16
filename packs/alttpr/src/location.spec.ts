import { describe, expect, it } from "vitest";
import { loadLocationIndex } from "../test/fixtures";
import { LOCATION_KINDS, locationId, locationKind } from "./location";

const index = loadLocationIndex();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

describe("locationId", () => {
  it.each([
    ["Tower of Hera - Big Key Chest", "tower-of-hera/big-key-chest"],
    ["King's Tomb", "kings-tomb"],
    ["Sewers - Secret Room - Left", "sewers/secret-room/left"],
    ["Hyrule Castle - Zelda's Cell", "hyrule-castle/zeldas-cell"],
    ["Thieves' Town - Blind's Cell", "thieves-town/blinds-cell"],
    ["  Odd -- Name! ", "odd-name"],
  ])("%s is %s", (name, id) => {
    expect(locationId(name)).toBe(id);
  });

  it("gives every upstream location of both worlds its own id", () => {
    const names = index.locations.map((l) => l.name);
    // 234 checks and the two medallion pads (app/Region/Standard)
    expect(names).toHaveLength(236);
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

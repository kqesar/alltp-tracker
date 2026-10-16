// The dungeon table against the region modules and the item pool.
import { describe, expect, it } from "vitest";
import {
  DUNGEON_IDS,
  DUNGEONS,
  dungeon,
  dungeonLocations,
  dungeonPool,
  dungeonRegions,
} from "./dungeons";
import { EVENT_LOCATIONS } from "./fill";
import { locationId } from "./location";
import { regionModules } from "./pack";
import { OPEN, STANDARD } from "./settings";

describe("the dungeons", () => {
  it("are the regions that keep dungeon items, each by the code they carry", () => {
    for (const settings of [OPEN, STANDARD]) {
      const keeping = regionModules(settings)
        .flatMap((m) => m.regions)
        .filter((r) =>
          r.regionItems?.items.some((item) => /^Key[A-Z]\d$/.test(item)),
        );
      expect(keeping.map((r) => r.id)).toEqual(DUNGEONS.map((d) => d.region));
      for (const d of DUNGEONS) {
        const region = keeping.find((r) => r.id === d.region);
        expect(region?.regionItems?.items, d.id).toContain(`Key${d.code}`);
        // Open's escape lists Standard's items as the class it extends
        if (settings.standardMode) {
          expect(region?.regionItems?.source, d.id).toBe(d.source);
        }
      }
    }
  });

  it("are named by the slug of their name, which their locations start with", () => {
    for (const d of DUNGEONS) {
      expect(d.id).toBe(locationId(d.name));
    }
    for (const id of ["tower-of-hera", "castle-tower", "ganons-tower"]) {
      const d = dungeon(id);
      for (const location of dungeonLocations(d, OPEN)) {
        expect(location.startsWith(`${id}/`), location).toBe(true);
      }
    }
    expect(DUNGEON_IDS).toHaveLength(13);
    expect(() => dungeon("hyrule-castle-tower")).toThrow(/No dungeon/);
  });

  it("give an event where their prize location holds one, else a prize", () => {
    for (const d of DUNGEONS) {
      const prize = dungeonRegions(d, STANDARD)[0]?.prize ?? "";
      expect(EVENT_LOCATIONS.includes(prize), d.id).toBe("event" in d);
    }
    expect(DUNGEONS.filter((d) => !("event" in d))).toHaveLength(10);
  });

  it("hold the pool's dungeon items", () => {
    expect(dungeonPool(dungeon("palace-of-darkness"))).toEqual({
      bigKey: 1,
      compass: 1,
      map: 1,
      smallKeys: 6,
    });
    // Eastern Palace has no small key, Hyrule Castle no big key nor compass,
    // Castle Tower its two keys only
    expect(dungeonPool(dungeon("eastern-palace")).smallKeys).toBe(0);
    expect(dungeonPool(dungeon("hyrule-castle"))).toEqual({
      bigKey: 0,
      compass: 0,
      map: 1,
      smallKeys: 1,
    });
    expect(dungeonPool(dungeon("castle-tower"))).toEqual({
      bigKey: 0,
      compass: 0,
      map: 0,
      smallKeys: 2,
    });
  });

  it("take the region module of their world, parts included", () => {
    const tr = dungeonRegions(dungeon("turtle-rock"), OPEN).map((r) => r.id);
    expect(tr).toEqual([
      "turtleRock",
      "turtleRockUpper",
      "turtleRockMiddle",
      "turtleRockLower",
    ]);
    // The escape differs between the worlds, its locations do not
    expect(dungeonLocations(dungeon("hyrule-castle"), OPEN)).toEqual(
      dungeonLocations(dungeon("hyrule-castle"), STANDARD),
    );
    expect(dungeonLocations(dungeon("eastern-palace"), OPEN)).not.toContain(
      "eastern-palace/prize",
    );
    expect(() =>
      dungeonRegions({ ...dungeon("eastern-palace"), region: "nowhere" }, OPEN),
    ).toThrow(/No region "nowhere"/);
  });
});

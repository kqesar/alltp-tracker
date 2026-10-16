// The dungeon table against the region modules and the item pool.
import type { Tri } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DUNGEON_IDS,
  DUNGEONS,
  dungeon,
  dungeonItemCount,
  dungeonLocations,
  dungeonPool,
  dungeonRegions,
  dungeonStatus,
} from "./dungeons";
import { EVENT_LOCATIONS } from "./fill";
import { LEGACY_DUNGEON_ITEMS, LEGACY_DUNGEONS } from "./legacy";
import { locationId } from "./location";
import { regionModules } from "./pack";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";

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

  it("start their counter from their items, per mode of dungeon items", () => {
    const modes = ["standard", "mc", "mcs", "full"] as const;
    const counts = Object.fromEntries(
      DUNGEONS.map((d) => [
        d.id,
        modes.map((dungeonItems) =>
          dungeonItemCount(d, settingsFromUpstream("open", { dungeonItems })),
        ),
      ]),
    );
    // Locations less what stays: small keys (but mcs, full), big key (but
    // full), map and compass (but mc, mcs, full); config/item.php:94-147
    expect(counts).toEqual({
      "castle-tower": [0, 0, 2, 2],
      "desert-palace": [2, 4, 5, 6],
      "eastern-palace": [3, 5, 5, 6],
      "ganons-tower": [20, 22, 26, 27],
      "hyrule-castle": [8, 9, 10, 10],
      "ice-palace": [3, 5, 7, 8],
      "misery-mire": [2, 4, 7, 8],
      "palace-of-darkness": [5, 7, 13, 14],
      "skull-woods": [2, 4, 7, 8],
      "swamp-palace": [6, 8, 9, 10],
      "thieves-town": [4, 6, 7, 8],
      "tower-of-hera": [2, 4, 5, 6],
      "turtle-rock": [5, 7, 11, 12],
    });
    // The legacy counters were the standard counts of its ten dungeons
    expect(
      LEGACY_DUNGEONS.map((id) => dungeonItemCount(dungeon(id), OPEN)),
    ).toEqual([...LEGACY_DUNGEON_ITEMS]);
    expect(dungeonItemCount(dungeon("hyrule-castle"), STANDARD)).toBe(8);
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

const tris = (yes: number, maybe: number, no: number): Tri[] => [
  ...Array<Tri>(yes).fill("yes"),
  ...Array<Tri>(maybe).fill("maybe"),
  ...Array<Tri>(no).fill("no"),
];

describe("dungeonStatus", () => {
  it.each([
    // The counter-example to "reachable at least the items left": the two
    // yes locations may be the two the player opened
    [2, tris(2, 0, 2), "possible"],
    [3, tris(2, 0, 2), "available"],
    // Pigeonholes: more items left than maybe and no locations
    [3, tris(1, 1, 1), "available"],
    [2, tris(1, 1, 1), "possible"],
    [1, tris(0, 1, 2), "possible"],
    [1, tris(0, 0, 3), "unavailable"],
    [6, tris(6, 0, 0), "available"],
    [1, tris(1, 0, 5), "possible"],
    // Done: the app shows it as such
    [0, tris(3, 0, 0), "unavailable"],
  ] as [number, Tri[], string][])(
    "%i left at %j: %s",
    (remaining, at, status) => {
      expect(dungeonStatus(remaining, at)).toBe(status);
    },
  );

  it("is available exactly when every way the items can sit leaves one at a yes", () => {
    /** Every set of `k` distinct indices below `n`. */
    function* choose(n: number, k: number, from = 0): Generator<number[]> {
      if (k === 0) {
        yield [];
        return;
      }
      for (let i = from; i <= n - k; i++) {
        for (const rest of choose(n, k - 1, i + 1)) yield [i, ...rest];
      }
    }
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Tri>("yes", "maybe", "no"), {
          maxLength: 9,
          minLength: 1,
        }),
        fc.nat(9),
        (at, r) => {
          const remaining = Math.min(r, at.length);
          const ways = [...choose(at.length, remaining)];
          const status = dungeonStatus(remaining, at);
          const surely =
            remaining > 0 &&
            ways.every((way) => way.some((i) => at[i] === "yes"));
          const perhaps =
            remaining > 0 &&
            ways.some((way) => way.some((i) => at[i] !== "no"));
          return (
            (status === "available") === surely &&
            (status === "unavailable") === !perhaps
          );
        },
      ),
      { numRuns: 400, seed: 11 },
    );
  });
});

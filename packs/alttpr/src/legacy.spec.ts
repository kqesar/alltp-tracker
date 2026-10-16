// The legacy tables: every row there, every target in the pack, no location
// claimed twice, every location of the pack accounted for.
import { describe, expect, it } from "vitest";
import { DUNGEON_IDS, dungeon, dungeonRegions } from "./dungeons";
import { ITEM_IDS } from "./items";
import {
  fromLegacy,
  LEGACY_CHESTS,
  LEGACY_DUNGEON_ITEMS,
  LEGACY_DUNGEONS,
  LEGACY_ITEM_RANGES,
  type LegacyEffect,
  type LegacyProgress,
  legacyItem,
  NOT_ON_THE_OLD_MAP,
} from "./legacy";
import { regionModules } from "./pack";
import { OPEN, STANDARD } from "./settings";
import { INVENTORY_ITEM_IDS, toState } from "./tracker";

/** Every location of a world. */
const locationsOf = (settings: typeof OPEN) =>
  regionModules(settings).flatMap((m) =>
    m.regions.flatMap((r) => r.locations.map((l) => l.id)),
  );

describe("LEGACY_CHESTS", () => {
  it("has the 64 legacy markers, each named", () => {
    expect(LEGACY_CHESTS).toHaveLength(64);
    const names = LEGACY_CHESTS.map((c) => c.name);
    expect(new Set(names).size).toBe(64);
    expect(names[0]).toBe("King's Tomb");
    expect(names[14]).toBe("Kakariko Well (4 + bomb)");
    expect(names[63]).toBe("Bridge");
  });

  it("stands for locations the pack has, one marker each", () => {
    for (const settings of [OPEN, STANDARD]) {
      const known = new Set(locationsOf(settings));
      const claimed = LEGACY_CHESTS.flatMap((c) => c.locations);
      for (const id of claimed) expect(known.has(id), id).toBe(true);
      expect(claimed.length).toBe(new Set(claimed).size);
    }
  });

  it("maps one marker to one location, or a cave to all of its chests", () => {
    expect(LEGACY_CHESTS[0]?.locations).toEqual(["kings-tomb"]);
    expect(LEGACY_CHESTS[14]?.locations).toHaveLength(5);
    expect(LEGACY_CHESTS[29]).toEqual({
      locations: ["hobo"],
      name: "Fugitive under the bridge",
    });
    // Only the castle's own bridge stands for nothing
    expect(
      LEGACY_CHESTS.filter((c) => c.locations.length === 0).map((c) => c.name),
    ).toEqual(["Bridge"]);
  });

  it("leaves no location of the pack unaccounted for", () => {
    for (const settings of [OPEN, STANDARD]) {
      const inLegacyDungeon = new Set(
        LEGACY_DUNGEONS.flatMap((d) =>
          dungeonRegions(dungeon(d), settings).flatMap((r) =>
            r.locations.map((l) => l.id),
          ),
        ),
      );
      const onMarker = new Set(LEGACY_CHESTS.flatMap((c) => c.locations));
      const lost = locationsOf(settings).filter(
        (id) =>
          !inLegacyDungeon.has(id) &&
          !onMarker.has(id) &&
          !NOT_ON_THE_OLD_MAP.has(id),
      );
      expect(lost).toEqual([]);
      // And the list names no location a marker or a dungeon covers
      for (const id of NOT_ON_THE_OLD_MAP.keys()) {
        expect(locationsOf(settings), id).toContain(id);
        expect(onMarker.has(id) || inLegacyDungeon.has(id), id).toBe(false);
      }
    }
    expect([...NOT_ON_THE_OLD_MAP.keys()]).toContain("waterfall-fairy/left");
  });
});

describe("LEGACY_DUNGEONS", () => {
  it("names the ten legacy dungeons by index", () => {
    expect(LEGACY_DUNGEONS).toHaveLength(10);
    for (const d of LEGACY_DUNGEONS) expect(DUNGEON_IDS).toContain(d);
    expect(new Set(LEGACY_DUNGEONS).size).toBe(10);
    expect(LEGACY_DUNGEONS[3]).toBe("palace-of-darkness");
  });
});

describe("legacyItem", () => {
  it("maps every legacy id at every value to the pack's items and dungeons", () => {
    expect(Object.keys(LEGACY_ITEM_RANGES)).toHaveLength(22 + 8 + 40);
    const items = new Set<string>(INVENTORY_ITEM_IDS);
    for (const [id, [min, max]] of Object.entries(LEGACY_ITEM_RANGES)) {
      for (let v = min; v <= max; v++) {
        for (const effect of legacyItem(id, v)) {
          if (effect.kind === "item") {
            expect(items.has(effect.item), `${id}=${v}`).toBe(true);
            expect(ITEM_IDS).toContain(effect.item);
          } else {
            expect(DUNGEON_IDS, `${id}=${v}`).toContain(effect.dungeon);
          }
        }
      }
    }
  });

  it.each([
    ["hookshot", true, [{ count: 1, item: "hookshot", kind: "item" }]],
    ["hookshot", false, []],
    ["lantern", true, [{ count: 1, item: "lamp", kind: "item" }]],
    ["flute", true, [{ count: 1, item: "flute", kind: "item" }]],
    ["blank", true, []],
    ["sword", 3, [{ count: 3, item: "sword", kind: "item" }]],
    ["bottle", 2, [{ count: 2, item: "bottle", kind: "item" }]],
    ["tunic", 1, []],
    ["tunic", 3, [{ count: 2, item: "armor", kind: "item" }]],
    ["bow", 1, [{ count: 1, item: "silverArrowUpgrade", kind: "item" }]],
    ["bow", 2, [{ count: 1, item: "bow", kind: "item" }]],
    [
      "bow",
      3,
      [
        { count: 1, item: "bow", kind: "item" },
        { count: 1, item: "silverArrowUpgrade", kind: "item" },
      ],
    ],
    ["boomerang", 1, [{ count: 1, item: "boomerang", kind: "item" }]],
    ["boomerang", 2, [{ count: 1, item: "redBoomerang", kind: "item" }]],
    [
      "boomerang",
      3,
      [
        { count: 1, item: "boomerang", kind: "item" },
        { count: 1, item: "redBoomerang", kind: "item" },
      ],
    ],
    ["agahnim", 1, [{ dungeon: "castle-tower", kind: "beaten" }]],
    ["agahnim", 0, []],
    ["boss3", 2, [{ dungeon: "palace-of-darkness", kind: "beaten" }]],
    ["boss3", 1, []],
    ["bigkey9", 1, [{ count: 1, item: "bigKeyD7", kind: "item" }]],
    ["chest3", 5, []],
    ["chest3", 1, [{ count: 4, dungeon: "palace-of-darkness", kind: "found" }]],
    ["reward0", 0, []],
    [
      "reward0",
      1,
      [{ dungeon: "eastern-palace", kind: "prize", prize: "greenPendant" }],
    ],
    [
      "reward1",
      2,
      [{ dungeon: "desert-palace", kind: "prize", prize: "pendant" }],
    ],
    [
      "reward7",
      3,
      [{ dungeon: "ice-palace", kind: "prize", prize: "crystal" }],
    ],
    [
      "reward8",
      4,
      [{ dungeon: "misery-mire", kind: "prize", prize: "redCrystal" }],
    ],
  ] as [string, number | boolean, LegacyEffect[]][])(
    "%s = %s records %j",
    (id, value, effects) => {
      expect(legacyItem(id, value)).toEqual(effects);
    },
  );

  it("refuses an id or a value the legacy format does not have", () => {
    expect(() => legacyItem("toString", 0)).toThrow(/No legacy item/);
    expect(() => legacyItem("silvers", 1)).toThrow(/No legacy item/);
    expect(() => legacyItem("sword", 5)).toThrow(/cannot be 5/);
    expect(() => legacyItem("tunic", 0)).toThrow(RangeError);
    expect(() => legacyItem("glove", 1.5)).toThrow(RangeError);
    expect(() => legacyItem("chest4", 7)).toThrow(RangeError);
  });

  it("counts down each legacy counter from the dungeon's items", () => {
    expect(LEGACY_DUNGEON_ITEMS).toEqual([3, 2, 2, 5, 6, 2, 4, 3, 2, 5]);
  });
});

describe("fromLegacy", () => {
  const fresh: LegacyProgress = {
    chestsOpened: Array(64).fill(false),
    items: { boss0: 1, chest0: 3, tunic: 1 },
    medallions: Array(10).fill(0),
    smallKeys: Array(10).fill(0),
  };

  it("reads a legacy run in the pack's terms", () => {
    const run = fromLegacy({
      chestsOpened: fresh.chestsOpened.map((_, i) => i === 0 || i === 14),
      items: {
        agahnim: 1,
        boss3: 2,
        bow: 3,
        chest3: 2,
        hookshot: true,
        reward3: 4,
        tunic: 2,
      },
      medallions: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
      smallKeys: [1, 0, 0, 4, 0, 0, 0, 0, 0, 0],
    });
    expect(run.checked).toEqual([
      "kings-tomb",
      ...(LEGACY_CHESTS[14]?.locations ?? []),
    ]);
    expect(run.found).toEqual({ "palace-of-darkness": 3 });
    expect(run.input).toEqual({
      beaten: {
        "castle-tower": true,
        "hyrule-castle": true,
        "palace-of-darkness": true,
      },
      items: { armor: 1, bow: 1, hookshot: 1, silverArrowUpgrade: 1 },
      keys: Object.fromEntries(
        LEGACY_DUNGEONS.map((d, i) => [d, [1, 0, 0, 4][i] ?? 0]),
      ),
      medallions: { mire: "ether", turtleRock: "unknown" },
      prizes: { "palace-of-darkness": "redCrystal" },
    });
  });

  it("gives a state the rules read, the escape done in Standard", () => {
    const state = toState(fromLegacy(fresh).input, STANDARD);
    expect(state.rescueZelda).toBe(1);
    expect(fromLegacy(fresh).checked).toEqual([]);
  });

  it("refuses a pad value the legacy format does not have", () => {
    expect(() =>
      fromLegacy({ ...fresh, medallions: [0, 0, 0, 0, 0, 0, 0, 0, 7, 0] }),
    ).toThrow(/medallion 8 cannot be 7/);
  });
});

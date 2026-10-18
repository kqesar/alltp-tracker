import {
  fromLegacy,
  LEGACY_DUNGEON_ITEMS,
  LEGACY_DUNGEONS,
  LEGACY_ITEM_RANGES,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { MEDALLION_VALUES } from "@/constants";
import { items, itemsMax, itemsMin } from "@/data/items";

/**
 * Items added since version 5, which no older save holds: Agahnim 2
 * (version 6), each dungeon's map and compass (version 7), the castle
 * dungeons' own items (version 11), Ganon's Tower's counter, the retro
 * world's shops (a save without them starts them unfound).
 */
const ADDED = [
  "agahnim2",
  ...Array.from({ length: 10 }, (_, index) => [
    `compass${index}`,
    `map${index}`,
  ]).flat(),
  "bigkey12",
  "chest12",
  "compass12",
  "map10",
  "map12",
  "shoparrow",
  "shopkey",
];

/**
 * A save keeps the tracker's item ids, and the pack keeps a frozen copy of
 * the version 5 tables (packs/alttpr/src/legacy.ts), which old saves are
 * migrated through. Each test holds the app's table to it: if they drift
 * apart, an old save reads as other items. (A live run is read through the
 * app's own table, logic/packItems.ts, which its spec holds to the same
 * copy; the chest and dungeon tables it also froze were held to it until
 * the map moved to the pack's markers.)
 */
describe("the app's tables, against the pack's legacy copy", () => {
  it("track the same items, each with the same range", () => {
    const ranges = Object.fromEntries(
      Object.entries(items)
        .filter(([id]) => !ADDED.includes(id))
        .map(([id, initial]) => [
          id,
          typeof initial === "boolean" ? [0, 1] : [itemsMin[id], itemsMax[id]],
        ]),
    );

    expect(ranges).toEqual(LEGACY_ITEM_RANGES);
    expect(ADDED.filter((id) => id in items)).toEqual(ADDED);
  });

  it("count each dungeon's chests down from the same number", () => {
    expect(LEGACY_DUNGEONS.map((_, index) => items[`chest${index}`])).toEqual([
      ...LEGACY_DUNGEON_ITEMS,
    ]);
  });

  it("note the medallion pads with the same values", () => {
    const pads = (mire: number, turtleRock: number) => {
      const medallions = Array(10).fill(MEDALLION_VALUES.UNKNOWN);
      medallions[8] = mire;
      medallions[9] = turtleRock;
      return fromLegacy({
        chestsOpened: [],
        items: {},
        medallions,
        smallKeys: [],
      }).input.medallions;
    };

    expect(pads(MEDALLION_VALUES.BOMBOS, MEDALLION_VALUES.ETHER)).toEqual({
      mire: "bombos",
      turtleRock: "ether",
    });
    expect(pads(MEDALLION_VALUES.QUAKE, MEDALLION_VALUES.UNKNOWN)).toEqual({
      mire: "quake",
      turtleRock: "unknown",
    });
  });
});

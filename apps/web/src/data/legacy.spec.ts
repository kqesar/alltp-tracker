import {
  fromLegacy,
  LEGACY_CHEST_POSITIONS,
  LEGACY_CHESTS,
  LEGACY_DUNGEON_ITEMS,
  LEGACY_DUNGEON_POSITIONS,
  LEGACY_DUNGEONS,
  LEGACY_ITEM_RANGES,
  dungeon as packDungeon,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { MEDALLION_VALUES } from "@/constants";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { items, itemsMax, itemsMin } from "@/data/items";
import { captionToText, placeName } from "@/utils/caption";

/**
 * The save format the pack migrates from is a frozen copy of these tables
 * (packs/alttpr/src/legacy.ts). Each test holds the app's table to it: if
 * they drift apart, a save migrated through the pack lands on the wrong
 * items, chests or dungeons.
 */
describe("the app's tables, against the pack's legacy copy", () => {
  it("track the same items, each with the same range", () => {
    const ranges = Object.fromEntries(
      Object.entries(items).map(([id, initial]) => [
        id,
        typeof initial === "boolean" ? [0, 1] : [itemsMin[id], itemsMax[id]],
      ]),
    );

    expect(ranges).toEqual(LEGACY_ITEM_RANGES);
  });

  it("count each dungeon's chests down from the same number", () => {
    expect(LEGACY_DUNGEONS.map((_, index) => items[`chest${index}`])).toEqual([
      ...LEGACY_DUNGEON_ITEMS,
    ]);
  });

  it("list the same 64 chest markers, in the same order", () => {
    expect(chests).toHaveLength(LEGACY_CHESTS.length);
    expect(chests.map(({ x, y }) => [parseFloat(x), parseFloat(y)])).toEqual(
      LEGACY_CHEST_POSITIONS,
    );
    // The pack's names drop the captions' icons and asides; each still
    // starts with a word of the caption it stands for
    const strays = chests.flatMap(({ name }, index) => {
      const legacy = LEGACY_CHESTS[index]?.name ?? "";
      const first = legacy.split(" ")[0] ?? "";
      return captionToText(name).includes(first) ? [] : [`${index}: ${legacy}`];
    });
    expect(strays).toEqual([]);
  });

  it("list the same 10 dungeons, by index", () => {
    expect(dungeons.map(({ name }) => placeName(name))).toEqual(
      LEGACY_DUNGEONS.map((id) => packDungeon(id).name),
    );
    expect(dungeons.map(({ x, y }) => [parseFloat(x), parseFloat(y)])).toEqual(
      LEGACY_DUNGEON_POSITIONS,
    );
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

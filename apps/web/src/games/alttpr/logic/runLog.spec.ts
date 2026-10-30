import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import type { BossNaming } from "@/games/alttpr/logic/knownBosses";
import {
  findIcon,
  findName,
  findsOf,
  splitsOf,
} from "@/games/alttpr/logic/runLog";
import type { Timeline } from "@/games/alttpr/logic/timeline";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const at = (seconds: number, timed = true) => ({
  at: T0 + seconds * 1000,
  ms: timed ? seconds * 1000 : null,
});

const open = getPreset("open").settings;
/** A run whose bosses stay home, or may move; `knownboss*` cells as told. */
const runOf = (
  bossShuffle: "none" | "full",
  items: Record<string, number> = {},
): BossNaming => ({ items, settings: { ...open, bossShuffle } });

describe("findName", () => {
  it.each([
    ["item:hookshot", "Hookshot"],
    ["item:moonpearl", "Moon Pearl"],
    ["item:sword:2", "Master Sword"],
    ["item:glove:2", "Titan's Mitt"],
    ["item:magic:1", "Half Magic"],
    ["item:magic:2", "Quarter Magic"],
    ["item:tunic:3", "Red Mail"],
    ["item:bottle:2", "Second Bottle"],
    ["item:bow:1", "Silver Arrows"],
    ["item:bow:2", "Bow"],
    ["item:boomerang:2", "Red Boomerang"],
    ["item:agahnim:1", "Agahnim beaten"],
    ["item:agahnim2:1", "Agahnim 2 beaten"],
    ["item:bigkey0:1", "Eastern Palace Big Key"],
    ["item:map10:1", "Hyrule Castle Map"],
    ["item:compass12:1", "Ganon's Tower Compass"],
    ["check:kings-tomb", "King's Tomb"],
    ["check:eastern-palace/big-key-chest", "Eastern Palace - Big Key Chest"],
  ])("names %s %s", (key, name) => {
    expect(findName(key)).toBe(name);
  });

  describe("a boss beaten", () => {
    const THIEVES_TOWN = "item:boss6:2";

    it("is the dungeon's own boss while the bosses stay home", () => {
      expect(findName("item:boss0:2", runOf("none"))).toBe(
        "Armos Knights beaten",
      );
      expect(findName(THIEVES_TOWN, runOf("none"))).toBe(
        "Blind the Thief beaten",
      );
      // Not even a stale known-boss cell renames it
      expect(findName(THIEVES_TOWN, runOf("none", { knownboss6: 1 }))).toBe(
        "Blind the Thief beaten",
      );
    });

    it("is the boss the shuffled run knows", () => {
      // knownboss6 = 1 is Armos Knights, as autotracking told it
      expect(findName(THIEVES_TOWN, runOf("full", { knownboss6: 1 }))).toBe(
        "Armos Knights beaten",
      );
    });

    it("is neutral while the shuffled run does not know it", () => {
      expect(findName(THIEVES_TOWN, runOf("full"))).toBe(
        "Thieves' Town boss beaten",
      );
      expect(findName("item:boss1:2", runOf("full", { knownboss1: 0 }))).toBe(
        "Desert Palace boss beaten",
      );
      expect(
        findName(THIEVES_TOWN, {
          items: {},
          settings: { ...open, hidden: ["bossShuffle"] },
        }),
      ).toBe("Thieves' Town boss beaten");
    });

    it("never names the vanilla boss of a boss it cannot know", () => {
      expect(findName(THIEVES_TOWN)).toBe("Thieves' Town boss beaten");
    });

    it("keeps Kholdstare in a swordless Ice Palace and the Agahnims", () => {
      expect(
        findName("item:boss7:2", {
          items: {},
          settings: { ...open, bossShuffle: "full", swordless: true },
        }),
      ).toBe("Kholdstare beaten");
      expect(findName("item:agahnim:1", runOf("full"))).toBe("Agahnim beaten");
    });
  });
});

describe("findIcon", () => {
  it.each([
    ["item:hookshot", "hookshot.png"],
    ["item:sword:2", "sword2.png"],
    ["item:bow:1", "bow1.png"],
    ["item:boss3:2", "boss32.png"],
    ["item:agahnim2:1", "agahnim1.png"],
    ["item:bigkey4:1", "bigkey.png"],
    ["item:map10:1", "dungeonmap.png"],
    ["item:magic:1", "magic.png"],
    ["item:magic:2", "magic.png"],
  ])("draws %s as %s", (key, icon) => {
    expect(findIcon(key)).toBe(icon);
  });

  it("draws no location", () => {
    expect(findIcon("check:kings-tomb")).toBeNull();
  });
});

describe("findsOf", () => {
  it("lists the newest first, finds of one instant by key", () => {
    const timeline: Timeline = {
      "check:kings-tomb": at(90),
      "item:boots": at(30),
      "item:hammer": at(90),
      "item:hookshot": at(5, false),
    };
    expect(findsOf(timeline).map(({ key }) => key)).toEqual([
      "check:kings-tomb",
      "item:hammer",
      "item:boots",
      "item:hookshot",
    ]);
  });

  it("lists the items alone in Race Mode, so no place is tied to an item", () => {
    const timeline: Timeline = {
      "check:kings-tomb": at(90),
      "item:boss0:2": at(60),
      "item:hammer": at(90),
    };
    expect(findsOf(timeline, true).map(({ key }) => key)).toEqual([
      "item:hammer",
      "item:boss0:2",
    ]);
  });
});

describe("splitsOf", () => {
  it("lists the bosses in the order they fell, each with its segment", () => {
    const timeline: Timeline = {
      "item:agahnim:1": at(1500),
      "item:boss0:2": at(600),
      "item:boss2:2": at(1100),
      "item:hammer": at(700),
    };
    expect(splitsOf(timeline)).toEqual([
      {
        key: "item:boss0:2",
        ms: 600_000,
        name: "Eastern Palace",
        segment: 600_000,
      },
      {
        key: "item:boss2:2",
        ms: 1_100_000,
        name: "Tower of Hera",
        segment: 500_000,
      },
      {
        key: "item:agahnim:1",
        ms: 1_500_000,
        name: "Castle Tower",
        segment: 400_000,
      },
    ]);
  });

  it("has no segment where a time is unknown", () => {
    const splits = splitsOf({
      "item:agahnim2:1": at(3000),
      "item:boss1:2": at(100, false),
      "item:boss5:2": at(2000),
    });
    expect(splits.map(({ name, segment }) => [name, segment])).toEqual([
      ["Desert Palace", null],
      ["Skull Woods", null],
      ["Ganon's Tower", 1_000_000],
    ]);
  });
});

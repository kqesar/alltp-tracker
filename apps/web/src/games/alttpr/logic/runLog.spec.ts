import { describe, expect, it } from "vitest";
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
    ["item:boss0:2", "Armos Knights beaten"],
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
});

describe("findIcon", () => {
  it.each([
    ["item:hookshot", "hookshot.png"],
    ["item:sword:2", "sword2.png"],
    ["item:bow:1", "bow1.png"],
    ["item:boss3:2", "boss32.png"],
    ["item:agahnim2:1", "agahnim1.png"],
    ["item:bigkey4:1", "bigkey.png"],
    ["item:map10:1", "map.png"],
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

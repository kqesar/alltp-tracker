// The Mixed overworld's seed (test/owr-mixed-spoilers/, recorded by
// scripts/record-dr-spoilers.mjs owr-mixed), held as what the world will
// read once it models Mixed's flips: its flipped screens are `Maps` swaps'
// `data` (world.owswaps[0], OverworldShuffle.py:159, set_map at :179), read as a
// list, never from the text map beside it.

import { describe, expect, it } from "vitest";
import { OWR_DATA } from "../src/door-world/owr-data";
import { readFixture } from "./dr-playthrough";

const NAME = "avianart-mPEeiQvu1.json";

describe("the Overworld Randomizer's Mixed seed", () => {
  it("is Open, its edges not crossed, its screens flipped by Mixed alone", () => {
    const json = JSON.parse(readFixture("owr-mixed-spoilers", NAME)) as {
      meta: Readonly<Record<string, unknown>>;
      Maps: readonly { type: string; data: readonly number[] }[];
      Overworld: readonly unknown[];
    };
    expect([json.meta.mode, json.meta.ow_mixed, json.meta.ow_crossed]).toEqual([
      "open",
      true,
      "none",
    ]);
    const swaps = json.Maps.find((map) => map.type === "swaps")?.data ?? [];
    // Each light world screen flips with its dark twin (+0x40), the
    // pedestal's and Zora's screens (0x80, 0x81) alone
    const light = swaps.filter((id) => id < 0x40);
    expect(swaps.filter((id) => id >= 0x40 && id < 0x80).sort()).toEqual(
      light.map((id) => id + 0x40).sort(),
    );
    expect(swaps.filter((id) => id >= 0x80)).toEqual([0x80]);
    // Every flipped screen is one of the fork's, with edges of its own
    const screens = new Set(OWR_DATA.overworld?.edges.map((e) => e.screen));
    expect(swaps.filter((id) => !screens.has(id))).toEqual([]);
    // The edges it moved are listed (connect_two_way's spoiler, :721-722)
    expect(json.Overworld).toHaveLength(141);
  });
});

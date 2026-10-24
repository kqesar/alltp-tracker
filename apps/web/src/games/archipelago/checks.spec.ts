import { describe, expect, it } from "vitest";
import {
  ALL_ZONE,
  checkZones,
  OTHER_ZONE,
  visibleZones,
} from "@/games/archipelago/checks";
import { alttpNames } from "@/games/archipelago/fixtures";

const names = alttpNames();
const id = (name: string) => names.locationIds.get(name) ?? -1;
const HOUSE = id("Link's House");
const SANC = id("Sanctuary");
const DAM = id("Floodgate Chest");
const PALACE = id("Eastern Palace - Big Chest");

describe("checkZones", () => {
  it("lays the slot's locations by group, the rest last", () => {
    const zones = checkZones([HOUSE], [SANC, PALACE, DAM], names, {
      "Eastern Palace": ["Eastern Palace - Big Chest", "Not ours"],
      Empty: ["Nowhere"],
      "Light World": ["Link's House", "Sanctuary"],
    });
    expect(zones).toEqual([
      {
        name: "Eastern Palace",
        rows: [
          { checked: false, id: PALACE, name: "Eastern Palace - Big Chest" },
        ],
      },
      {
        name: "Light World",
        rows: [
          { checked: true, id: HOUSE, name: "Link's House" },
          { checked: false, id: SANC, name: "Sanctuary" },
        ],
      },
      {
        name: OTHER_ZONE,
        rows: [{ checked: false, id: DAM, name: "Floodgate Chest" }],
      },
    ]);
  });

  it("is one zone without groups, and nothing without names", () => {
    expect(checkZones([HOUSE], [999_999_999], names, null)).toEqual([
      {
        name: ALL_ZONE,
        rows: [
          { checked: true, id: HOUSE, name: "Link's House" },
          { checked: false, id: 999_999_999, name: "Location 999999999" },
        ].sort((a, b) => a.id - b.id),
      },
    ]);
    expect(checkZones([HOUSE], [], null, null)).toEqual([]);
  });
});

describe("visibleZones", () => {
  const zones = checkZones([HOUSE], [SANC, PALACE], names, {
    "Eastern Palace": ["Eastern Palace - Big Chest"],
    "Light World": ["Link's House", "Sanctuary"],
  });

  it("filters by the row's and the zone's names, every word", () => {
    expect(visibleZones(zones, "light sanc", false)).toEqual([
      {
        name: "Light World",
        rows: [{ checked: false, id: SANC, name: "Sanctuary" }],
      },
    ]);
    expect(visibleZones(zones, "", false)).toEqual(zones);
  });

  it("hides the checked ones on request, and empty zones", () => {
    expect(
      visibleZones(zones, "", true).flatMap((z) => z.rows.map((r) => r.id)),
    ).toEqual([PALACE, SANC]);
    expect(visibleZones(zones, "house", true)).toEqual([]);
  });
});

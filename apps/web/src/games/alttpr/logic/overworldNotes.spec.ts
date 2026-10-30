import { whirlpoolsOf } from "@alltp/pack-alttpr/door-world";
import { OWR_DATA } from "@alltp/pack-alttpr/door-world/owr";
import { describe, expect, it } from "vitest";
import {
  OWR_DARK_WHIRLPOOLS,
  OWR_FLUTE_SCREENS,
  OWR_WHIRLPOOLS,
} from "@/games/alttpr/data/doorRando";
import {
  FLUTE_REGIONS,
  FLUTE_SCREENS,
  fluteScreenName,
  RENAMED_REGIONS,
} from "@/games/alttpr/data/owrScreens";
import { withOverworldNotes } from "@/games/alttpr/logic/overworldNotes";
import { isOverworldNotes } from "@/games/alttpr/stores/persistence";

describe("an OWR run's overworld notes", () => {
  it("pairs whirlpools both ways, forgetting what either led to", () => {
    const one = withOverworldNotes(
      {},
      { whirlpools: { "C Whirlpool": "Zora Whirlpool" } },
    );
    expect(one).toEqual({
      whirlpools: {
        "C Whirlpool": "Zora Whirlpool",
        "Zora Whirlpool": "C Whirlpool",
      },
    });
    // C into Lake Hylia: Zora's way back is forgotten
    expect(
      withOverworldNotes(one, {
        whirlpools: { "C Whirlpool": "Lake Hylia Whirlpool" },
      }),
    ).toEqual({
      whirlpools: {
        "C Whirlpool": "Lake Hylia Whirlpool",
        "Lake Hylia Whirlpool": "C Whirlpool",
      },
    });
    expect(
      withOverworldNotes(one, { whirlpools: { "Zora Whirlpool": null } }),
    ).toEqual({});
  });

  it("replaces the flute's spots, the same object when nothing moves", () => {
    const notes = withOverworldNotes({}, { flute: [0x30, 0x18, 0x30] });
    expect(notes).toEqual({ flute: [0x30, 0x18] });
    expect(withOverworldNotes(notes, { flute: [0x30, 0x18] })).toBe(notes);
    expect(withOverworldNotes(notes, { flute: [] })).toEqual({});
  });

  it("validates a save's notes by the fork's whirlpools and flute screens", () => {
    expect(
      isOverworldNotes({
        flute: [0x30],
        whirlpools: { "C Whirlpool": "Zora Whirlpool" },
      }),
    ).toBe(true);
    expect(isOverworldNotes({ flute: [0x31] })).toBe(false);
    expect(isOverworldNotes({ flute: Array(9).fill(0) })).toBe(false);
    expect(isOverworldNotes({ whirlpools: { "C Whirlpool": "Nowhere" } })).toBe(
      false,
    );
    expect(isOverworldNotes({ flips: {} })).toBe(false);
  });

  it("names the pack's whirlpools and flute screens", () => {
    expect([...OWR_WHIRLPOOLS].sort()).toEqual(
      [...whirlpoolsOf(OWR_DATA).keys()].sort(),
    );
    expect(OWR_FLUTE_SCREENS).toEqual(
      Object.keys(OWR_DATA.overworld?.flute ?? {})
        .map(Number)
        .sort((a, b) => a - b),
    );
  });

  it("holds the dark world's whirlpools to the pack's screens", () => {
    expect(
      [...whirlpoolsOf(OWR_DATA)]
        .filter(([, { screen }]) => screen >= 0x40)
        .map(([name]) => name)
        .sort(),
    ).toEqual([...OWR_DARK_WHIRLPOOLS].sort());
  });

  it("names each flute screen by the pack's regions, as it stands and flipped", () => {
    const flute = OWR_DATA.overworld?.flute ?? {};
    expect(FLUTE_SCREENS.map(([screen]) => screen)).toEqual(OWR_FLUTE_SCREENS);
    for (const [screen, stands, flipped] of FLUTE_SCREENS)
      expect([stands, flipped], String(screen)).toEqual(
        flute[String(screen)]?.regions.map((region) =>
          region.replace(/ Area$/, ""),
        ),
      );
  });

  it("gives each flute screen a player's name, one per screen in each world", () => {
    // A name for a region no screen names would be stale
    expect(RENAMED_REGIONS.filter((r) => !FLUTE_REGIONS.includes(r))).toEqual(
      [],
    );
    expect(fluteScreenName("Links House")).toBe("Link's House");
    expect(fluteScreenName("Dig Game")).toBe("Digging Game");
    expect(fluteScreenName("Death Mountain TR Pegs")).toBe("Turtle Rock Pegs");
    for (const side of [1, 2] as const) {
      const shown = FLUTE_SCREENS.map((entry) => fluteScreenName(entry[side]));
      expect(new Set(shown).size, String(side)).toBe(shown.length);
    }
  });
});

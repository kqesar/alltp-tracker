import { whirlpoolsOf } from "@alltp/pack-alttpr/door-world";
import { OWR_DATA } from "@alltp/pack-alttpr/door-world/owr";
import { describe, expect, it } from "vitest";
import {
  OWR_FLUTE_SCREENS,
  OWR_WHIRLPOOLS,
} from "@/games/alttpr/data/doorRando";
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
});

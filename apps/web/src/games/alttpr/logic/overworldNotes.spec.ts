import { OWR_FLIP_SCREENS } from "@alltp/pack-alttpr";
import {
  crossablePairsOf,
  forcedWhirlpoolsOf,
  owrScreensOf,
  whirlpoolsOf,
} from "@alltp/pack-alttpr/door-world";
import { OWR_DATA } from "@alltp/pack-alttpr/door-world/owr";
import { describe, expect, it } from "vitest";
import {
  flipGroupsOf,
  forcedWhirlpoolOf,
  OWR_CROSSINGS,
  OWR_DARK_WHIRLPOOLS,
  OWR_FLUTE_SCREENS,
  OWR_WHIRLPOOL_SCREENS,
  OWR_WHIRLPOOLS,
} from "@/games/alttpr/data/doorRando";
import {
  crossingNamesOf,
  EDGE_SCREENS,
  FLUTE_REGIONS,
  FLUTE_SCREENS,
  fluteScreenName,
  RENAMED_REGIONS,
  screenNameOf,
} from "@/games/alttpr/data/owrScreens";
import { getPreset } from "@/games/alttpr/data/presets";
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

  it("notes a crossed overworld's edge pairs one at a time, forgotten by null", () => {
    const notes = withOverworldNotes(
      {},
      { crossings: { "Lost Woods SC": false, "Lost Woods SW": true } },
    );
    expect(notes).toEqual({
      crossings: { "Lost Woods SC": false, "Lost Woods SW": true },
    });
    expect(
      withOverworldNotes(notes, { crossings: { "Lost Woods SW": true } }),
    ).toBe(notes);
    expect(
      withOverworldNotes(notes, {
        crossings: { "Lost Woods SC": null, "Lost Woods SW": null },
      }),
    ).toEqual({});
    expect(isOverworldNotes(notes)).toBe(true);
    expect(isOverworldNotes({ crossings: { "Lost Woods SW": 1 } })).toBe(false);
    // A pair's second edge, or its dark world twin, is no crossing's name
    expect(
      isOverworldNotes({ crossings: { "Lost Woods Pass NW": true } }),
    ).toBe(false);
    expect(isOverworldNotes({ crossings: { "Skull Woods SW": true } })).toBe(
      false,
    );
  });

  it("notes Mixed's flips by screen, in screen order, forgotten by null", () => {
    const notes = withOverworldNotes(
      {},
      { flips: { "0": true, "45": true, "128": true } },
    );
    expect(Object.keys(notes.flips ?? {})).toEqual(["0", "45", "128"]);
    expect(withOverworldNotes(notes, { flips: { "45": true } })).toBe(notes);
    expect(
      withOverworldNotes(notes, {
        flips: { "0": null, "45": null, "128": null },
      }),
    ).toEqual({});
    expect(isOverworldNotes(notes)).toBe(true);
  });

  it("names every screen Mixed may flip", () => {
    for (const screen of OWR_FLIP_SCREENS)
      expect(screenNameOf(screen)).not.toMatch(/^Screen /);
    expect(screenNameOf(0x00)).toBe("Lost Woods");
    expect(screenNameOf(0x2c)).toBe("Link's House");
    expect(screenNameOf(0x80)).toBe("Master Sword Meadow");
  });

  it("names each edge pair by its screens, held to the fork's edges", () => {
    // Each edge's area stands on the screen the pack's data gives it
    const edges = new Map(
      (OWR_DATA.overworld?.edges ?? []).map((e) => [e.name, e.screen]),
    );
    for (const edge of OWR_CROSSINGS.flat()) {
      const area = edge.slice(0, edge.lastIndexOf(" "));
      expect(EDGE_SCREENS[area], edge).toBe(edges.get(edge));
    }
    expect(Object.keys(EDGE_SCREENS).sort()).toEqual(
      [
        ...new Set(
          OWR_CROSSINGS.flat().map((e) => e.slice(0, e.lastIndexOf(" "))),
        ),
      ].sort(),
    );
    const names = crossingNamesOf(OWR_CROSSINGS);
    expect(names.size).toBe(67);
    // One name a pair, none the fork's codes
    const shown = [...names.values()].map((name) => name.shown);
    expect(new Set(shown).size).toBe(67);
    expect(new Set([...names.values()].map((n) => n.label)).size).toBe(67);
    for (const name of shown) expect(name).not.toMatch(/ [NESW][NESWC]\b/);
    expect(names.get("Kakariko Fortune ES")).toEqual({
      label: "Kakariko Fortune Teller to Kakariko Pond (south)",
      shown: "Kakariko Fortune Teller – Kakariko Pond (south)",
    });
    expect(names.get("Lost Woods SC")?.shown).toBe(
      "Lost Woods – Lost Woods Pass (east)",
    );
    expect(names.get("River Bend EC")?.shown).toBe(
      "River Bend – Potion Shop (middle)",
    );
    expect(names.get("Hyrule Castle ES")?.shown).toBe(
      "Hyrule Castle Courtyard – Sand Dunes",
    );
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
    expect(isOverworldNotes({ screens: {} })).toBe(false);
    // Mixed's flips: by the screens it may flip, flipped or standing
    expect(isOverworldNotes({ flips: { "44": true, "128": false } })).toBe(
      true,
    );
    expect(isOverworldNotes({ flips: { "1": true } })).toBe(false);
    expect(isOverworldNotes({ flips: { "44": "yes" } })).toBe(false);
  });

  it("names the pack's whirlpools and flute screens", () => {
    expect([...OWR_WHIRLPOOLS].sort()).toEqual(
      [...whirlpoolsOf(OWR_DATA).keys()].sort(),
    );
    expect(OWR_CROSSINGS).toEqual(crossablePairsOf(OWR_DATA));
    expect(OWR_FLUTE_SCREENS).toEqual(
      Object.keys(OWR_DATA.overworld?.flute ?? {})
        .map(Number)
        .sort((a, b) => a - b),
    );
  });

  it("holds the whirlpools' screens to the pack's", () => {
    expect(
      Object.fromEntries(
        [...whirlpoolsOf(OWR_DATA)].map(([name, { screen }]) => [name, screen]),
      ),
    ).toEqual(OWR_WHIRLPOOL_SCREENS);
  });

  it("pairs an uncrossed Mixed run's whirlpools as the pack's world does, once its flips tell", () => {
    for (const mode of ["open", "inverted"] as const) {
      const run = {
        ...getPreset("door-randomizer").settings,
        mode,
        owCrossed: "none",
        owMixed: true,
        owWhirlpool: true,
        randomizer: "owr",
      } as const;
      const groups = flipGroupsOf(run);
      // Every group standing, then each group flipped alone, then all
      const cases = [-1, ...groups.map((_, i) => i), groups.length].map(
        (flipped) =>
          Object.fromEntries(
            groups.flatMap((group, i) =>
              group.screens.map((screen) => [
                String(screen),
                flipped === groups.length || i === flipped,
              ]),
            ),
          ),
      );
      let paired = 0;
      for (const flips of cases) {
        const notes = { flips, whirlpools: {} };
        const pack = forcedWhirlpoolsOf(
          OWR_DATA,
          notes,
          owrScreensOf(OWR_DATA, mode, notes),
        );
        for (const name of OWR_WHIRLPOOLS) {
          expect(forcedWhirlpoolOf(name, run, flips), name).toBe(
            pack.get(name),
          );
          if (pack.has(name)) paired++;
        }
      }
      expect(paired).toBeGreaterThan(0);
      // Not noted: neither the pack nor the tab pairs any
      expect(forcedWhirlpoolOf("Qirn Jump Whirlpool", run, {})).toBeUndefined();
    }
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

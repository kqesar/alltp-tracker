import { describe, expect, it } from "vitest";
import {
  drEntranceName,
  drEntranceOf,
  drTargetOf,
  type OwrPoolSettings,
  type OwrShuffle,
  owrCombineMap,
  owrEntrancePool,
  owrShuffled,
  owrSwapPartners,
  vanillaEntrances,
} from "../door-rando/entrances";
import { notedConnections, vanillaConnections } from "./connections";
import { DR_DATA } from "./dr-data";
import type { DrNotedEntrances } from "./index";
import { type OwrPossibleLinks, owrScreensOf } from "./overworld";
import { OWR_DATA } from "./owr-data";

type Mode = "open" | "inverted";

const pool = (more: Partial<OwrPoolSettings> = {}) => ({
  dropShuffle: "none",
  enemyShuffle: false,
  mode: "open" as const,
  pottery: "none",
  shopsanity: false,
  shuffleLinks: false,
  shuffleTavern: false,
  ...more,
});

/**
 * Where an entrance leads in the fork's vanilla world: its tables, the
 * towers traded once both their screens flip (Inverted, EntranceShuffle2.
 * py:69-71).
 */
const vanillaTarget = (mode: Mode, name: string): string => {
  const maps = vanillaEntrances(false);
  if (mode === "inverted" && name === "Ganons Tower")
    return "Agahnims Tower Exit";
  if (mode === "inverted" && name === "Agahnims Tower")
    return "Ganons Tower Exit";
  return maps.twoWay.get(name) ?? maps.oneWay.get(name) ?? "";
};

/** Every entrance an OWR shuffle may move, noted where it stands. */
function vanillaNotes(mode: Mode): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const name of owrShuffled({
    bombShopStart: undefined,
    shuffleLinks: true,
    shuffleTavern: true,
  }))
    notes[drEntranceOf(name).id] = drTargetOf(vanillaTarget(mode, name)).id;
  return notes;
}

const noted = (
  shuffle: OwrShuffle,
  notes: Record<string, string>,
  more: Partial<OwrPoolSettings> = {},
): DrNotedEntrances => ({ noted: notes, pool: pool(more), shuffle });

describe("the Overworld Randomizer's world on its noted entrances", () => {
  it("places every entrance in District and Swapped, as its modes say", () => {
    // EntranceShuffle2.py:2566-2743: neither leaves an entrance to vanilla
    // connections (`undefined`), so owrShuffled moves the whole pool
    const modes = OWR_DATA.tableOf<{ undefined: string }>(
      "EntranceShuffle2",
      "modes",
    );
    expect(modes.district?.undefined).toBe("error");
    expect(modes.swapped?.undefined).toBe("swap");
    const all = new Set(vanillaEntrances(false).pool);
    expect(
      owrShuffled({
        bombShopStart: undefined,
        shuffleLinks: true,
        shuffleTavern: true,
      }),
    ).toEqual(all);
  });

  it("keeps the start house's door without shufflelinks, the Tavern's back without shuffletavern", () => {
    const kept = (more: Partial<OwrPoolSettings>) =>
      [...all].filter(
        (name) =>
          !owrShuffled({
            bombShopStart: false,
            shuffleLinks: true,
            shuffleTavern: true,
            ...more,
          }).has(name),
      );
    const all = vanillaEntrances(false).pool;
    expect(kept({})).toEqual([]);
    expect(kept({ shuffleTavern: false })).toEqual(["Tavern North"]);
    expect(kept({ shuffleLinks: false })).toEqual(["Links House"]);
    expect(kept({ bombShopStart: true, shuffleLinks: false })).toEqual([
      "Big Bomb Shop",
    ]);
    // Where Link starts is not known: neither stands
    expect(kept({ bombShopStart: undefined, shuffleLinks: false })).toEqual([]);
    // The app's pool offers the same, a hole a hole's drop
    const offered = owrEntrancePool("district", {
      bombShopStart: false,
      shuffleLinks: false,
      shuffleTavern: false,
    });
    expect(offered.entrances).toHaveLength(all.length - 2);
    const hole = drEntranceOf("Kakariko Well Drop").id;
    expect(offered.targetsOf.get(hole)?.map((t) => t.name)).toContain(
      "Lost Woods Hideout (top)",
    );
    expect(offered.targetsOf.get(hole)?.map((t) => t.name)).not.toContain(
      "Kakariko Well Exit",
    );
    expect(offered.partners("x", "y")).toEqual([]);
  });

  for (const mode of ["open", "inverted"] as const)
    for (const shuffle of ["district", "swapped"] as const)
      it(`builds the vanilla world from every entrance noted where it stands (${shuffle}, ${mode})`, () => {
        const found = notedConnections(
          OWR_DATA,
          mode,
          noted(shuffle, vanillaNotes(mode)),
        );
        expect(found.complete).toBe(true);
        expect(found.decoupled).toBe(false);
        expect(Object.fromEntries(found.connections)).toEqual(
          Object.fromEntries(vanillaConnections(OWR_DATA, mode)),
        );
      });

  it("links an entrance not noted nowhere, a noted one both ways", () => {
    const empty = notedConnections(OWR_DATA, "open", noted("swapped", {}));
    expect(empty.complete).toBe(false);
    const moved = owrShuffled({
      bombShopStart: false,
      shuffleLinks: false,
      shuffleTavern: false,
    });
    for (const name of moved)
      expect(empty.connections.has(name), name).toBe(false);
    // What the shuffle keeps stands
    expect(empty.connections.get("Links House")).toBe("Links House");
    expect(empty.connections.get("Tavern North")).toBe("Tavern");
    expect(empty.connections.get("Chris Houlihan Room Exit")).toBe(
      OWR_DATA.parentOf("Links House"),
    );
    // Swapped: Kakariko's shop into the Library, its way back out by it
    const one = notedConnections(
      OWR_DATA,
      "open",
      noted("swapped", {
        [drEntranceOf("Kakariko Shop").id]: drTargetOf("Library").id,
        [drEntranceOf("Bat Cave Cave").id]: drTargetOf(
          "Old Man House Exit (Bottom)",
        ).id,
      }),
    );
    expect(one.connections.get("Kakariko Shop")).toBe("Library");
    expect(one.connections.get("Bat Cave Cave")).toBe(
      OWR_DATA.parentOf("Old Man House Exit (Bottom)"),
    );
    expect(one.connections.get("Old Man House Exit (Bottom)")).toBe(
      OWR_DATA.parentOf("Bat Cave Cave"),
    );
  });

  it("leads the start's ways out where the door noted into the start house stands", () => {
    // Inverted: Link starts at the Big Bomb Shop and the Dark Chapel
    // (connect_entrance, :2105-2110), Chris Houlihan's room back to the
    // house's door (:164-167)
    const shop = drEntranceOf("Kakariko Shop");
    const fairy = drEntranceOf("Bonk Fairy (Light)");
    const found = notedConnections(
      OWR_DATA,
      "inverted",
      noted(
        "district",
        {
          [shop.id]: drTargetOf("Big Bomb Shop").id,
          [fairy.id]: drTargetOf("Dark Sanctuary Hint").id,
        },
        { shuffleLinks: true },
      ),
    );
    const at = OWR_DATA.parentOf("Kakariko Shop");
    expect(found.connections.get("Big Bomb Shop Exit")).toBe(at);
    expect(found.connections.get("Chris Houlihan Room Exit")).toBe(at);
    expect(found.connections.get("Dark Sanctuary Hint Exit")).toBe(
      OWR_DATA.parentOf("Bonk Fairy (Light)"),
    );
    // Open: the Bomb Shop's way out is no start's
    const open = notedConnections(
      OWR_DATA,
      "open",
      noted("district", { [shop.id]: drTargetOf("Big Bomb Shop").id }),
    );
    expect(open.connections.has("Big Bomb Shop Exit")).toBe(false);
    expect(open.connections.has("Dark Sanctuary Hint Exit")).toBe(false);
  });

  it("links what an unknown screen decides neither way, each way possible", () => {
    // Swapped with Mixed, nothing noted: the pyramid's screen and the Bomb
    // Shop's not known (District keeps the castle's with the sanctuary's,
    // define_tile_groups :1009-1011, which never flips), so both start
    // houses may move
    const overworld = { flips: {} };
    const screens = owrScreensOf(OWR_DATA, "open", overworld, {
      shuffle_swapped: true,
    });
    expect(screens.swapped(0x2c)).toBeUndefined();
    expect(screens.swapped(0x1b)).toBeUndefined();
    const possible: OwrPossibleLinks = [];
    const pyramid = drEntranceOf("Pyramid Entrance");
    const shop = drEntranceOf("Kakariko Shop");
    const found = notedConnections(
      OWR_DATA,
      "open",
      noted("swapped", {
        [pyramid.id]: drTargetOf("Library").id,
        [shop.id]: drTargetOf("Big Bomb Shop").id,
      }),
      157,
      undefined,
      overworld,
      screens,
      possible,
    );
    expect(found.connections.has("Links House")).toBe(false);
    expect(found.connections.has("Pyramid Entrance")).toBe(false);
    expect(possible).toEqual(
      expect.arrayContaining([
        ["Pyramid Entrance", "Library"],
        ["Pyramid Entrance", "Library", "Hyrule Castle Ledge"],
        ["Big Bomb Shop Exit", OWR_DATA.parentOf("Kakariko Shop")],
        ["Chris Houlihan Room Exit", OWR_DATA.parentOf("Kakariko Shop")],
      ]),
    );
    expect(found.connections.get("Kakariko Shop")).toBe("Big Bomb Shop");
    expect(
      [
        ...owrEntrancePool("district", {
          bombShopStart: undefined,
          shuffleLinks: false,
          shuffleTavern: true,
        }).entrances,
      ].map((e) => drEntranceName(e.id)),
    ).toEqual(expect.arrayContaining(["Links House", "Big Bomb Shop"]));
  });

  it("reads District with DR's data never, and no other mode of the fork", () => {
    expect(() =>
      notedConnections(DR_DATA, "open", noted("district", {})),
    ).toThrow(RangeError);
    expect(() =>
      notedConnections(OWR_DATA, "open", {
        ...noted("district", {}),
        shuffle: "crossed",
      }),
    ).toThrow(RangeError);
  });
});

describe("the Overworld Randomizer's Swapped pairs (connect_swap)", () => {
  const id = (name: string) => drEntranceOf(name).id;
  const to = (name: string) => drTargetOf(name).id;
  const moved = owrShuffled({
    bombShopStart: false,
    shuffleLinks: false,
    shuffleTavern: true,
  });
  // The towers' trade as given: an explicit undefined is "not known"
  const partners = (
    notes: Record<string, string>,
    ...traded: [boolean | undefined] | []
  ) => owrSwapPartners(notes, moved, traded.length === 0 ? false : traded[0]);

  it("reads the fork's combine_map, each target once", () => {
    // EntranceShuffle2.py:62-73: {**default_map, **one_way_map}
    const table = (name: string) =>
      OWR_DATA.tableOf<Record<string, string>>("EntranceShuffle2", name);
    const fork = {
      ...table("entrance_map"),
      ...table("drop_map"),
      ...table("single_entrance_map"),
    };
    expect(owrCombineMap(false)).toEqual(new Map(Object.entries(fork)));
    // is_atgt_swapped trades the towers' exits (:69-71)
    const traded = owrCombineMap(true);
    expect(traded.get("Ganons Tower")).toBe("Agahnims Tower Exit");
    expect(traded.get("Agahnims Tower")).toBe("Ganons Tower Exit");
    const unknown = owrCombineMap(undefined);
    expect(unknown.has("Ganons Tower")).toBe(false);
    expect(unknown.has("Agahnims Tower")).toBe(false);
    expect(unknown.size).toBe(traded.size - 2);
    // connect_swap's next() finds one entrance for each target
    for (const map of [owrCombineMap(false), traded])
      expect(new Set(map.values()).size).toBe(map.size);
  });

  it("tells the partner of a door, a hole or a shop noted to another's target", () => {
    expect(
      partners({ [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)") }),
    ).toEqual(
      new Map([
        [
          id("Bumper Cave (Bottom)"),
          { from: id("Bat Cave Cave"), target: to("Bat Cave Exit") },
        ],
      ]),
    );
    expect(
      partners({ [id("Bat Cave Drop")]: to("Kakariko Well (top)") }),
    ).toEqual(
      new Map([
        [
          id("Kakariko Well Drop"),
          { from: id("Bat Cave Drop"), target: to("Bat Cave (right)") },
        ],
      ]),
    );
    expect(partners({ [id("20 Rupee Cave")]: to("50 Rupee Cave") })).toEqual(
      new Map([
        [
          id("50 Rupee Cave"),
          { from: id("20 Rupee Cave"), target: to("20 Rupee Cave") },
        ],
      ]),
    );
  });

  it("tells nothing of a door left where it stands, a partner noted or kept, or notes that clash", () => {
    // Its own target: swapped with itself
    expect(partners({ [id("Bat Cave Cave")]: to("Bat Cave Exit") }).size).toBe(
      0,
    );
    // The partner noted: the note wins
    expect(
      partners({
        [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)"),
        [id("Bumper Cave (Bottom)")]: to("Library"),
      }).size,
    ).toBe(0);
    // Link's House stands without shufflelinks: no door trades with it
    expect(
      partners({ [id("Bat Cave Cave")]: to("Links House Exit") }).size,
    ).toBe(0);
    // Two doors noted to one target, or the target it would give taken
    expect(
      partners({
        [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)"),
        [id("Kakariko Shop")]: to("Bumper Cave Exit (Bottom)"),
      }).size,
    ).toBe(0);
    expect(
      partners({
        [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)"),
        [id("Kakariko Shop")]: to("Bat Cave Exit"),
      }).has(id("Bumper Cave (Bottom)")),
    ).toBe(false);
  });

  it("pairs the towers as is_atgt_swapped trades them, neither while not known", () => {
    const gt = { [id("Ganons Tower")]: to("Bat Cave Exit") };
    expect(partners(gt, false).get(id("Bat Cave Cave"))?.target).toBe(
      to("Ganons Tower Exit"),
    );
    expect(partners(gt, true).get(id("Bat Cave Cave"))?.target).toBe(
      to("Agahnims Tower Exit"),
    );
    expect(partners(gt, undefined).size).toBe(0);
    const into = { [id("Bat Cave Cave")]: to("Ganons Tower Exit") };
    expect([...partners(into, true).keys()]).toEqual([id("Agahnims Tower")]);
    expect([...partners(into, false).keys()]).toEqual([id("Ganons Tower")]);
    expect(partners(into, undefined).size).toBe(0);
  });

  it("links a Swapped note's partner in the world, the towers by the screens, District's never", () => {
    const notes = { [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)") };
    const swapped = notedConnections(
      OWR_DATA,
      "open",
      noted("swapped", notes, { shuffleTavern: true }),
    ).connections;
    expect(swapped.get("Bumper Cave (Bottom)")).toBe(
      OWR_DATA.parentOf("Bat Cave Exit"),
    );
    expect(swapped.get("Bat Cave Exit")).toBe(
      OWR_DATA.parentOf("Bumper Cave (Bottom)"),
    );
    const district = notedConnections(
      OWR_DATA,
      "open",
      noted("district", notes, { shuffleTavern: true }),
    ).connections;
    expect(district.has("Bumper Cave (Bottom)")).toBe(false);
    // Inverted trades the towers: Ganon's Tower's door into the Bat Cave
    // tells the Bat Cave's door leads to the castle tower's exit
    const gt = noted("swapped", { [id("Ganons Tower")]: to("Bat Cave Exit") });
    expect(
      notedConnections(OWR_DATA, "inverted", gt).connections.get(
        "Bat Cave Cave",
      ),
    ).toBe(OWR_DATA.parentOf("Agahnims Tower Exit"));
    expect(
      notedConnections(OWR_DATA, "open", gt).connections.get("Bat Cave Cave"),
    ).toBe(OWR_DATA.parentOf("Ganons Tower Exit"));
  });

  it("hands Swapped's partners to the pool, District's none", () => {
    const settings = {
      bombShopStart: false,
      shuffleLinks: false,
      shuffleTavern: true,
      towersTraded: false,
    };
    const notes = { [id("Bat Cave Cave")]: to("Bumper Cave Exit (Bottom)") };
    expect(owrEntrancePool("swapped", settings).derived?.(notes)).toEqual(
      partners(notes),
    );
    expect(owrEntrancePool("district", settings).derived).toBeUndefined();
  });
});

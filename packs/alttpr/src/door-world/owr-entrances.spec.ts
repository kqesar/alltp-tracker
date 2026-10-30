import { describe, expect, it } from "vitest";
import {
  drEntranceName,
  drEntranceOf,
  drTargetOf,
  type OwrPoolSettings,
  type OwrShuffle,
  owrEntrancePool,
  owrShuffled,
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

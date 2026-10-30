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
import { solveFacts } from "../facts";
import { settingsFromUpstream } from "../settings";
import { notedConnections, vanillaConnections } from "./connections";
import { DR_DATA } from "./dr-data";
import { DR_DEFAULTS, type DrNotedEntrances, drWorld } from "./index";
import { OWR_DEFAULTS, type OwrPossibleLinks, owrScreensOf } from "./overworld";
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

/** A run's pool settings, Link's start known (`bombShopStart`). */
const settings = (more: Partial<OwrPoolSettings> = {}): OwrPoolSettings => ({
  ...pool(),
  bombShopStart: false,
  ...more,
});

/** Every mode of the fork's `modes` (EntranceShuffle2.py:2158-2768). */
const SHUFFLES: readonly OwrShuffle[] = [
  "dungeonssimple",
  "dungeonsfull",
  "lite",
  "lean",
  "simple",
  "restricted",
  "full",
  "district",
  "swapped",
  "crossed",
  "insanity",
];

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
function vanillaNotes(
  mode: Mode,
  shuffle: OwrShuffle = "district",
): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const name of owrShuffled(
    shuffle,
    settings({
      bombShopStart: undefined,
      shuffleLinks: true,
      shuffleTavern: true,
    }),
  ))
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
    expect(Object.keys(modes).sort()).toEqual([...SHUFFLES].sort());
    expect(modes.district?.undefined).toBe("error");
    expect(modes.swapped?.undefined).toBe("swap");
    const all = new Set(vanillaEntrances(false).pool);
    const open = settings({
      bombShopStart: undefined,
      shuffleLinks: true,
      shuffleTavern: true,
    });
    for (const shuffle of [
      "district",
      "swapped",
      "crossed",
      "full",
      "restricted",
      "simple",
      "insanity",
    ] as const) {
      expect(modes[shuffle]?.undefined).not.toBe("vanilla");
      expect(owrShuffled(shuffle, open), shuffle).toEqual(all);
    }
  });

  it("keeps lite's and lean's caves as their conditions say, and the dungeon shuffles' rest", () => {
    // do_vanilla_connect (:1610-1646) over lite's and lean's fixed pools
    // (:2244-2301, :2357-2414)
    const kept = (shuffle: OwrShuffle, more: Partial<OwrPoolSettings> = {}) =>
      vanillaEntrances(false)
        .pool.filter(
          (name) =>
            !owrShuffled(
              shuffle,
              settings({ shuffleLinks: true, shuffleTavern: true, ...more }),
            ).has(name),
        )
        .sort();
    const always = [
      "Archery Game",
      "Bush Covered House",
      "Dark Lake Hylia Fairy",
      "Dark Lake Hylia Ledge Hint",
      "Dark Sanctuary Hint",
      "East Dark World Hint",
      "Fortune Teller (Dark)",
      "Fortune Teller (Light)",
      "Kakariko Gamble Game",
      "Lake Hylia Fairy",
      "Lake Hylia Fortune Teller",
      "Lost Woods Gamble",
      "Mire Fairy",
    ];
    const shops = [
      "Dark Death Mountain Shop",
      "Dark Lake Hylia Shop",
      "Dark Lumberjack Shop",
      "Dark Potion Shop",
      "Dark World Shop",
      "Kakariko Shop",
      "Lake Hylia Shop",
      "Red Shield Shop",
    ];
    const pots = [
      "20 Rupee Cave",
      "50 Rupee Cave",
      "Dark Lake Hylia Ledge Spike Cave",
      "Lumberjack House",
      "Mire Hint",
      "Palace of Darkness Hint",
      "Snitch Lady (East)",
      "Snitch Lady (West)",
      "Tavern (Front)",
    ];
    const fairies = [
      "Bonk Fairy (Light)",
      "Hookshot Fairy",
      "Light World Bomb Hut",
      "Long Fairy Cave",
    ];
    const takeAnys = [
      "Bonk Fairy (Dark)",
      "Dark Death Mountain Fairy",
      "Dark Lake Hylia Ledge Fairy",
      "Desert Fairy",
      "Light Hype Fairy",
    ];
    const plain = [
      ...always,
      ...shops,
      ...pots,
      ...fairies,
      "Capacity Upgrade",
    ];
    for (const shuffle of ["lite", "lean"] as const) {
      // take_any and bonk drops not known: their caves may move
      expect(kept(shuffle)).toEqual(plain.sort());
      expect(kept(shuffle, { bonkDrops: false, takeAny: "none" })).toEqual(
        [...plain, ...takeAnys, "Good Bee Cave"].sort(),
      );
      expect(kept(shuffle, { bonkDrops: true, takeAny: "fixed" })).toEqual(
        plain.sort(),
      );
      expect(kept(shuffle, { shopsanity: true })).toEqual(
        [...always, ...pots, ...fairies].sort(),
      );
      expect(kept(shuffle, { pottery: "lottery" })).toEqual(
        [
          ...always,
          ...shops,
          "Bonk Fairy (Light)",
          "Long Fairy Cave",
          "Capacity Upgrade",
        ].sort(),
      );
      expect(
        kept(shuffle, { dropShuffle: "underworld", enemyShuffle: true }),
      ).toEqual([...always, ...shops, ...pots].sort());
    }
    // The dungeon shuffles move their pools' entrances alone (:152-153)
    const moved = (shuffle: OwrShuffle) =>
      [
        ...owrShuffled(
          shuffle,
          settings({ shuffleLinks: true, shuffleTavern: true }),
        ),
      ].sort();
    const skull = [
      "Skull Woods First Section Door",
      "Skull Woods First Section Hole (East)",
      "Skull Woods First Section Hole (North)",
      "Skull Woods First Section Hole (West)",
      "Skull Woods Second Section Door (East)",
      "Skull Woods Second Section Door (West)",
      "Skull Woods Second Section Hole",
    ];
    const dungeons = [
      "Agahnims Tower",
      "Desert Palace Entrance (East)",
      "Desert Palace Entrance (North)",
      "Desert Palace Entrance (South)",
      "Desert Palace Entrance (West)",
      "Eastern Palace",
      "Ganons Tower",
      "Hyrule Castle Entrance (East)",
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Entrance (West)",
      "Ice Palace",
      "Misery Mire",
      "Palace of Darkness",
      "Skull Woods Final Section",
      "Swamp Palace",
      "Thieves Town",
      "Tower of Hera",
      "Turtle Rock",
      "Turtle Rock Isolated Ledge Entrance",
      "Dark Death Mountain Ledge (East)",
      "Dark Death Mountain Ledge (West)",
    ];
    expect(moved("dungeonssimple")).toEqual([...dungeons, ...skull].sort());
    expect(moved("dungeonsfull")).toEqual([...dungeons, ...skull].sort());
  });

  it("keeps the start house's door without shufflelinks, the Tavern's back without shuffletavern", () => {
    const kept = (more: Partial<OwrPoolSettings>) =>
      [...all].filter(
        (name) =>
          !owrShuffled(
            "crossed",
            settings({ shuffleLinks: true, shuffleTavern: true, ...more }),
          ).has(name),
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
    // Standard keeps Link's House and the escape's drop (:479-494)
    expect(kept({ mode: "standard" })).toEqual([
      "Hyrule Castle Secret Entrance Drop",
      "Links House",
    ]);
    // The app's pool offers the same, a hole a hole's drop
    const offered = owrEntrancePool("district", settings());
    expect(offered.entrances).toHaveLength(all.length - 2);
    expect(offered.decoupled).toBe(false);
    const hole = drEntranceOf("Kakariko Well Drop").id;
    expect(offered.targetsOf.get(hole)?.map((t) => t.name)).toContain(
      "Lost Woods Hideout (top)",
    );
    expect(offered.targetsOf.get(hole)?.map((t) => t.name)).not.toContain(
      "Kakariko Well Exit",
    );
    expect(offered.partners("x", "y")).toEqual([]);
    // Where a mode places dungeons among dungeons, a dungeon's door a
    // dungeon's exit alone
    const names = (shuffle: OwrShuffle, entrance: string) =>
      owrEntrancePool(shuffle, settings())
        .targetsOf.get(drEntranceOf(entrance).id)
        ?.map((t) => t.name) ?? [];
    for (const shuffle of [
      "simple",
      "restricted",
      "dungeonssimple",
      "dungeonsfull",
    ] as const) {
      expect(names(shuffle, "Eastern Palace"), shuffle).toContain(
        "Tower of Hera Exit",
      );
      expect(names(shuffle, "Eastern Palace"), shuffle).not.toContain(
        "Library",
      );
    }
    for (const shuffle of [
      "full",
      "crossed",
      "lite",
      "lean",
      "insanity",
    ] as const)
      expect(names(shuffle, "Eastern Palace"), shuffle).toEqual(
        expect.arrayContaining(["Tower of Hera Exit", "Library"]),
      );
    expect(owrEntrancePool("insanity", settings()).decoupled).toBe(true);
  });

  for (const mode of ["open", "inverted"] as const)
    for (const shuffle of SHUFFLES)
      it(`builds the vanilla world from every entrance noted where it stands (${shuffle}, ${mode})`, () => {
        const found = notedConnections(
          OWR_DATA,
          mode,
          noted(shuffle, vanillaNotes(mode, shuffle)),
        );
        const decoupled = shuffle === "insanity";
        expect(found.complete).toBe(!decoupled);
        expect(found.decoupled).toBe(decoupled);
        const vanilla = Object.fromEntries(vanillaConnections(OWR_DATA, mode));
        if (!decoupled)
          expect(Object.fromEntries(found.connections)).toEqual(vanilla);
        else {
          // Insanity: each door as it stands, its exit's way back unnoted
          const got = Object.fromEntries(found.connections);
          const exits = new Set(vanillaEntrances(false).twoWay.values());
          for (const [exit, region] of Object.entries(vanilla))
            if (exits.has(exit) && exit !== "Links House Exit")
              expect(got[exit], exit).toBeUndefined();
            else if (exit !== "Links House Exit")
              expect(got[exit], exit).toBe(region);
          // The start house's door both ways (:717-719)
          if (mode === "open")
            expect(got["Links House Exit"]).toBe(vanilla["Links House Exit"]);
        }
      });

  it("links an entrance not noted nowhere, a noted one both ways", () => {
    const empty = notedConnections(OWR_DATA, "open", noted("swapped", {}));
    expect(empty.complete).toBe(false);
    const moved = owrShuffled("swapped", settings());
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
        ...owrEntrancePool(
          "district",
          settings({ bombShopStart: undefined, shuffleTavern: true }),
        ).entrances,
      ].map((e) => drEntranceName(e.id)),
    ).toEqual(expect.arrayContaining(["Links House", "Big Bomb Shop"]));
  });

  it("parts a door from its way back in Insanity, but the start house's", () => {
    const shop = drEntranceOf("Kakariko Shop");
    const cave = drEntranceOf("Bat Cave Cave");
    const found = notedConnections(
      OWR_DATA,
      "open",
      noted(
        "insanity",
        {
          [shop.id]: drTargetOf("Links House Exit").id,
          [cave.id]: drTargetOf("Old Man House Exit (Bottom)").id,
        },
        { shuffleLinks: true },
      ),
    );
    expect(found.decoupled).toBe(true);
    expect(found.complete).toBe(false);
    expect(found.connections.get("Bat Cave Cave")).toBe(
      OWR_DATA.parentOf("Old Man House Exit (Bottom)"),
    );
    expect(found.connections.has("Old Man House Exit (Bottom)")).toBe(false);
    expect(found.connections.get("Links House Exit")).toBe(
      OWR_DATA.parentOf("Kakariko Shop"),
    );
  });

  it("asks the pearl in a cave entered from both worlds, or that a door not noted may lead into", () => {
    // The fork's add_bunny_rule asks the pearl wherever a region lies in
    // the dark world (can_cause_bunny, owr:BaseClasses.py:1703-1707, Rules.py:
    // 291-293), a cave of both worlds too, where DR's asks it only off the
    // light world. Paradox Cave from Sahasrahla's Hut (light) and Skull
    // Woods' back door (dark): its lower chests (Rules.py:1018-1021) ask the
    // pearl, as avianart mGEeueUjZ's playthrough holds them after it
    const owr = {
      ...DR_DEFAULTS,
      ...settingsFromUpstream("open"),
      ...OWR_DEFAULTS,
      drVersion: 157,
      shuffle_crossed: true,
    };
    const paradox = {
      [drEntranceOf("Sahasrahlas Hut").id]: drTargetOf(
        "Paradox Cave Exit (Top)",
      ).id,
      [drEntranceOf("Blinds Hideout").id]: drTargetOf(
        "Paradox Cave Exit (Bottom)",
      ).id,
    };
    const lower = (notes: Record<string, string>, pearl: boolean) => {
      const world = drWorld(owr, {
        data: OWR_DATA,
        entrances: noted("crossed", notes, { shuffleLinks: false }),
      });
      return solveFacts(world, {
        caneOfSomaria: 1,
        heartContainer: 3,
        ...(pearl ? { moonPearl: 1 } : {}),
      }).location(world.locationIds.get("Paradox Cave Lower - Left") ?? "");
    };
    const both = {
      ...paradox,
      [drEntranceOf("Skull Woods Final Section").id]: drTargetOf(
        "Paradox Cave Exit (Middle)",
      ).id,
    };
    expect(lower(both, true)).toBe("yes");
    expect(lower(both, false)).not.toBe("yes");
    // Its middle exit not noted: any door may lead in, a dark one too
    expect(lower(paradox, false)).not.toBe("yes");
    expect(lower(paradox, true)).toBe("yes");
    // Every exit from the light world: no pearl
    const light = {
      ...paradox,
      [drEntranceOf("Chicken House").id]: drTargetOf(
        "Paradox Cave Exit (Middle)",
      ).id,
    };
    expect(lower(light, false)).toBe("yes");
  });

  it("reads District with DR's data never, and no mode the fork does not name", () => {
    expect(() =>
      notedConnections(DR_DATA, "open", noted("district", {})),
    ).toThrow(RangeError);
    expect(() =>
      notedConnections(OWR_DATA, "open", {
        ...noted("district", {}),
        shuffle: "vanilla" as OwrShuffle,
      }),
    ).toThrow(RangeError);
  });
});

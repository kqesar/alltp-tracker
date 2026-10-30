import { describe, expect, it } from "vitest";
import { HOLES, holeAt } from "../scripts/import-er.mjs";
import { pythonLiteral } from "../scripts/python.mjs";
import { erSeed, erSeedHashes } from "../test/er-seeds";
import tables from "./autotrack/entrance-tables.json" with { type: "json" };
import {
  crossedPool,
  ENTRANCES,
  type EntrancePool,
  type ErShuffle,
  entranceNamed,
  entrancePool,
  fullPool,
  labelOf,
  linksOf,
  PLACE_OF_LOCATION,
  restrictedPool,
  simplePool,
  TARGETS,
  targetNamed,
} from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
import { MARKERS } from "./markers";

/** A real Crosskeys seed's entrances, from its spoiler (test/er-seeds). */
const seed = erSeed("0yAObedRMV").spoiler;

const marker = (id: string) => {
  const found = MARKERS.find((m) => m.id === id);
  if (found === undefined) throw new RangeError(id);
  return found;
};

/** How far apart two places of the map are, in its percents. */
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("the importer", () => {
  it("reads Python's literals as data", () => {
    expect(
      pythonLiteral(
        "[('a', \"b\"), ('c',), {'k': (0x1F, None)}, {'x', 'y'}, -2, True] # done",
      ),
    ).toEqual([["a", "b"], ["c"], { k: [31, null] }, ["x", "y"], -2, true]);
    // Adjacent strings join, escapes unescape, (x) is x
    expect(pythonLiteral("('Blind\\'s' ' Hideout')")).toBe("Blind's Hideout");
    expect(() => pythonLiteral("[a + b]")).toThrow(/<text>:1: expected , or ]/);
  });

  it("finds a hole in the game's table, rows 7 above where it is drawn", () => {
    const rom = new Uint8Array(0x100000);
    // Entry 8: position 0x003c, area 0x5b (the Pyramid)
    rom[0xdb800 + 16] = 0x3c;
    rom[0xdb826 + 16] = 0x5b;
    expect(holeAt(rom, 0xdb84c + 8)).toEqual({
      area: 0x5b,
      // Screen 0x1b of the Dark World: column 3, row 3; tile 30, row 0 + 7
      x: 3 * 512 + 30 * 16 + 8,
      y: 3 * 512 + 7 * 16 + 8,
    });
    expect(() => holeAt(rom, 0xdb84c + 19)).toThrow(/no entry/);
  });
});

describe("the entrances", () => {
  it("each lie in their world, on the map", () => {
    for (const e of ENTRANCES) {
      expect(e.y, e.name).toBeGreaterThanOrEqual(0);
      expect(e.y, e.name).toBeLessThanOrEqual(100);
      if (e.world === "light") expect(e.x, e.name).toBeLessThan(50);
      else expect(e.x, e.name).toBeGreaterThanOrEqual(50);
    }
    expect(entranceNamed("Big Bomb Shop")).toMatchObject({ world: "dark" });
  });

  it("stand where the legacy map's markers put what lies behind them", () => {
    // A door: where Link comes out of it
    expect(
      distance(entranceNamed("Links House"), marker("links-house")),
    ).toBeLessThan(1);
    expect(
      distance(entranceNamed("Blinds Hideout"), marker("blinds-hideout")),
    ).toBeLessThan(1);
    expect(
      distance(entranceNamed("Kings Grave"), marker("kings-tomb")),
    ).toBeLessThan(1);
    // A hole: from the base ROM's hole table, 7 rows down
    for (const [hole, id] of [
      ["Kakariko Well Drop", "kakariko-well"],
      ["Lost Woods Hideout Drop", "lost-woods-hideout"],
      ["Lumberjack Tree Tree", "lumberjack-tree"],
      ["Hyrule Castle Secret Entrance Drop", "secret-passage"],
      ["Bat Cave Drop", "magic-bat"],
    ] as const) {
      expect(distance(entranceNamed(hole), marker(id)), hole).toBeLessThan(2.5);
      expect(entranceNamed(hole).kind).toBe("hole");
    }
  });

  it("are named as the game spells them", () => {
    expect(entranceNamed("Blinds Hideout").label).toBe("Blind's Hideout");
    expect(labelOf("Sahasrahlas Hut")).toBe("Sahasrahla's Hut");
    expect(labelOf("Kakariko Shop")).toBe("Kakariko Shop");
  });
});

describe("the targets", () => {
  it("are each named once", () => {
    expect(new Set(TARGETS.map((t) => t.id)).size).toBe(TARGETS.length);
    expect(new Set(TARGETS.map((t) => t.name)).size).toBe(TARGETS.length);
  });

  it("group a dungeon's or a cave's sides under the place a player knows", () => {
    expect(targetNamed("Elder House Exit (East)")).toMatchObject({
      kind: "connector",
      place: "Elder House",
      side: "East",
    });
    expect(targetNamed("Turtle Rock Ledge Exit (West)")).toMatchObject({
      kind: "dungeon",
      place: "Turtle Rock",
      side: "Ledge West",
    });
    expect(targetNamed("Desert Palace Exit (North)")).toMatchObject({
      place: "Desert Palace",
      side: "North",
    });
    expect(targetNamed("Agahnims Tower Exit")).toMatchObject({
      kind: "dungeon",
      place: "Agahnim's Tower",
    });
    expect(targetNamed("Spectacle Rock Cave Exit")).not.toHaveProperty("side");
    expect(targetNamed("Sanctuary Exit")).toMatchObject({
      place: "Hyrule Castle",
      side: "Sanctuary",
    });
    expect(targetNamed("Blinds Hideout")).toMatchObject({
      kind: "single",
      place: "Blind's Hideout",
    });
    expect(targetNamed("Kakariko Well (top)")).toMatchObject({
      kind: "drop",
      place: "Kakariko Well",
      side: "top",
    });
    expect(targetNamed("Skull Woods First Section (Left)")).toMatchObject({
      kind: "drop",
      place: "Skull Woods",
      side: "First Section (Left)",
    });
  });
});

describe("the checks inside", () => {
  it("lie in the place a shuffled entrance names", () => {
    expect(PLACE_OF_LOCATION.get("blinds-hideout/top")).toBe("Blind's Hideout");
    expect(PLACE_OF_LOCATION.get("sanctuary")).toBe("Hyrule Castle");
    expect(PLACE_OF_LOCATION.get("sewers/secret-room/left")).toBe(
      "Hyrule Castle",
    );
    expect(PLACE_OF_LOCATION.get("thieves-town/boss")).toBe("Thieves Town");
    expect(PLACE_OF_LOCATION.get("kings-tomb")).toBe("King's Grave");
    expect(PLACE_OF_LOCATION.get("paradox-cave-upper/left")).toBe(
      "Paradox Cave",
    );
    // Behind a door the shuffle keeps, or outdoors: none
    expect(PLACE_OF_LOCATION.has("links-house")).toBe(false);
    expect(PLACE_OF_LOCATION.has("lake-hylia-island")).toBe(false);
  });

  it("cover every check of the map behind a shuffled door, under vt's names", () => {
    // The randomizer's "Peg Cave" is vt's Hammer Pegs
    expect(PLACE_OF_LOCATION.get("hammer-pegs")).toBe(
      "Dark World Hammer Peg Cave",
    );
    expect(PLACE_OF_LOCATION.get("mini-moldorm-cave/npc")).toBe(
      "Mini Moldorm Cave",
    );
    // Every marker inside is wholly inside one place, but the Dam's: its
    // floodgate chest is inside, its sunken treasure outdoors
    const mixed = MARKERS.filter(
      (marker) =>
        new Set(marker.locations.map((id) => PLACE_OF_LOCATION.get(id))).size >
        1,
    );
    expect(mixed.map((marker) => marker.id)).toEqual(["dam"]);
  });
});

describe("the crossed shuffle", () => {
  const open = crossedPool("open");

  it("mixes doors and holes, each hole paired with its cave's door", () => {
    const holes = open.entrances.filter((e) => e.kind === "hole");
    expect(holes).toHaveLength(12);
    // 126 doors: every one a real seed shuffled (below)
    expect(open.entrances.length - holes.length).toBe(126);
    expect(open.holeDoors.get("kakariko-well-drop")).toBe("kakariko-well-cave");
    expect(open.holeDoors.get("pyramid-hole")).toBe("pyramid-entrance");
  });

  it("keeps the escape's doors in a Standard world", () => {
    const standard = crossedPool("standard").entrances.map((e) => e.name);
    expect(standard).not.toContain("Hyrule Castle Entrance (South)");
    expect(standard).not.toContain("Hyrule Castle Secret Entrance Drop");
    expect(open.entrances.map((e) => e.name)).toContain(
      "Hyrule Castle Entrance (South)",
    );
  });

  it("gives each entrance the targets the shuffle may give it", () => {
    const kinds = (id: string) =>
      new Set(open.targetsOf.get(id)?.map((t) => t.kind));
    expect(open.targetsOf.get("kakariko-well-drop")).toHaveLength(8);
    expect(kinds("kakariko-well-drop")).toEqual(new Set(["drop"]));
    // A hole's cave's door leads to such a cave's door only
    expect(
      open.targetsOf.get("kakariko-well-cave")?.map((t) => t.place),
    ).toContain("Bat Cave");
    expect(open.targetsOf.get("kakariko-well-cave")).toHaveLength(8);
    expect(
      open.targetsOf.get("skull-woods-first-section-hole-east"),
    ).toHaveLength(4);
    const shop = open.targetsOf.get("kakariko-shop")?.map((t) => t.id) ?? [];
    expect(shop).not.toContain("bat-cave-exit");
    expect(shop).not.toContain("skull-woods-first-section-exit");
    expect(kinds("kakariko-shop").has("drop")).toBe(false);
  });

  it("gives the retro world's take-any caves the doors of the caves they draw", () => {
    // set_up_take_anys (ItemList.py:243-286): five caves of
    // take_any_locations lose their door to the old man's sword cave or a
    // take-any
    expect(er.takeAnys.regions.map(({ name }) => name)).toEqual([
      "Old Man Sword Cave",
      "Take-Any #1",
      "Take-Any #2",
      "Take-Any #3",
      "Take-Any #4",
    ]);
    expect(targetNamed("Take-Any #4")).toMatchObject({
      kind: "single",
      place: "Take-Any Cave",
      side: "4",
    });
    const retro = crossedPool("open", true);
    const ids = (pool: EntrancePool, entrance: string) =>
      pool.targetsOf.get(entrance)?.map((t) => t.id) ?? [];
    // Any door that may lead to a single cave, a fairy's among them
    for (const door of ["east-dark-world-hint", "desert-palace-entrance-north"])
      expect(ids(retro, door)).toEqual([
        ...ids(open, door),
        "old-man-sword-cave",
        "take-any-1",
        "take-any-2",
        "take-any-3",
        "take-any-4",
      ]);
    // Never a hole, nor a cave a hole drops into, nor outside retro
    expect(ids(retro, "kakariko-well-cave")).not.toContain("take-any-1");
    expect(ids(retro, "kakariko-well-drop")).not.toContain("take-any-1");
    expect(ids(open, "kakariko-shop")).not.toContain("take-any-1");
    expect(ids(fullPool("open", true), "kakariko-shop")).toContain(
      "old-man-sword-cave",
    );
  });

  it("settles a hole and its cave's door together", () => {
    expect(open.partners("kakariko-well-drop", "bat-cave-right")).toEqual([
      ["kakariko-well-cave", "bat-cave-exit"],
    ]);
    expect(open.partners("kakariko-well-cave", "bat-cave-exit")).toEqual([
      ["kakariko-well-drop", "bat-cave-right"],
    ]);
    expect(open.partners("kakariko-shop", "blinds-hideout")).toEqual([]);
    // Nor a dungeon's door, nor a cave's: the crossed shuffle splits them
    expect(
      open.partners("desert-palace-entrance-south", "desert-palace-exit-east"),
    ).toEqual([]);
    expect(open.partners("elder-house-east", "elder-house-exit-west")).toEqual(
      [],
    );
  });

  it("gives a must-exit door a cave's last exit, the Old Man's way out his doors", () => {
    const ids = (entrance: string) =>
      open.targetsOf.get(entrance)?.map((t) => t.id) ?? [];
    // connect_mandatory_exits (EntranceShuffle.py:1938): never a lone exit
    // nor a single cave, never what a tuple keeps first
    const ledge = ids("dark-death-mountain-ledge-east");
    expect(ledge).toContain("turtle-rock-isolated-ledge-exit");
    expect(ledge).toContain("spectacle-rock-cave-exit");
    for (const never of [
      "eastern-palace-exit",
      "ganons-tower-exit",
      "blinds-hideout",
      "turtle-rock-ledge-exit-east",
      "superbunny-cave-exit-bottom",
      "spectacle-rock-cave-exit-peak",
      "old-man-cave-exit-west",
    ])
      expect(ledge).not.toContain(never);
    // The Old Man's way out: Death Mountain's doors or Tower of Hera's
    // (:371, :402)
    expect(ids("tower-of-hera")).toContain("old-man-cave-exit-east");
    expect(ids("kakariko-shop")).not.toContain("old-man-cave-exit-east");
    expect(ids("kakariko-shop")).toContain("old-man-cave-exit-west");
    // The blacksmith and the bomb shop behind their own doors (:408-421)
    expect(ids("kakariko-shop")).toContain("blacksmiths-hut");
    expect(ids("pyramid-fairy")).not.toContain("big-bomb-shop");
    expect(ids("misery-mire")).toContain("big-bomb-shop");
    expect(ids("misery-mire")).not.toContain("blacksmiths-hut");
  });

  it("holds a real Crosskeys seed: every entrance it shuffled, every target", () => {
    expect(seed.meta.shuffle).toBe("crossed");
    const pool = new Set(open.entrances.map((e) => e.name));
    // Link's House and the Tavern's back door stay; the house's Chris
    // Houlihan room is a way out, never in
    const fixed = new Set(["Links House", "Tavern North"]);
    const mapped = seed.Entrances.filter(
      (m) => m.direction !== "exit" && !fixed.has(m.entrance),
    );
    for (const { entrance, exit } of mapped) {
      expect(pool.has(entrance), entrance).toBe(true);
      expect(targetNamed(exit).name).toBe(exit);
    }
    // And the seed shuffled every entrance of the pool
    expect(new Set(mapped.map((m) => m.entrance))).toEqual(pool);
    // Each within what the shuffle may give it, and each hole's door its
    // partner's
    const noted = new Map(
      mapped.map((m) => [entranceNamed(m.entrance).id, targetNamed(m.exit).id]),
    );
    for (const [entrance, target] of noted) {
      expect(
        open.targetsOf.get(entrance)?.map((t) => t.id),
        entrance,
      ).toContain(target);
      for (const [other, to] of open.partners(entrance, target))
        expect(noted.get(other), entrance).toBe(to);
    }
  });
});

describe("the full shuffle", () => {
  const crossed = crossedPool("open");
  const full = fullPool("open");

  const targets = (pool: EntrancePool, id: string) =>
    pool.targetsOf.get(id)?.map((t) => t.id) ?? [];
  const OLD_MAN = [
    "old-man-house-exit-bottom",
    "old-man-house-exit-top",
    "old-man-cave-exit-west",
  ];
  // A shop in each world, beside the Old Man's own door
  const dark = "dark-lake-hylia-shop";
  const light = "kakariko-shop";

  it("mixes the same doors and holes as the crossed one", () => {
    // Both draw on the same tables, scramble_holes and Skull Woods
    // (EntranceShuffle.py:260-364, 365-440)
    for (const mode of ["open", "standard"] as const)
      expect(fullPool(mode).entrances.map((e) => e.id)).toEqual(
        crossedPool(mode).entrances.map((e) => e.id),
      );
  });

  it("keeps the Light World's places out of a Dark World door", () => {
    expect(entranceNamed("Dark Lake Hylia Shop").world).toBe("dark");
    // His way out only ever behind his Death Mountain doors (:319)
    expect(targets(full, "old-man-cave-east")).toContain(
      "old-man-cave-exit-east",
    );
    expect(targets(full, light)).not.toContain("old-man-cave-exit-east");
    for (const id of OLD_MAN) {
      // The crossed shuffle places them anywhere
      expect(targets(crossed, dark)).toContain(id);
      expect(targets(full, dark)).not.toContain(id);
      expect(targets(full, light)).toContain(id);
    }
    // And Standard's castle sides (:315)
    expect(targets(fullPool("standard"), dark)).not.toContain(
      "hyrule-castle-exit-west",
    );
    expect(targets(fullPool("standard"), light)).toContain(
      "hyrule-castle-exit-west",
    );
    expect(targets(crossedPool("standard"), dark)).toContain(
      "hyrule-castle-exit-west",
    );
  });

  it("never puts Sanctuary's cave under the Pyramid, as the crossed one may", () => {
    // scramble_holes (:1838-1844)
    expect(targets(full, "pyramid-entrance")).not.toContain("sanctuary-exit");
    expect(targets(full, "pyramid-hole")).not.toContain("sewer-drop");
    expect(targets(crossed, "pyramid-entrance")).toContain("sanctuary-exit");
    expect(targets(full, "sanctuary")).toContain("pyramid-exit");
  });
});

describe("the simple and restricted shuffles", () => {
  const ids = (pool: EntrancePool, id: string) =>
    pool.targetsOf.get(id)?.map((t) => t.id) ?? [];
  const simple = simplePool("open");
  const restricted = restrictedPool("open");

  it("shuffle the crossed one's doors, but the castle's a Standard world keeps", () => {
    for (const pool of [simple, restricted])
      expect(pool.entrances.map((e) => e.id)).toEqual(
        crossedPool("open").entrances.map((e) => e.id),
      );
    // simple_shuffle_dungeons leaves Hyrule Castle where it is (:2054-2069)
    const standard = simplePool("standard").entrances.map((e) => e.name);
    for (const kept of [
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Entrance (East)",
      "Hyrule Castle Entrance (West)",
      "Agahnims Tower",
      "Hyrule Castle Secret Entrance Drop",
    ])
      expect(standard).not.toContain(kept);
    expect(standard).toContain("Desert Palace Entrance (North)");
    expect(restrictedPool("standard").entrances.map((e) => e.name)).toEqual(
      standard,
    );
  });

  it("mix dungeons among dungeons only", () => {
    for (const pool of [simple, restricted]) {
      expect(new Set(ids(pool, "eastern-palace"))).toEqual(
        new Set([
          "eastern-palace-exit",
          "tower-of-hera-exit",
          "thieves-town-exit",
          "skull-woods-final-section-exit",
          "palace-of-darkness-exit",
          "ice-palace-exit",
          "misery-mire-exit",
          "swamp-palace-exit",
          "ganons-tower-exit",
        ]),
      );
      // A four-door dungeon's door: the door of whichever moved there
      expect(new Set(ids(pool, "agahnims-tower"))).toEqual(
        new Set([
          "desert-palace-exit-north",
          "agahnims-tower-exit",
          "turtle-rock-isolated-ledge-exit",
        ]),
      );
      expect(ids(pool, "kakariko-shop")).not.toContain("eastern-palace-exit");
    }
    expect(ids(simplePool("standard"), "turtle-rock")).toEqual([
      "desert-palace-exit-south",
      "turtle-rock-exit-front",
    ]);
  });

  it("settle a four-door dungeon's doors by one", () => {
    // Turtle Rock at the castle's doors (:2096-2100)
    expect(
      restricted.partners(
        "hyrule-castle-entrance-east",
        "turtle-rock-ledge-exit-east",
      ),
    ).toEqual([
      ["hyrule-castle-entrance-south", "turtle-rock-exit-front"],
      ["hyrule-castle-entrance-west", "turtle-rock-ledge-exit-west"],
      ["agahnims-tower", "turtle-rock-isolated-ledge-exit"],
    ]);
    // At its own doors, its ledges otherwise (:2104-2108)
    expect(simple.partners("turtle-rock", "turtle-rock-exit-front")).toEqual([
      [
        "turtle-rock-isolated-ledge-entrance",
        "turtle-rock-isolated-ledge-exit",
      ],
      ["dark-death-mountain-ledge-west", "turtle-rock-ledge-exit-west"],
      ["dark-death-mountain-ledge-east", "turtle-rock-ledge-exit-east"],
    ]);
    // A one-door dungeon settles nothing, nor does the crossed shuffle
    expect(simple.partners("eastern-palace", "ice-palace-exit")).toEqual([]);
    expect(
      crossedPool("open").partners("turtle-rock", "turtle-rock-exit-front"),
    ).toEqual([]);
  });

  it("give the simple shuffle's pairs of doors a two-door cave whole, in order", () => {
    // Two_Door_Caves(_Directional) take Cave_Exits (:76-95)
    const first = ids(simple, "elder-house-east");
    expect(first).toHaveLength(14);
    expect(first).toContain("superbunny-cave-exit-bottom");
    expect(first).not.toContain("superbunny-cave-exit-top");
    expect(first).not.toContain("spiral-cave-exit");
    expect(ids(simple, "elder-house-west")).toContain("spiral-cave-exit");
    expect(ids(simple, "elder-house-west")).not.toContain(
      "spiral-cave-exit-top",
    );
    expect(first).not.toContain("old-man-house-exit-top");
    expect(
      simple.partners("bumper-cave-bottom", "spiral-cave-exit-top"),
    ).toEqual([["bumper-cave-top", "spiral-cave-exit"]]);
    expect(
      simple.partners("hookshot-cave-back-entrance", "elder-house-exit-east"),
    ).toEqual([["hookshot-cave", "elder-house-exit-west"]]);
    // The restricted shuffle places each exit apart
    expect(
      restricted.partners("bumper-cave-bottom", "spiral-cave-exit-top"),
    ).toEqual([]);
  });

  it("fill Death Mountain's doors with its caves, and single doors with single caves, in the simple shuffle", () => {
    const mountain = ids(simple, "paradox-cave-bottom");
    expect(mountain).toContain("old-man-house-exit-top");
    expect(mountain).toContain("paradox-cave-exit-top");
    expect(mountain).toContain("old-man-cave-exit-west");
    expect(mountain).toContain("bumper-cave-exit-top");
    expect(mountain).not.toContain("old-man-cave-exit-east");
    expect(ids(simple, "spectacle-rock-cave")).toContain(
      "old-man-cave-exit-east",
    );
    expect(mountain).not.toContain("blinds-hideout");
    const shop = ids(simple, "kakariko-shop");
    expect(shop).toContain("blinds-hideout");
    expect(shop).toContain("blacksmiths-hut");
    expect(shop).not.toContain("elder-house-exit-east");
    expect(ids(simple, "pyramid-fairy")).not.toContain("big-bomb-shop");
  });

  it("mix caves and single doors in the restricted shuffle, the Old Man in the Light World", () => {
    const shop = ids(restricted, "kakariko-shop");
    expect(shop).toContain("elder-house-exit-east");
    expect(shop).toContain("blinds-hideout");
    expect(shop).toContain("old-man-house-exit-top");
    const dark = ids(restricted, "dark-lake-hylia-shop");
    expect(dark).toContain("paradox-cave-exit-top");
    expect(dark).not.toContain("old-man-house-exit-top");
    expect(dark).not.toContain("old-man-cave-exit-west");
    // A must-exit door a cave's last exit (:151)
    const top = ids(restricted, "bumper-cave-top");
    expect(top).toContain("elder-house-exit-east");
    expect(top).not.toContain("blinds-hideout");
    expect(top).not.toContain("spectacle-rock-cave-exit-top");
    // The bomb shop at a blacksmith's door left (:162-178)
    expect(ids(restricted, "old-man-cave-west")).toContain("big-bomb-shop");
  });
});

describe("where the game shows Link went", () => {
  const open = crossedPool("open");
  type Door = { hole?: boolean; slot?: number; slots?: number[] };
  const doors = er.doors.value as Record<string, Door>;
  const exits = er.exits.value as Record<string, { entrance: number | null }>;
  /** A door's or hole's link to `target`, as the game's numbers say it. */
  const link = (entrance: string, target: string) => {
    const { hole, slot, slots } = doors[entrance] ?? {};
    const loads = exits[target]?.entrance ?? -1;
    return hole
      ? { entrance: loads, kind: "hole" as const, slot: slots?.[0] ?? -1 }
      : { entrance: loads, kind: "door" as const, slot: slot ?? -1 };
  };

  it("knows every door and hole the crossed shuffle mixes by its slot", () => {
    const slots = new Set<number>();
    for (const entrance of open.entrances) {
      const { hole, slot, slots: bytes } = doors[entrance.name] ?? {};
      if (hole) {
        expect(bytes?.length, entrance.name).toBeGreaterThan(0);
        for (const at of bytes ?? []) expect(at).toBeLessThan(HOLES);
      } else {
        expect(slot, entrance.name).toBeLessThan(tables.doors);
        expect(slots.has(slot ?? -1), entrance.name).toBe(false);
        slots.add(slot ?? -1);
      }
    }
    expect(tables.holes).toBe(HOLES);
  });

  it("knows every target by the entrance the game loads, a few alike by one", () => {
    const byEntrance = new Map<number, string[]>();
    // The retro world's take-any caves load another place's entrance
    // (ItemList.py:256, 275-279): exit_ids names none of them
    const takeAnys = new Set(er.takeAnys.regions.map(({ name }) => name));
    for (const target of TARGETS.filter((t) => !takeAnys.has(t.name))) {
      const loads = exits[target.name]?.entrance;
      expect(typeof loads, target.name).toBe("number");
      byEntrance.set(loads ?? -1, [
        ...(byEntrance.get(loads ?? -1) ?? []),
        target.name,
      ]);
    }
    // Rooms alike, which the game loads by one entrance (exit_ids)
    expect(
      [...byEntrance.values()].filter((names) => names.length > 1),
    ).toEqual([
      ["Bonk Fairy (Light)", "Bonk Fairy (Dark)"],
      [
        "Lake Hylia Healer Fairy",
        "Swamp Healer Fairy",
        "Desert Healer Fairy",
        "Dark Lake Hylia Healer Fairy",
        "Dark Lake Hylia Ledge Healer Fairy",
        "Dark Desert Healer Fairy",
        "Dark Death Mountain Healer Fairy",
      ],
      ["Cave Shop (Lake Hylia)", "Cave Shop (Dark Death Mountain)"],
      ["Fortune Teller (Light)", "Lake Hylia Fortune Teller"],
      [
        "Village of Outcasts Shop",
        "Dark Lake Hylia Shop",
        "Dark World Lumberjack Shop",
        "Dark World Potion Shop",
      ],
    ]);
  });

  it("names a real seed's doors and holes as its spoiler", () => {
    const mapped = seed.Entrances.filter(
      (m) =>
        m.direction !== "exit" &&
        open.targetsOf.has(entranceNamed(m.entrance).id),
    );
    expect(mapped.length).toBeGreaterThan(130);
    for (const { entrance, exit } of mapped) {
      const [found] = linksOf([link(entrance, exit)]);
      expect(found?.entrance, entrance).toBe(entranceNamed(entrance).id);
      expect(found?.targets, entrance).toContain(targetNamed(exit).id);
    }
  });

  it("names Link's House and the Tavern's back, which DR's pools shuffle", () => {
    // Entrances 1 and 0x43 (exit_ids, dr:EntranceShuffle2.py:2631, :2707):
    // a DR or OWR run's door into either, read off the game
    for (const [entrance, target] of [
      [0x01, "links-house-exit"],
      [0x43, "tavern"],
    ] as const)
      expect(
        linksOf([{ entrance, kind: "door", slot: 0 }])[0]?.targets,
      ).toEqual([target]);
  });

  it("names nothing for a slot or an entrance the tables do not know", () => {
    expect(
      linksOf([
        { entrance: 0x01, kind: "door", slot: tables.doors },
        { entrance: 0x01, kind: "hole", slot: HOLES },
        { entrance: 0xff, kind: "door", slot: 0 },
      ]),
    ).toEqual([]);
  });
});

describe("every recorded seed of a shuffle the pack ports", () => {
  const SHUFFLES: readonly string[] = [
    "simple",
    "restricted",
    "full",
    "crossed",
  ];
  // Link's House and the Tavern's back door stay; the house's Chris
  // Houlihan room is a way out, never in
  const fixed = new Set(["Links House", "Tavern North"]);
  const seeds = erSeedHashes()
    .map((hash) => ({ hash, spoiler: erSeed(hash).spoiler }))
    .filter(({ spoiler }) => SHUFFLES.includes(spoiler.meta.shuffle));

  it("covers every shuffle and world", () => {
    expect(
      new Set(
        seeds.map(({ spoiler: { meta } }) => `${meta.shuffle} ${meta.mode}`),
      ),
    ).toEqual(
      new Set([
        "crossed open",
        "crossed retro",
        "crossed standard",
        "full open",
        "restricted open",
        "simple open",
        "simple standard",
      ]),
    );
  });

  for (const { hash, spoiler } of seeds) {
    const { mode, shuffle } = spoiler.meta;
    const pool = entrancePool(
      shuffle as ErShuffle,
      mode === "standard" ? "standard" : "open",
      mode === "retro",
    );
    // What a Standard world keeps: the escape's doors, and in the simple
    // and restricted shuffles the castle's others (EntranceShuffle.py:
    // 2054-2069)
    const kept: Readonly<Record<string, string>> =
      mode !== "standard"
        ? {}
        : {
            "Hyrule Castle Entrance (South)": "Hyrule Castle Exit (South)",
            "Hyrule Castle Secret Entrance Drop":
              "Hyrule Castle Secret Entrance",
            "Hyrule Castle Secret Entrance Stairs":
              "Hyrule Castle Secret Entrance Exit",
            ...(shuffle === "simple" || shuffle === "restricted"
              ? {
                  "Agahnims Tower": "Agahnims Tower Exit",
                  "Hyrule Castle Entrance (East)": "Hyrule Castle Exit (East)",
                  "Hyrule Castle Entrance (West)": "Hyrule Castle Exit (West)",
                }
              : {}),
          };
    const listed = spoiler.Entrances.filter(
      (m) => m.direction !== "exit" && !fixed.has(m.entrance),
    );
    const mapped = listed.filter((m) => kept[m.entrance] === undefined);
    const noted = new Map(
      mapped.map((m) => [entranceNamed(m.entrance).id, targetNamed(m.exit).id]),
    );

    it(`${hash} (${shuffle}, ${mode}): kept what its world keeps, and shuffled every other entrance of the pool`, () => {
      expect(
        Object.fromEntries(
          listed
            .filter((m) => kept[m.entrance] !== undefined)
            .map((m) => [m.entrance, m.exit]),
        ),
      ).toEqual(kept);
      expect(new Set(mapped.map((m) => m.entrance))).toEqual(
        new Set(pool.entrances.map((e) => e.name)),
      );
    });

    it(`${hash} (${shuffle}, ${mode}): led each to a target its pool offers, and as its partners say`, () => {
      for (const [entrance, target] of noted) {
        expect(
          pool.targetsOf.get(entrance)?.map((t) => t.id),
          entrance,
        ).toContain(target);
        for (const [other, to] of pool.partners(entrance, target))
          expect(noted.get(other), `${entrance} settles ${other}`).toBe(to);
      }
    });
  }
});

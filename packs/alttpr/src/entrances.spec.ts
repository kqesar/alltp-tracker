import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOLES, holeAt } from "../scripts/import-er.mjs";
import { pythonLiteral } from "../scripts/python.mjs";
import tables from "./autotrack/entrance-tables.json" with { type: "json" };
import {
  type CrossedPool,
  crossedPool,
  ENTRANCES,
  entranceNamed,
  fullPool,
  labelOf,
  linksOf,
  PLACE_OF_LOCATION,
  TARGETS,
  targetNamed,
} from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
import { MARKERS } from "./markers";

/** A real Crosskeys seed's entrances, from its spoiler (test/er-seeds). */
const seed = JSON.parse(
  readFileSync(
    new URL("../test/er-seeds/0yAObedRMV.json", import.meta.url),
    "utf8",
  ),
) as {
  meta: { shuffle: string };
  entrances: { entrance: string; exit: string; direction: string }[];
};

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
    const ids = (pool: CrossedPool, entrance: string) =>
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
    expect(open.partner("kakariko-well-drop", "bat-cave-right")).toEqual([
      "kakariko-well-cave",
      "bat-cave-exit",
    ]);
    expect(open.partner("kakariko-well-cave", "bat-cave-exit")).toEqual([
      "kakariko-well-drop",
      "bat-cave-right",
    ]);
    expect(open.partner("kakariko-shop", "blinds-hideout")).toBeUndefined();
  });

  it("holds a real Crosskeys seed: every entrance it shuffled, every target", () => {
    expect(seed.meta.shuffle).toBe("crossed");
    const pool = new Set(open.entrances.map((e) => e.name));
    // Link's House and the Tavern's back door stay; the house's Chris
    // Houlihan room is a way out, never in
    const fixed = new Set(["Links House", "Tavern North"]);
    const mapped = seed.entrances.filter(
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
      const partner = open.partner(entrance, target);
      if (partner !== undefined)
        expect(noted.get(partner[0]), entrance).toBe(partner[1]);
    }
  });
});

describe("the full shuffle", () => {
  const crossed = crossedPool("open");
  const full = fullPool("open");

  const targets = (pool: CrossedPool, id: string) =>
    pool.targetsOf.get(id)?.map((t) => t.id) ?? [];
  const OLD_MAN = [
    "old-man-house-exit-bottom",
    "old-man-house-exit-top",
    "old-man-cave-exit-east",
    "old-man-cave-exit-west",
  ];
  const doorIn = (world: "light" | "dark") => {
    const found = crossed.entrances.find(
      (e) =>
        e.world === world &&
        e.kind === "door" &&
        targets(crossed, e.id).includes("old-man-house-exit-bottom"),
    );
    if (found === undefined) throw new Error("no door");
    return found.id;
  };

  it("mixes the same doors and holes as the crossed one", () => {
    // Both draw on the same tables, scramble_holes and Skull Woods
    // (EntranceShuffle.py:260-364, 365-440)
    for (const mode of ["open", "standard"] as const)
      expect(fullPool(mode).entrances.map((e) => e.id)).toEqual(
        crossedPool(mode).entrances.map((e) => e.id),
      );
  });

  it("keeps the Light World's places out of a Dark World door", () => {
    const dark = doorIn("dark");
    const light = doorIn("light");
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
    const mapped = seed.entrances.filter(
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

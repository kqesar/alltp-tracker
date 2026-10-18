import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { holeAt, pythonLiteral } from "../scripts/import-er.mjs";
import {
  crossedPool,
  ENTRANCES,
  entranceNamed,
  labelOf,
  TARGETS,
  targetNamed,
} from "./entrances";
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
    expect(() => pythonLiteral("[a + b]")).toThrow(/<text>:1: unexpected "\+"/);
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
  });
});

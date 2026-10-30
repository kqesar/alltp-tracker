import { describe, expect, it } from "vitest";
import manifest from "../../upstream.json" with { type: "json" };
import connections from "./owr/connections.json" with { type: "json" };
import doorData from "./owr/doors.json" with { type: "json" };
import overworld from "./owr/overworld.json" with { type: "json" };
import regionData from "./owr/regions.json" with { type: "json" };
import drRegionData from "./world/regions.json" with { type: "json" };

type Pair = readonly [string, string];
type Table = { line: number; value: unknown };

const { regions, dungeons } = regionData;
const { doors, portals } = doorData;
const regionNamed = new Map(regions.map((region) => [region.name, region]));
const exitsOf = new Map(
  regions.flatMap((region) => region.exits.map((exit) => [exit, region.name])),
);

const table = (file: string, name: string): Table => {
  const found = (
    connections as unknown as Record<string, Record<string, Table>>
  )[file]?.[name];
  if (found === undefined) throw new Error(`no ${file} ${name}`);
  return found;
};
const pairs = (file: string, name: string): Pair[] => {
  const { value } = table(file, name);
  return (
    Array.isArray(value) ? value : Object.entries(value as object)
  ) as Pair[];
};

const DOOR_SHUFFLE = "DoorShuffle.py";
const ENTRANCES = "source/overworld/EntranceShuffle2.py";
const OVERWORLD = "OverworldShuffle.py";

/**
 * The tables the Overworld fork links a vanilla world with, and how:
 * link_overworld (owr:OverworldShuffle.py:21-583: mandatory, each tile's
 * ow_connections as it stands or flipped, the whirlpools, the edges' default
 * pairs), link_entrances_new's vanilla path (owr:EntranceShuffle2.py:50-200)
 * and DR's link_doors_prep.
 */
const LINKS: readonly [string, string, "region" | "twoWay" | "oneWay"][] = [
  [OVERWORLD, "mandatory_connections", "region"],
  [OVERWORLD, "default_connections", "twoWay"],
  [ENTRANCES, "mandatory_connections", "region"],
  [ENTRANCES, "entrance_map", "twoWay"],
  [ENTRANCES, "drop_map", "region"],
  [ENTRANCES, "single_entrance_map", "region"],
  [DOOR_SHUFFLE, "logical_connections", "region"],
  [DOOR_SHUFFLE, "vanilla_logical_connections", "region"],
  [DOOR_SHUFFLE, "falldown_pits", "region"],
  [DOOR_SHUFFLE, "dungeon_warps", "region"],
  [DOOR_SHUFFLE, "spiral_staircases", "twoWay"],
  [DOOR_SHUFFLE, "straight_staircases", "twoWay"],
  [DOOR_SHUFFLE, "open_edges", "twoWay"],
  [DOOR_SHUFFLE, "ladders", "twoWay"],
  [DOOR_SHUFFLE, "interior_doors", "twoWay"],
  [DOOR_SHUFFLE, "default_door_connections", "twoWay"],
  [DOOR_SHUFFLE, "default_one_way_connections", "oneWay"],
];

/** Each tile's links: as the tile stands, and flipped (ow_connections). */
const tileLinks = Object.values(
  table(OVERWORLD, "ow_connections").value as Record<string, Pair[][]>,
).flat(2);

/** The whirlpools: ((screen, exit, region), (screen, exit, region)) pairs. */
const whirlpools = (
  table(OVERWORLD, "default_whirlpool_connections").value as [
    [number, string, string],
    [number, string, string],
  ][]
).flat();

describe("the Overworld Randomizer's world data (import-dr --owr)", () => {
  it("holds every region its Regions.py makes, by kind", () => {
    const count = (type: string) =>
      regions.filter((region) => region.type === type).length;
    // DR's 578 dungeon regions, and a boss's spoils apart from its fight
    // (owr:Regions.py:492-493, …): 11 more
    expect([
      count("dungeon"),
      count("menu"),
      count("lw"),
      count("dw"),
      count("cave"),
    ]).toEqual([589, 2, 118, 101, 123]);
    expect(regions.filter((region) => "crystalSwitch" in region)).toHaveLength(
      55,
    );
    expect(new Set(regions.map((region) => region.id)).size).toBe(
      regions.length,
    );
    expect(regionNamed.size).toBe(regions.length);
    // Not one list by mode: the fork creates Zelda's spots in every mode
    expect(regions.filter((region) => "locationModes" in region)).toEqual([]);
  });

  it("splits each boss's spoils from its fight", () => {
    const spoils = regions.filter((region) => region.name.endsWith(" Spoils"));
    expect(spoils.map((region) => region.dungeon)).toEqual(
      expect.arrayContaining(["Eastern Palace", "Turtle Rock"]),
    );
    expect(spoils).toHaveLength(10);
    expect(regionNamed.get("Eastern Boss Spoils")?.locations).toEqual([
      "Eastern Palace - Boss",
      "Eastern Palace - Prize",
      "Eastern Palace - Boss Kill",
    ]);
    // DR's own world keeps them in the boss's room
    expect(
      drRegionData.regions.find((region) => region.name === "Eastern Boss")
        ?.locations,
    ).toEqual(["Eastern Palace - Boss", "Eastern Palace - Prize"]);
  });

  it("names each dungeon's prize where the fork lists its addresses", () => {
    expect(
      dungeons.map((dungeon) => [dungeon.name, dungeon.prize]),
    ).toContainEqual(["Thieves Town", "Thieves' Town - Prize"]);
    expect(
      dungeons.filter((dungeon) => dungeon.prize !== null).map((d) => d.prize),
    ).toHaveLength(10);
    for (const { prize } of dungeons)
      if (prize !== null)
        expect(regions.some((r) => r.locations.includes(prize))).toBe(true);
  });

  it("holds every door its Doors.py makes, each an exit of one region", () => {
    expect(doors).toHaveLength(1211);
    expect(new Set(doors.map((door) => door.name)).size).toBe(doors.length);
    expect(doors.filter((door) => !exitsOf.has(door.name))).toEqual([]);
    expect(portals).toHaveLength(25);
  });

  it("keeps the Zelda event of each branch with its branch", () => {
    const events = doors.flatMap((door) =>
      (("conditional" in door ? door.conditional : undefined) ?? [])
        .filter((c) => c.field === "event")
        .map((c) => [door.name, c.value, /Thieves Blind/.test(c.when)]),
    );
    expect(events).toEqual([
      ["Hyrule Castle Throne Room Tapestry", "Suspicious Maiden", true],
      ["Hyrule Castle Throne Room Tapestry", "Zelda Pickup", true],
      ["Hyrule Castle Tapestry Backwards", "Suspicious Maiden", true],
      ["Hyrule Castle Tapestry Backwards", "Zelda Pickup", true],
    ]);
  });

  it("names, in each table, its exits and regions", () => {
    const unknown: string[] = [];
    for (const [file, name, kind] of LINKS) {
      for (const [from, to] of pairs(file, name)) {
        if (!exitsOf.has(from)) unknown.push(`${name}: ${from}`);
        const target = kind === "region" ? regionNamed : exitsOf;
        if (!target.has(to)) unknown.push(`${name}: ${to}`);
      }
    }
    for (const [exit, region] of tileLinks) {
      if (!exitsOf.has(exit)) unknown.push(`ow_connections: ${exit}`);
      if (!regionNamed.has(region)) unknown.push(`ow_connections: ${region}`);
    }
    for (const [, exit, region] of whirlpools) {
      if (!exitsOf.has(exit)) unknown.push(`whirlpools: ${exit}`);
      if (!regionNamed.has(region)) unknown.push(`whirlpools: ${region}`);
    }
    expect(unknown).toEqual([]);
    expect(whirlpools).toHaveLength(8);
  });

  it("links every exit, but those the fork links in code", () => {
    const linked = new Set<string>();
    for (const [file, name, kind] of LINKS) {
      for (const [from, to] of pairs(file, name)) {
        linked.add(from);
        if (kind === "twoWay") linked.add(to);
      }
    }
    for (const [exit] of tileLinks) linked.add(exit);
    for (const [, exit] of whirlpools) linked.add(exit);
    for (const portal of portals) linked.add(portal.door);
    for (const [, [, , enter]] of pairs(
      DOOR_SHUFFLE,
      "portal_map",
    ) as unknown as [string, [string, string, string]][])
      linked.add(enter);
    for (const door of doors) if ("controller" in door) linked.add(door.name);
    const farSides = new Set(
      pairs(DOOR_SHUFFLE, "default_one_way_connections").map(([, to]) => to),
    );
    const unlinked = [...exitsOf.keys()].filter(
      (exit) => !linked.has(exit) && !farSides.has(exit),
    );
    expect(unlinked).toEqual([
      // link_overworld's save points, by start (owr:OverworldShuffle.py:184-197)
      "Links House S&Q",
      "Sanctuary S&Q",
      "Other World S&Q",
      // shuffle_flute_spots, by spot (owr:FluteShuffle.py:36-49)
      ...Array.from({ length: 8 }, (_, i) => `Flute Spot ${i + 1}`),
      // do_vanilla_connections and after it (owr:EntranceShuffle2.py:
      // 159-163, 188-199): by name, or for a start in the dark world
      "Chris Houlihan Room Exit",
      "Dark Sanctuary Hint Exit",
      "Big Bomb Shop Exit",
      // Removed below door intensity 3 (owr:DoorShuffle.py:83)
      "Sanctuary Mirror Route",
    ]);
  });

  it("gives each overworld region its screen, and each edge its parallel", () => {
    const tiles = overworld.tiles as Record<string, number>;
    const ow = regions.filter((r) => r.type === "lw" || r.type === "dw");
    // Every screen region but the cliffs, which only the overworld
    // glitches reach (owr:OverworldGlitchRules.py:354-355)
    expect(ow.filter((r) => !(r.name in tiles)).map((r) => r.name)).toEqual([
      "Eastern Cliff",
      "Central Cliffs",
      "Desert Northern Cliffs",
      "Darkness Cliff",
      "Dark Central Cliffs",
      "Mire Northern Cliffs",
    ]);
    for (const name of Object.keys(tiles))
      expect(regionNamed.has(name), name).toBe(true);
    // A dark world screen is its light one's + 0x40 (OWEdges.py)
    for (const [name, screen] of Object.entries(tiles))
      if (screen < 0x80)
        expect(regionNamed.get(name)?.type, name).toBe(
          screen >= 0x40 ? "dw" : "lw",
        );
    const edges = new Map(overworld.edges.map((edge) => [edge.name, edge]));
    expect(edges.size).toBe(282);
    for (const edge of overworld.edges) {
      expect(exitsOf.has(edge.name), edge.name).toBe(true);
      if ("parallel" in edge)
        expect(edges.get(edge.parallel as string)?.screen).toBe(
          (edge.screen + 0x40) % 0x80,
        );
    }
  });

  it("gives each flute spot its region as the screen stands or flipped", () => {
    const flute = overworld.flute as unknown as Record<
      string,
      { regions: [string, string]; slot: number }
    >;
    expect(Object.keys(flute)).toHaveLength(40);
    for (const [screen, { regions, slot }] of Object.entries(flute)) {
      const [light, dark] = regions;
      expect(regionNamed.get(light)?.type, screen).toBe("lw");
      expect(regionNamed.get(dark)?.type, screen).toBe("dw");
      expect(slot, screen).toBeGreaterThanOrEqual(0);
    }
    // The slots order the spots (sort_flute_spots, FluteShuffle.py:657):
    // the Desert ledge's is 0x38, below its screen's
    expect(flute["48"]?.slot).toBe(0x38);
    expect(flute["3"]?.slot).toBe(0x0b);
    // The vanilla spots (FluteShuffle.py default_flute_connections)
    expect(
      table("source/overworld/FluteShuffle.py", "default_flute_connections")
        .value,
    ).toEqual([0x03, 0x16, 0x18, 0x2c, 0x2f, 0x30, 0x3b, 0x3f]);
  });

  it("reads the bonk drops with their regions and overworld flags", () => {
    const tiles = overworld.tiles as Record<string, number>;
    expect(overworld.bonk).toHaveLength(42);
    for (const drop of overworld.bonk) {
      expect(regionNamed.has(drop.region), drop.name).toBe(true);
      if ("flag" in drop && drop.flag !== undefined)
        expect(drop.flag.screen).toBe(tiles[drop.region]);
    }
    // The cave's statue has no screen: MultiClient.py:980-985 reads none
    expect(
      overworld.bonk.filter((drop) => !("flag" in drop)).map((d) => d.name),
    ).toEqual(["Cold Fairy Statue"]);
    expect(overworld.bonk.filter((drop) => drop.aga)).toHaveLength(8);
    // Each (screen, mask) once
    const flags = overworld.bonk.flatMap((drop) =>
      "flag" in drop && drop.flag !== undefined
        ? [`${drop.flag.screen}:${drop.flag.mask}`]
        : [],
    );
    expect(new Set(flags).size).toBe(flags.length);
  });

  it("cites a line for every region, door, edge and drop", () => {
    for (const entry of [...regions, ...doors, ...portals])
      expect(entry.source).toMatch(/^(Regions|Doors)\.py:\d+$/);
    for (const edge of overworld.edges)
      expect(edge.source).toMatch(/^OWEdges\.py:\d+$/);
    for (const drop of overworld.bonk)
      expect(drop.source).toMatch(/^Regions\.py:\d+$/);
    expect(regionData.upstream).toMatchObject({
      repo: "codemann8/ALttPDoorRandomizer",
      version: "0.8.0.2",
    });
    expect(overworld.upstream).toEqual(regionData.upstream);
    // The pin and the data move together
    expect(regionData.upstream).toMatchObject({
      commit: manifest.doorRandomizer.overworld.commit,
      door: manifest.doorRandomizer.overworld.door,
      version: manifest.doorRandomizer.overworld.version,
    });
  });
});

import { describe, expect, it } from "vitest";
import connections from "./world/connections.json" with { type: "json" };
import doorData from "./world/doors.json" with { type: "json" };
import regionData from "./world/regions.json" with { type: "json" };

type Pair = readonly [string, string];
type Table = { line: number; value: unknown };

const { regions, dungeons } = regionData;
const { doors, portals } = doorData;
const exitsOf = new Map(
  regions.flatMap((region) => region.exits.map((exit) => [exit, region.name])),
);
const regionNames = new Set(regions.map((region) => region.name));

const table = (file: string, name: string): Table => {
  const tables = (
    connections as unknown as Record<string, Record<string, Table>>
  )[file];
  const found = tables?.[name];
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
 * The tables the vanilla world is linked with, and how each links: an exit
 * to a region, two exits both ways, or an exit to another exit's region.
 * link_overworld (OverworldShuffle.py:5-20), link_entrances_new's vanilla
 * path (EntranceShuffle2.py:45-88, do_vanilla_connections :162-170) and
 * link_doors_prep (DoorShuffle.py:60-133).
 */
const LINKS: readonly [string, string, "region" | "twoWay" | "oneWay"][] = [
  [OVERWORLD, "mandatory_connections", "region"],
  [OVERWORLD, "open_mandatory_connections", "region"],
  [OVERWORLD, "inverted_mandatory_connections", "region"],
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

describe("the Door Randomizer's world data (import-dr, stage A)", () => {
  it("holds every region Regions.py makes, by kind", () => {
    const count = (type: string) =>
      regions.filter((region) => region.type === type).length;
    expect(count("dungeon")).toBe(578);
    expect(regions.length - count("dungeon")).toBe(335);
    expect([count("menu"), count("lw"), count("dw"), count("cave")]).toEqual([
      2, 114, 98, 121,
    ]);
    expect(regions.filter((region) => "crystalSwitch" in region)).toHaveLength(
      55,
    );
    expect(new Set(regions.map((region) => region.id)).size).toBe(
      regions.length,
    );
    expect(regionNames.size).toBe(regions.length);
  });

  it("puts each dungeon region in a dungeon, but the sewers' drop", () => {
    expect(dungeons.map((dungeon) => dungeon.name)).toHaveLength(13);
    expect(
      regions
        .filter((region) => region.type === "dungeon" && !region.dungeon)
        .map((region) => region.name),
    ).toEqual(["Sewer Drop"]);
  });

  it("reads a list that differs by mode for each mode", () => {
    expect(
      regions.flatMap((region) =>
        "locationModes" in region ? [region.locationModes] : [],
      ),
    ).toEqual([
      { "Zelda Pickup": ["standard"] },
      { "Zelda Drop Off": ["standard"] },
    ]);
  });

  it("holds every door Doors.py makes, each an exit of one region", () => {
    expect(doors).toHaveLength(1200);
    expect(new Set(doors.map((door) => door.name)).size).toBe(1200);
    expect(doors.filter((door) => !exitsOf.has(door.name))).toEqual([]);
    const count = (flag: string) => doors.filter((door) => flag in door).length;
    expect({
      bigKey: count("bigKey"),
      smallKey: count("smallKey"),
      trapped: count("trapped"),
    }).toEqual({ bigKey: 16, smallKey: 116, trapped: 39 });
    // 117 barriers and 63 switches; the 64 trap flags are layout
    expect(
      doors.filter((door) => "crystal" in door && door.crystal === "either"),
    ).toHaveLength(63);
    expect(doors.filter((door) => "crystal" in door)).toHaveLength(180);
    expect(portals).toHaveLength(25);
    for (const portal of portals)
      expect(doors.find((door) => door.name === portal.door)).toMatchObject({
        entranceFlag: true,
        portal: portal.name,
      });
  });

  it("keeps a flag set under a condition with its condition", () => {
    const conditional = doors.flatMap((door) =>
      "conditional" in door && door.conditional !== undefined
        ? door.conditional.map((c) => [door.name, c.field, c.when])
        : [],
    );
    expect(conditional).toEqual([
      [
        "Hyrule Castle Throne Room Tapestry",
        "event",
        "world.mode[player] == 'standard'",
      ],
      [
        "Hyrule Castle Tapestry Backwards",
        "event",
        "world.mode[player] == 'standard'",
      ],
      [
        "Sanctuary S",
        "lwRestricted",
        "world.mode[player] == 'open' and world.shuffle[player] not in ['lean', 'swapped', 'crossed', 'insanity']",
      ],
      ["PoD Mimics 2 SW", "dead", "world.intensity[player] == 1"],
    ]);
  });

  it("names, in each table the vanilla world links, its exits and regions", () => {
    const unknown: string[] = [];
    for (const [file, name, kind] of LINKS) {
      for (const [from, to] of pairs(file, name)) {
        if (!exitsOf.has(from)) unknown.push(`${name}: ${from}`);
        const target = kind === "region" ? regionNames : exitsOf;
        if (!target.has(to)) unknown.push(`${name}: ${to}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("links every exit, but the doors the vanilla world never leaves by", () => {
    const linked = new Set<string>();
    for (const [file, name, kind] of LINKS) {
      for (const [from, to] of pairs(file, name)) {
        linked.add(from);
        if (kind === "twoWay") linked.add(to);
      }
    }
    // Portals: the lobby's door out, and the entrance in (connect_portal,
    // DoorShuffle.py:739-752)
    for (const portal of portals) linked.add(portal.door);
    for (const [, [, , enter]] of pairs(
      DOOR_SHUFFLE,
      "portal_map",
    ) as unknown as [string, [string, string, string]][])
      linked.add(enter);
    // A door its controller's link connects (connect_two_way, DoorShuffle.py:447-452)
    for (const door of doors) if ("controller" in door) linked.add(door.name);
    // A one-way door's far side leads nowhere back: Sanctuary's from the
    // sewers, each boss room's door
    const farSides = new Set(
      pairs(DOOR_SHUFFLE, "default_one_way_connections").map(([, to]) => to),
    );
    const unlinked = [...exitsOf.keys()].filter(
      (exit) => !linked.has(exit) && !farSides.has(exit),
    );
    expect(unlinked).toEqual([
      // do_vanilla_connections links it by name (EntranceShuffle2.py:162-165)
      "Chris Houlihan Room Exit",
      // Inverted's sanctuary: inverted_default_connections, read by
      // do_vanilla_connect's pools (EntranceShuffle2.py:1073)
      "Dark Sanctuary Hint Exit",
      // Removed from the world below door intensity 3 (DoorShuffle.py:84-90)
      "Sanctuary Mirror Route",
    ]);
    expect(farSides.size).toBe(13);
  });

  it("cites a line for every region, door and table", () => {
    for (const entry of [...regions, ...doors, ...portals])
      expect(entry.source).toMatch(/^(Regions|Doors)\.py:\d+$/);
    for (const [file, tables] of Object.entries(connections)) {
      if (file === "generated" || file === "upstream") continue;
      for (const { line } of Object.values(tables as Record<string, Table>))
        expect(line).toBeGreaterThan(0);
    }
    expect(regionData.upstream.commit).toBe(doorData.upstream.commit);
  });
});

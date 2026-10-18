// The overworld's entrances, and where a shuffled one may lead: the tables of
// the entrance randomizer vt hands such seeds to
// (cassidoxa/ALttPEntranceRandomizer, imported by scripts/import-er.mjs into
// entrances/er.json, never edited by hand).
//
// An entrance is a door or a hole of the overworld. Where Link comes out of a
// door is its position (door_addresses: its area and Link's coordinates in
// the world, 4096 pixels a side); a hole's is read from the base ROM's hole
// table. A target is what an entrance may lead to:
// - a side of a dungeon or of a connector cave (several doors, one inside),
//   by the exit the randomizer names it with: "Elder House Exit (East)";
// - a place with a single door: a shop, a house, a fairy (Single_Cave_Targets);
// - where a hole drops: "Kakariko Well (top)".
// Its place groups a dungeon's or a cave's sides, which the player knows by
// one name; its label spells the names as the game does (Blind's Hideout).
//
// The crossed shuffle is what alttpr.com runs for Crosskeys (vt passes
// --shuffle crossed; the randomizer shuffles Ganon's Tower by default,
// EntranceRandomizer.py:228): crossedPool says which entrances it shuffles
// and which targets it shuffles them with (EntranceShuffle.py:365-460,
// scramble_holes, skull_woods_shuffle).

import er from "./entrances/er.json" with { type: "json" };
import { locationId } from "./location";
import { MAP_LOCATIONS } from "./markers";

/** Where a table, a hole list or a door's position was read in the source. */
const at = (line: number) => `EntranceShuffle.py:${line}`;

/** One of the overworld's doors or holes. */
export interface OverworldEntrance {
  /** The slug of its name: "kakariko-shop". */
  readonly id: string;
  /** The randomizer's name for it: "Kakariko Shop". */
  readonly name: string;
  /** Its name as the game spells it: "Kakariko Shop", "Blind's Hideout". */
  readonly label: string;
  readonly world: "light" | "dark";
  /** Percent of the map's width: the Light World is 0-50, the Dark 50-100. */
  readonly x: number;
  /** Percent of the map's height. */
  readonly y: number;
  readonly kind: "door" | "hole";
  /** Where its position was read. */
  readonly source: string;
}

/** What a shuffled entrance may lead to. */
export interface EntranceTarget {
  /** The slug of its name: "elder-house-exit-east", "blinds-hideout". */
  readonly id: string;
  /** The randomizer's name: the exit, the region or the drop. */
  readonly name: string;
  /** The dungeon or the place, which the player knows it by: "Elder House". */
  readonly place: string;
  /** Which of its doors or drops, when it has several: "East". */
  readonly side?: string;
  readonly kind: "dungeon" | "connector" | "single" | "drop";
}

/** A door's or hole's position, in the world's pixels. */
type Position = {
  readonly area: number;
  readonly x: number;
  readonly y: number;
  readonly hole?: boolean;
};

const DOORS = er.doors.value as Readonly<Record<string, Position>>;

/** Words the randomizer writes without their apostrophe. */
const POSSESSIVES: Readonly<Record<string, string>> = {
  Agahnims: "Agahnim's",
  Aginahs: "Aginah's",
  Blacksmiths: "Blacksmith's",
  Blinds: "Blind's",
  Ganons: "Ganon's",
  Kids: "Kid's",
  Kings: "King's",
  Links: "Link's",
  Sahasrahlas: "Sahasrahla's",
};

/** A name as the game spells it. */
export const labelOf = (name: string): string =>
  name
    .split(" ")
    .map((word) => POSSESSIVES[word] ?? word)
    .join(" ");

/** A name's slug, as a location's: "Elder House Exit (East)" → its id. */
const slug = (name: string) => locationId(name);

/** Every entrance with a position, in door_addresses order. */
export const ENTRANCES: readonly OverworldEntrance[] = Object.entries(
  DOORS,
).map(([name, { area, hole, x, y }]) => {
  const dark = area >= 0x40;
  return {
    id: slug(name),
    kind: hole ? "hole" : "door",
    label: labelOf(name),
    name,
    source: hole
      ? "the base ROM's hole table (import-er.mjs)"
      : at(er.doors.line),
    world: dark ? "dark" : "light",
    // Each world is 4096 pixels a side, drawn side by side on the map
    x: Math.round(((dark ? 50 : 0) + (x / 4096) * 50) * 10) / 10,
    y: Math.round((y / 4096) * 100 * 10) / 10,
  };
});

const ENTRANCE_BY_NAME = new Map(ENTRANCES.map((e) => [e.name, e]));

/** An entrance by its randomizer name; throws on one it does not know. */
export const entranceNamed = (name: string): OverworldEntrance => {
  const found = ENTRANCE_BY_NAME.get(name);
  if (found === undefined) throw new RangeError(`No entrance "${name}"`);
  return found;
};

type Table = string | readonly string[];
const table = (name: keyof typeof er.tables) =>
  er.tables[name].value as readonly Table[];
const flat = (rows: readonly Table[]): string[] =>
  rows.flatMap((row) => (typeof row === "string" ? [row] : [...row]));

/** The dungeons, as the randomizer's exits start their names. */
const DUNGEONS = [
  "Agahnims Tower",
  "Desert Palace",
  "Eastern Palace",
  "Ganons Tower",
  "Hyrule Castle",
  "Ice Palace",
  "Misery Mire",
  "Palace of Darkness",
  "Skull Woods",
  "Swamp Palace",
  "Thieves Town",
  "Tower of Hera",
  "Turtle Rock",
] as const;

/** "Elder House Exit (East)": the place before " Exit", the side after it. */
function exitParts(name: string): { place: string; side?: string } {
  const [, base = name, paren] = /^(.*?) Exit(?: \((.*)\))?$/.exec(name) ?? [];
  const dungeon = DUNGEONS.find((d) => base === d || base.startsWith(`${d} `));
  const place = dungeon ?? base;
  const rest = base.slice(place.length).trim();
  const side = [rest, paren].filter(Boolean).join(" ");
  return side === "" ? { place } : { place, side };
}

/** "Kakariko Well (top)": the place before the bracket, the side in it. */
function dropParts(name: string): { place: string; side?: string } {
  // The sewers below Sanctuary's grave are Hyrule Castle's escape
  if (name === "Sewer Drop") return { place: "Hyrule Castle", side: "Sewers" };
  const [, base = name, paren] = /^(.*?)(?: \((.*)\))?$/.exec(name) ?? [];
  const dungeon = DUNGEONS.find((d) => base.startsWith(`${d} `));
  if (dungeon === undefined)
    return paren === undefined ? { place: base } : { place: base, side: paren };
  const rest = base.slice(dungeon.length).trim();
  return {
    place: dungeon,
    side: [rest, paren && `(${paren})`].filter(Boolean).join(" "),
  };
}

const target = (
  name: string,
  kind: EntranceTarget["kind"],
  parts: { place: string; side?: string },
): EntranceTarget => ({
  id: slug(name),
  kind,
  name,
  place: labelOf(parts.place),
  ...(parts.side === undefined ? {} : { side: parts.side }),
});

const holeTargets = er.holes.targets.value as unknown as readonly (readonly [
  string,
  string,
])[];
const [skullHoles, skullHoleTargets] = er.skullWoods.holes
  .value as unknown as readonly [readonly string[], readonly string[]];
const [skullDoors, skullDoorTargets] = er.skullWoods.doors
  .value as unknown as readonly [readonly string[], readonly string[]];
const holeEntrances = er.holes.entrances
  .value as unknown as readonly (readonly [string, string])[];

/**
 * Every target of the crossed shuffle, dungeons first, then the connector
 * caves, the single doors and the drops, each in the source's order.
 */
export const TARGETS: readonly EntranceTarget[] = [
  ...[
    ...flat(table("Dungeon_Exits_Base")),
    // Added by the shuffle itself, outside the table (EntranceShuffle.py:
    // 383-390): the castle's three doors and Ganon's Tower
    "Hyrule Castle Exit (South)",
    "Hyrule Castle Exit (West)",
    "Hyrule Castle Exit (East)",
    "Ganons Tower Exit",
    ...skullDoorTargets,
  ].map((name) => target(name, "dungeon", exitParts(name))),
  // Sanctuary is the escape's last room (its exit, Hyrule Castle's side)
  target("Sanctuary Exit", "dungeon", {
    place: "Hyrule Castle",
    side: "Sanctuary",
  }),
  ...[
    ...flat(table("Cave_Exits_Base")),
    ...flat(table("Cave_Three_Exits_Base")),
    ...flat(table("Old_Man_House_Base")),
    // The Old Man's cave, placed on its own (EntranceShuffle.py:412, 437)
    "Old Man Cave Exit (East)",
    "Old Man Cave Exit (West)",
    // The caves a hole drops into, each with one door
    ...holeTargets.map(([exit]) => exit),
    "Hyrule Castle Secret Entrance Exit",
    "Pyramid Exit",
  ].map((name) => target(name, "connector", exitParts(name))),
  ...[
    ...table("Single_Cave_Targets").map(String),
    // Placed among the doors that may take them (EntranceShuffle.py:419-431)
    "Blacksmiths Hut",
    "Big Bomb Shop",
  ].map((name) => target(name, "single", { place: name })),
  ...[
    ...holeTargets.map(([, drop]) => drop),
    "Hyrule Castle Secret Entrance",
    "Sewer Drop",
    "Pyramid",
    ...skullHoleTargets,
  ].map((name) => target(name, "drop", dropParts(name))),
];

const TARGET_BY_NAME = new Map(TARGETS.map((t) => [t.name, t]));

/** A target by its randomizer name; throws on one it does not know. */
export const targetNamed = (name: string): EntranceTarget => {
  const found = TARGET_BY_NAME.get(name);
  if (found === undefined) throw new RangeError(`No target "${name}"`);
  return found;
};

/**
 * The caves a hole drops into, by their door's exit and the hole's drop:
 * scramble_holes shuffles each pair as one (EntranceShuffle.py:1814-1849),
 * with Sanctuary's in the crossed shuffle (:1838-1839) and the Pyramid's as
 * Ganon's Tower is shuffled (:1820-1825).
 */
const HOLE_CAVES: readonly (readonly [exit: string, drop: string])[] = [
  ...holeTargets,
  ["Hyrule Castle Secret Entrance Exit", "Hyrule Castle Secret Entrance"],
  ["Sanctuary Exit", "Sewer Drop"],
  ["Pyramid Exit", "Pyramid"],
];

/** What the crossed shuffle mixes, for a run's world. */
export interface CrossedPool {
  /** The entrances it shuffles: doors, then holes. */
  readonly entrances: readonly OverworldEntrance[];
  /**
   * Each hole's door: the two lead into the same cave (scramble_holes), so
   * one known tells the other.
   */
  readonly holeDoors: ReadonlyMap<string, string>;
  /**
   * What each entrance may lead to, by id: a hole to a drop, the door of a
   * cave a hole drops into to such a cave's exit, Skull Woods' doors and
   * holes among their own, any other door to the rest.
   */
  readonly targetsOf: ReadonlyMap<string, readonly EntranceTarget[]>;
  /**
   * The other entrance a note settles, and its target: a hole and its
   * cave's door lead into the same cave, the one by its drop, the other by
   * its exit. Undefined for any other entrance.
   */
  partner(
    entrance: string,
    target: string,
  ): readonly [entrance: string, target: string] | undefined;
}

/**
 * The entrances alttpr.com's crossed shuffle mixes in an Open or Standard
 * world (EntranceShuffle.py:365-460). Standard keeps the castle's front door
 * and its secret passage for the escape (:379-381, scramble_holes).
 * Inverted runs its own tables, not ported yet.
 */
export function crossedPool(mode: "open" | "standard"): CrossedPool {
  const doors = [
    ...table("LW_Entrances"),
    ...table("LW_Dungeon_Entrances"),
    ...table("LW_Single_Cave_Doors"),
    ...table("Old_Man_Entrances"),
    ...table("DW_Entrances"),
    ...table("DW_Dungeon_Entrances"),
    ...table("DW_Single_Cave_Doors"),
    ...table("DW_Entrances_Must_Exit"),
    ...table("DW_Dungeon_Entrances_Must_Exit"),
    ...table("LW_Dungeon_Entrances_Must_Exit"),
    ...(mode === "open" ? ["Hyrule Castle Entrance (South)"] : []),
    "Ganons Tower",
    // The doors of the caves holes drop into, and Skull Woods' own doors
    ...holeEntrances.map(([door]) => door),
    ...(mode === "open" ? ["Hyrule Castle Secret Entrance Stairs"] : []),
    "Pyramid Entrance",
    ...skullDoors,
  ].map(String);
  const holes = [
    ...holeEntrances.map(([, hole]) => hole),
    ...(mode === "open" ? ["Hyrule Castle Secret Entrance Drop"] : []),
    "Pyramid Hole",
    ...skullHoles,
  ];
  const holeDoors = new Map<string, string>(
    [
      ...holeEntrances.map(([door, hole]) => [hole, door] as const),
      ...(mode === "open"
        ? [
            [
              "Hyrule Castle Secret Entrance Drop",
              "Hyrule Castle Secret Entrance Stairs",
            ] as const,
          ]
        : []),
      ["Pyramid Hole", "Pyramid Entrance"] as const,
    ].map(([hole, door]) => [slug(hole), slug(door)]),
  );
  const entrances = [...new Set([...doors, ...holes])].map(entranceNamed);

  // The pairs of holes and doors this world shuffles, and their caves
  const caves = HOLE_CAVES.filter(
    ([exit]) =>
      mode === "open" || exit !== "Hyrule Castle Secret Entrance Exit",
  );
  const exitOfDrop = new Map(
    caves.map(([exit, drop]) => [slug(drop), slug(exit)]),
  );
  const dropOfExit = new Map(
    caves.map(([exit, drop]) => [slug(exit), slug(drop)]),
  );
  const doorOfHole = holeDoors;
  const holeOfDoor = new Map(
    [...holeDoors].map(([hole, door]) => [door, hole]),
  );
  const ids = (names: readonly string[]) => new Set(names.map(slug));
  const skullHoleIds = ids(skullHoles);
  const skullDoorIds = ids(skullDoors);
  const groups = [
    { from: new Set(doorOfHole.keys()), to: ids(caves.map(([, d]) => d)) },
    { from: new Set(holeOfDoor.keys()), to: ids(caves.map(([e]) => e)) },
    { from: skullHoleIds, to: ids(skullHoleTargets) },
    { from: skullDoorIds, to: ids(skullDoorTargets) },
  ];
  const grouped = new Set(groups.flatMap(({ to }) => [...to]));
  // Not this world's: the escape's doors Standard keeps
  const kept = new Set(
    mode === "open"
      ? []
      : [
          "Hyrule Castle Exit (South)",
          "Hyrule Castle Secret Entrance Exit",
          "Hyrule Castle Secret Entrance",
        ].map(slug),
  );
  const targetsOf = new Map(
    entrances.map((entrance) => {
      const group = groups.find(({ from }) => from.has(entrance.id));
      return [
        entrance.id,
        TARGETS.filter((t) =>
          group === undefined
            ? t.kind !== "drop" && !grouped.has(t.id) && !kept.has(t.id)
            : group.to.has(t.id),
        ),
      ];
    }),
  );

  return {
    entrances,
    holeDoors,
    partner: (entrance, target) => {
      const door = doorOfHole.get(entrance);
      const exit = exitOfDrop.get(target);
      if (door !== undefined && exit !== undefined) return [door, exit];
      const hole = holeOfDoor.get(entrance);
      const drop = dropOfExit.get(target);
      if (hole !== undefined && drop !== undefined) return [hole, drop];
      return undefined;
    },
    targetsOf,
  };
}

/**
 * The dungeon a region of it belongs to, where its name does not say:
 * Regions.py's bosses and the escape's sewers (:111-116, 227, 290).
 */
const REGION_PLACES: Readonly<Record<string, string>> = {
  "Agahnim 1": "Agahnims Tower",
  "Agahnim 2": "Ganons Tower",
  "Blind Fight": "Thieves Town",
  Sewers: "Hyrule Castle",
  "Sewers (Dark)": "Hyrule Castle",
};

/**
 * The checks the entrance randomizer names otherwise than vt, whose names
 * the pack's location ids are the slugs of.
 */
const VT_NAMES: Readonly<Record<string, string>> = {
  "Agahnim 1": "Agahnim",
  "Bonk Rock Cave": "Pegasus Rocks",
  "Bumper Cave Ledge": "Bumper Cave",
  "Ganons Tower - Validation Chest": "Ganon's Tower - Moldorm Chest",
  "Graveyard Cave": "Graveyard Ledge",
  "Hype Cave - Generous Guy": "Hype Cave - NPC",
  "Hyrule Castle - Zelda's Chest": "Hyrule Castle - Zelda's Cell",
  "Mini Moldorm Cave - Generous Guy": "Mini Moldorm Cave - NPC",
  "Peg Cave": "Hammer Pegs",
};

/**
 * The pack's id of a check the entrance randomizer names: the slug of its
 * name, or of vt's where they differ (`VT_NAMES`).
 */
export const erLocationId = (name: string): string =>
  slug(VT_NAMES[name] ?? name);

type Region = {
  readonly kind: string;
  readonly name: string;
  readonly locations: readonly string[];
  readonly exits: readonly string[];
};

/**
 * The place a check inside a cave, a house or a dungeon lies in, by the
 * pack's location id: the place a shuffled entrance's target names. Its
 * region's own exit or name tells it, else the place its name starts with.
 * A check behind a door the shuffle keeps (Link's House, the Tavern's back
 * room) has none: it stays where it is. Only the map's checks are kept: a
 * prize or an event (Agahnim, the floodgate) is none.
 */
export const PLACE_OF_LOCATION: ReadonlyMap<string, string> = (() => {
  const places = [...new Set(TARGETS.map((t) => t.place))].sort(
    (a, b) => b.length - a.length,
  );
  const found = new Map<string, string>();
  for (const region of er.regions as readonly Region[]) {
    if (region.kind !== "cave" && region.kind !== "dungeon") continue;
    const label = labelOf(REGION_PLACES[region.name] ?? region.name);
    const place =
      region.exits
        .map((exit) => TARGET_BY_NAME.get(exit)?.place)
        .find(Boolean) ??
      TARGET_BY_NAME.get(region.name)?.place ??
      places.find((p) => label === p || label.startsWith(`${p} `));
    if (place === undefined) continue;
    for (const location of region.locations) {
      const id = erLocationId(location);
      if (MAP_LOCATIONS.has(id)) found.set(id, place);
    }
  }
  return found;
})();

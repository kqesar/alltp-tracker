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
// vt hands the randomizer the shuffle a seed names (--shuffle simple,
// restricted, full or crossed: Crosskeys is crossed; the randomizer shuffles
// Ganon's Tower by default, EntranceRandomizer.py:228). Its rules never ask
// which (Rules.py), so a shuffle is what it mixes and how: entrancePool says
// which entrances it shuffles, which targets each may lead to, and what one
// note settles beside it (EntranceShuffle.py:63-440, scramble_holes,
// skull_woods_shuffle, simple_shuffle_dungeons). The retro world then gives
// five doors that lead to some single caves a take-any cave instead
// (ItemList.py set_up_take_anys).

import type { EntranceLink } from "./autotrack/decode";
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

/**
 * A door's or hole's position, in the world's pixels, and where the game
 * keeps what it loads: a door's slot of its door table, a hole's bytes of
 * its hole table.
 */
type Position = {
  readonly area: number;
  readonly x: number;
  readonly y: number;
  readonly hole?: boolean;
  readonly slot?: number;
  readonly slots?: readonly number[];
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
  // The retro world's alone: the old man's sword cave, then the take-anys,
  // alike but for their number ("Take-Any #1")
  ...er.takeAnys.regions.map(({ name }) => {
    const [, place = name, side] = /^(.*?) #(\d+)$/.exec(name) ?? [];
    return target(
      name,
      "single",
      side === undefined ? { place } : { place: `${place} Cave`, side },
    );
  }),
];

/** The retro world's take-any caves, by id (set_up_take_anys). */
const TAKE_ANYS = new Set(er.takeAnys.regions.map(({ name }) => slug(name)));

/** The caves whose door may lead to a take-any instead, by id. */
const TAKE_ANY_CAVES = new Set(er.takeAnys.caves.value.map(slug));

const TARGET_BY_NAME = new Map(TARGETS.map((t) => [t.name, t]));

/** A target by its randomizer name; throws on one it does not know. */
export const targetNamed = (name: string): EntranceTarget => {
  const found = TARGET_BY_NAME.get(name);
  if (found === undefined) throw new RangeError(`No target "${name}"`);
  return found;
};

/** The randomizer's names for the Inverted world, whose tables are not ported. */
const INVERTED = /^Inverted /;

/** Each door by its slot of the game's door table. */
const DOOR_OF_SLOT = new Map(
  Object.entries(DOORS).flatMap(([name, { hole, slot }]) =>
    hole || slot === undefined || INVERTED.test(name)
      ? []
      : [[slot, slug(name)] as const],
  ),
);

/** Each hole by its bytes of the game's hole table. */
const HOLE_OF_SLOT = new Map(
  Object.entries(DOORS).flatMap(([name, { slots = [] }]) =>
    INVERTED.test(name) ? [] : slots.map((slot) => [slot, slug(name)] as const),
  ),
);

/**
 * The targets each of the game's entrances is, by id (exit_ids), in the
 * order of TARGETS: one, or a few places whose rooms are alike (the healer
 * fairies', some shops' and the fortune tellers'), which the game loads by
 * one entrance.
 */
const TARGETS_OF_ENTRANCE = (() => {
  const exits = er.exits.value as Readonly<
    Record<string, { readonly entrance: number | null }>
  >;
  const found = new Map<number, string[]>();
  for (const { id, name } of TARGETS) {
    const entrance = exits[name]?.entrance;
    if (typeof entrance === "number")
      found.set(entrance, [...(found.get(entrance) ?? []), id]);
  }
  return found;
})();

/** A door or hole the game shows Link went through, and where it leads. */
export interface GameLink {
  /** The entrance's id. */
  readonly entrance: string;
  /** What it leads to, by id: one target, or a few alike. */
  readonly targets: readonly string[];
}

/**
 * Where the game shows Link went (the autotracker's `decodeEntrances`), in
 * the shuffle's ids. A slot or an entrance the tables do not know gives
 * nothing.
 */
export const linksOf = (links: readonly EntranceLink[]): GameLink[] =>
  links.flatMap(({ entrance, kind, slot }) => {
    const id = (kind === "door" ? DOOR_OF_SLOT : HOLE_OF_SLOT).get(slot);
    const targets = TARGETS_OF_ENTRANCE.get(entrance);
    return id === undefined || targets === undefined
      ? []
      : [{ entrance: id, targets }];
  });

/**
 * The caves a hole drops into, by their door's exit and the hole's drop:
 * scramble_holes shuffles each pair as one (EntranceShuffle.py:1806-1849).
 * The Pyramid takes one of them as Ganon's Tower is shuffled (:1820-1825),
 * Sanctuary's among them in the crossed shuffle alone (:1838-1844).
 */
const HOLE_CAVES: readonly (readonly [exit: string, drop: string])[] = [
  ...holeTargets,
  ["Hyrule Castle Secret Entrance Exit", "Hyrule Castle Secret Entrance"],
  ["Sanctuary Exit", "Sewer Drop"],
  ["Pyramid Exit", "Pyramid"],
];

/**
 * The entrance shuffles the pack ports: alttpr.com's but Insanity, which
 * parts a door from its way out. Each is the doors it mixes and how it
 * connects them (EntranceShuffle.py:63-440).
 */
export type ErShuffle = "simple" | "restricted" | "full" | "crossed";

/** What an entrance shuffle mixes, for a run's world. */
export interface EntrancePool {
  /** The shuffle's name: the entrance randomizer's or the Door Randomizer's. */
  readonly shuffle: string;
  /**
   * Whether an exit leads back elsewhere than its door (DR's insanity):
   * coming out of a cave then tells nothing of where its door leads.
   */
  readonly decoupled?: boolean;
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
   * holes among their own, any other door to what its shuffle may give
   * that door.
   */
  readonly targetsOf: ReadonlyMap<string, readonly EntranceTarget[]>;
  /**
   * The other entrances a note settles, each with its target: what the
   * shuffle always connects along with `entrance` led to `target`. A hole
   * and its cave's door; in the simple shuffle, a pair of doors and the
   * two-door cave it takes; in the simple and restricted ones, a four-door
   * dungeon's doors. Empty for any other note.
   */
  partners(
    entrance: string,
    target: string,
  ): readonly (readonly [entrance: string, target: string])[];
  /**
   * The entrances the notes made tell beside themselves, each with its
   * target and the noted entrance that tells it (`DerivedNote`): the
   * Overworld Randomizer's Swapped, whose doors trade targets two by two.
   * Read from the notes, never noted: forgetting the note forgets them.
   * Absent where no note tells an entrance not noted.
   */
  derived?(
    noted: Readonly<Record<string, string>>,
  ): ReadonlyMap<string, DerivedNote>;
}

/** An entrance's target a note tells, by the noted entrance (`from`). */
export interface DerivedNote {
  readonly target: string;
  readonly from: string;
}

/** A table's names, its caves' exits one by one. */
const names = (name: keyof typeof er.tables): string[] =>
  flat(table(name)).map(String);

/** The names of a few tables, as a set. */
const namesIn = (...tables: (keyof typeof er.tables)[]) =>
  new Set(tables.flatMap(names));

/**
 * The dungeons with one door, which the simple and restricted shuffles mix
 * among themselves (simple_shuffle_dungeons, EntranceShuffle.py:2031-2045,
 * Ganon's Tower as it is shuffled).
 */
const ONE_DOOR_DUNGEONS: readonly (readonly [door: string, exit: string])[] = [
  "Eastern Palace",
  "Tower of Hera",
  "Thieves Town",
  "Skull Woods Final Section",
  "Palace of Darkness",
  "Ice Palace",
  "Misery Mire",
  "Swamp Palace",
  "Ganons Tower",
].map((door) => [door, `${door} Exit`]);

/** The dungeons with four doors, as simple_shuffle_dungeons names them. */
type FourDoors = "Desert" | "Hyrule Castle" | "Turtle Rock";

/**
 * Each four-door dungeon's doors, Hyrule Castle's with Agahnim's Tower's
 * (:2064-2110), in the order of FOUR_DOOR_EXITS.
 */
const FOUR_DOORS: Readonly<Record<FourDoors, readonly string[]>> = {
  Desert: [
    "Desert Palace Entrance (South)",
    "Desert Palace Entrance (East)",
    "Desert Palace Entrance (West)",
    "Desert Palace Entrance (North)",
  ],
  "Hyrule Castle": [
    "Hyrule Castle Entrance (South)",
    "Hyrule Castle Entrance (East)",
    "Hyrule Castle Entrance (West)",
    "Agahnims Tower",
  ],
  "Turtle Rock": [
    "Turtle Rock",
    "Turtle Rock Isolated Ledge Entrance",
    "Dark Death Mountain Ledge (West)",
    "Dark Death Mountain Ledge (East)",
  ],
};

const CASTLE_EXITS = [
  "Hyrule Castle Exit (South)",
  "Hyrule Castle Exit (East)",
  "Hyrule Castle Exit (West)",
  "Agahnims Tower Exit",
];
const DESERT_EXITS = [
  "Desert Palace Exit (South)",
  "Desert Palace Exit (East)",
  "Desert Palace Exit (West)",
  "Desert Palace Exit (North)",
];
const TURTLE_ROCK_EXITS = [
  "Turtle Rock Exit (Front)",
  "Turtle Rock Isolated Ledge Exit",
  "Turtle Rock Ledge Exit (West)",
  "Turtle Rock Ledge Exit (East)",
];

/**
 * Where a four-door dungeon placed at another's doors leads each of them,
 * in FOUR_DOORS' order: simple_shuffle_dungeons moves the dungeons whole,
 * by a fixed table (:2064-2110). `[dungeon][at]` is the dungeon's exits
 * behind `at`'s doors.
 */
const FOUR_DOOR_EXITS: Readonly<
  Record<FourDoors, Readonly<Record<FourDoors, readonly string[]>>>
> = {
  Desert: {
    Desert: DESERT_EXITS,
    "Hyrule Castle": DESERT_EXITS,
    "Turtle Rock": DESERT_EXITS,
  },
  "Hyrule Castle": {
    Desert: CASTLE_EXITS,
    "Hyrule Castle": CASTLE_EXITS,
    "Turtle Rock": CASTLE_EXITS,
  },
  "Turtle Rock": {
    Desert: TURTLE_ROCK_EXITS,
    // Its ledges behind the castle's side doors, the isolated ledge behind
    // Agahnim's Tower (:2096-2100)
    "Hyrule Castle": [
      "Turtle Rock Exit (Front)",
      "Turtle Rock Ledge Exit (East)",
      "Turtle Rock Ledge Exit (West)",
      "Turtle Rock Isolated Ledge Exit",
    ],
    "Turtle Rock": TURTLE_ROCK_EXITS,
  },
};

/** A four-door dungeon's door: whose, and which of its four. */
const FOUR_DOOR_AT = new Map(
  (Object.entries(FOUR_DOORS) as [FourDoors, readonly string[]][]).flatMap(
    ([at, doors]) => doors.map((door, index) => [door, { at, index }] as const),
  ),
);

/** The four-door dungeons a world moves: the castle stays in Standard. */
const fourDoorDungeons = (open: boolean): readonly FourDoors[] =>
  open ? ["Desert", "Turtle Rock", "Hyrule Castle"] : ["Desert", "Turtle Rock"];

/** The two-door caves, each as its two exits (Cave_Exits_Base). */
const TWO_DOOR_CAVES = table(
  "Cave_Exits_Base",
) as unknown as readonly (readonly [string, string])[];

/**
 * The simple shuffle's pairs of doors, each of which takes one two-door
 * cave (Two_Door_Caves_Directional, Two_Door_Caves; :76-95): the first
 * door its cave's first exit, the second its second.
 */
const DOOR_PAIRS = [
  ...table("Two_Door_Caves_Directional"),
  ...table("Two_Door_Caves"),
] as unknown as readonly (readonly [first: string, second: string])[];

/** Each door of a pair to the other. */
const OTHER_OF_PAIR = new Map(
  DOOR_PAIRS.flatMap(([first, second]) => [
    [first, second],
    [second, first],
  ]),
);

/**
 * Caves the randomizer keeps as tuples, which unbias_some_entrances leaves
 * in order (it shuffles a cave's exits only when its table holds a list,
 * :2161-2165): Superbunny Cave's and Spiral Cave's (:2262-2263).
 */
const IN_ORDER_CAVES: readonly (readonly [first: string, second: string])[] = [
  ["Superbunny Cave Exit (Bottom)", "Superbunny Cave Exit (Top)"],
  ["Spiral Cave Exit (Top)", "Spiral Cave Exit"],
];

/**
 * The exits a must-exit door never leads to: connect_mandatory_exits gives
 * it a cave's last exit (:1938), so never the first of a two-door tuple
 * (IN_ORDER_CAVES), of Spectacle Rock Cave's tuple only its own exit (:2266,
 * its branch at :1949), and never Turtle Rock's east ledge, which unbias
 * puts first (:2182-2189).
 */
const NEVER_LAST = new Set([
  ...IN_ORDER_CAVES.map(([first]) => first),
  "Spectacle Rock Cave Exit (Peak)",
  "Spectacle Rock Cave Exit (Top)",
  "Turtle Rock Ledge Exit (East)",
]);

/**
 * What each door that is neither a hole's nor Skull Woods' may lead to, by
 * the randomizer's names, in a shuffle: the tables it hands each of its
 * steps (EntranceShuffle.py:63-440). What a Standard world keeps is left to
 * the pool.
 */
function doorTargetsOf(
  shuffle: ErShuffle,
  open: boolean,
): (door: string) => readonly string[] {
  const apart = shuffle === "simple" || shuffle === "restricted";
  const twoDoor = names("Cave_Exits_Base");
  const threeDoor = names("Cave_Three_Exits_Base");
  const oldManHouse = names("Old_Man_House_Base");
  const singles = names("Single_Cave_Targets");
  const oldManWest = "Old Man Cave Exit (West)";
  const oldManEast = "Old Man Cave Exit (East)";
  const oneDoor = new Set(ONE_DOOR_DUNGEONS.map(([door]) => door));
  // The Light World's doors, the only ones that may lead to its caves in
  // the restricted and full shuffles (lw_entrances, lw_must_exits)
  const light = namesIn(
    "LW_Entrances",
    "LW_Dungeon_Entrances",
    "LW_Single_Cave_Doors",
    "Old_Man_Entrances",
    "LW_Dungeon_Entrances_Must_Exit",
  ).add("Hyrule Castle Entrance (South)");
  // Death Mountain's, which the simple shuffle fills last (:98-111)
  const deathMountain = namesIn("LW_Entrances", "Old_Man_Entrances");
  const mustExits = namesIn(
    "DW_Entrances_Must_Exit",
    "DW_Dungeon_Entrances_Must_Exit",
    "LW_Dungeon_Entrances_Must_Exit",
  );
  // The Old Man's way out: one of these doors (:100-104, :155, :319, :402)
  const oldManDoors = new Set([
    ...names("Old_Man_Entrances"),
    ...(apart ? [] : ["Tower of Hera"]),
  ]);
  // The blacksmith's and the bomb shop's doors (:113-125, :162-178,
  // :326-342, :408-421); the bomb shop may take a blacksmith's door left
  const smiths =
    shuffle === "simple"
      ? namesIn("Blacksmith_Single_Cave_Doors")
      : namesIn("Blacksmith_Single_Cave_Doors", "Blacksmith_Multi_Cave_Doors");
  const bombs =
    shuffle === "simple"
      ? namesIn("Bomb_Shop_Single_Cave_Doors", "Blacksmith_Single_Cave_Doors")
      : namesIn(
          "Bomb_Shop_Single_Cave_Doors",
          "Bomb_Shop_Multi_Cave_Doors",
          "Blacksmith_Single_Cave_Doors",
          "Blacksmith_Multi_Cave_Doors",
        );
  const singleDoor = (door: string) => [
    ...singles,
    ...(smiths.has(door) ? ["Blacksmiths Hut"] : []),
    ...(bombs.has(door) ? ["Big Bomb Shop"] : []),
  ];
  // The dungeons' exits the full and crossed shuffles place as caves:
  // Dungeon_Exits, the castle's (:281-283, :313-315, :385-387, :396-398)
  // and Ganon's Tower's
  const castleSides = [
    "Hyrule Castle Exit (West)",
    "Hyrule Castle Exit (East)",
  ];
  const dungeonCaves = [
    ...names("Dungeon_Exits_Base"),
    ...(open ? ["Hyrule Castle Exit (South)"] : []),
    ...castleSides,
    "Ganons Tower Exit",
  ];
  // Of them, those of caves with several exits, which a must-exit door may
  // take (connect_mandatory_exits takes no lone exit, :1925-1928); Standard
  // places its castle's sides after the must-exits
  const severalExits = [
    ...flat(
      table("Dungeon_Exits_Base").filter((row) => typeof row !== "string"),
    ),
    ...(open ? CASTLE_EXITS.slice(0, 3) : []),
  ];

  return (door) => {
    if (apart && oneDoor.has(door))
      return ONE_DOOR_DUNGEONS.map(([, exit]) => exit);
    const four = apart ? FOUR_DOOR_AT.get(door) : undefined;
    if (four !== undefined)
      return fourDoorDungeons(open).map(
        (dungeon) => FOUR_DOOR_EXITS[dungeon][four.at][four.index] ?? "",
      );
    if (shuffle === "simple") {
      if (OTHER_OF_PAIR.has(door)) {
        // A pair's first door takes its cave's first exit: a tuple's
        // first, only ever there (:82-84, :91-93)
        const first = DOOR_PAIRS.some(([one]) => one === door);
        const never = new Set(
          IN_ORDER_CAVES.map(([one, two]) => (first ? two : one)),
        );
        return twoDoor.filter((exit) => !never.has(exit));
      }
      if (deathMountain.has(door))
        return [
          ...twoDoor,
          ...oldManHouse,
          ...threeDoor,
          oldManWest,
          ...(oldManDoors.has(door) ? [oldManEast] : []),
        ];
      return singleDoor(door);
    }
    // What only the Light World holds, but in the crossed shuffle
    const lightOnes = shuffle === "crossed" || light.has(door);
    if (mustExits.has(door))
      // A cave's last exit (:151, :295-306, :394)
      return [
        ...twoDoor,
        ...threeDoor,
        ...(apart ? [] : severalExits),
        ...(shuffle === "crossed" || (shuffle === "full" && lightOnes)
          ? oldManHouse
          : []),
      ].filter((exit) => !NEVER_LAST.has(exit));
    return [
      ...twoDoor,
      ...threeDoor,
      ...(apart
        ? []
        : dungeonCaves.filter(
            (exit) => open || lightOnes || !castleSides.includes(exit),
          )),
      ...(lightOnes ? [...oldManHouse, oldManWest] : []),
      ...(oldManDoors.has(door) ? [oldManEast] : []),
      ...singleDoor(door),
    ];
  };
}

/**
 * What alttpr.com's crossed shuffle mixes in an Open or Standard world
 * (EntranceShuffle.py:365-440). Standard keeps the castle's front door and
 * its secret passage for the escape (:379-381, scramble_holes). Inverted
 * runs its own tables, not ported yet. In the retro world (Open's, `retro`),
 * a door that may lead to a cave set_up_take_anys draws from may lead to a
 * take-any cave instead.
 */
export const crossedPool = (
  mode: "open" | "standard",
  retro = false,
): EntrancePool => entrancePool("crossed", mode, retro);

/**
 * What the full shuffle mixes (:260-364): the doors and holes of the
 * crossed one, but each cave in one world (connect_caves takes a world's
 * doors), so a Dark World door never leads to what only the Light World
 * holds: the Old Man's house and cave (:290-322, :351-352) and, in a
 * Standard world, the castle's side doors (:313-315).
 */
export const fullPool = (
  mode: "open" | "standard",
  retro = false,
): EntrancePool => entrancePool("full", mode, retro);

/**
 * What the restricted shuffle mixes (:134-204): dungeons among dungeons
 * (simple_shuffle_dungeons), every other door among the caves and the
 * single doors, the Old Man's house and cave in the Light World.
 */
export const restrictedPool = (
  mode: "open" | "standard",
  retro = false,
): EntrancePool => entrancePool("restricted", mode, retro);

/**
 * What the simple shuffle mixes (:63-132): dungeons among dungeons, each
 * pair of two-door caves' doors one two-door cave, Death Mountain's doors
 * among its caves and those left, single doors among single caves.
 */
export const simplePool = (
  mode: "open" | "standard",
  retro = false,
): EntrancePool => entrancePool("simple", mode, retro);

/**
 * What a shuffle mixes in an Open or Standard world, Retro's being Open's
 * with its take-any caves (`retro`). Every pool shuffles the holes as
 * scramble_holes does and Skull Woods' doors and holes among their own
 * (skull_woods_shuffle); Standard keeps the escape's doors.
 */
export function entrancePool(
  shuffle: ErShuffle,
  mode: "open" | "standard",
  retro = false,
): EntrancePool {
  const open = mode === "open";
  // Dungeons among dungeons only (simple_shuffle_dungeons, :64, :135)
  const apart = shuffle === "simple" || shuffle === "restricted";
  // Standard keeps the escape's doors (:277-280, :379-381, scramble_holes
  // :1827-1830), and in the simple and restricted shuffles Hyrule Castle's
  // other doors and Agahnim's Tower's (:2054-2057)
  const keptDoors = new Set(
    open
      ? []
      : [
          "Hyrule Castle Entrance (South)",
          "Hyrule Castle Secret Entrance Stairs",
          "Hyrule Castle Secret Entrance Drop",
          ...(apart ? FOUR_DOORS["Hyrule Castle"] : []),
        ],
  );
  const keptTargets = new Set(
    open
      ? []
      : [
          "Hyrule Castle Exit (South)",
          "Hyrule Castle Secret Entrance Exit",
          "Hyrule Castle Secret Entrance",
          ...(apart ? CASTLE_EXITS : []),
        ].map(slug),
  );
  const doors = [
    ...names("LW_Entrances"),
    ...names("LW_Dungeon_Entrances"),
    ...names("LW_Single_Cave_Doors"),
    ...names("Old_Man_Entrances"),
    ...names("DW_Entrances"),
    ...names("DW_Dungeon_Entrances"),
    ...names("DW_Single_Cave_Doors"),
    ...names("DW_Entrances_Must_Exit"),
    ...names("DW_Dungeon_Entrances_Must_Exit"),
    ...names("LW_Dungeon_Entrances_Must_Exit"),
    "Hyrule Castle Entrance (South)",
    "Ganons Tower",
    // The doors of the caves holes drop into, and Skull Woods' own doors
    ...holeEntrances.map(([door]) => door),
    "Hyrule Castle Secret Entrance Stairs",
    "Pyramid Entrance",
    ...skullDoors,
  ];
  const holes = [
    ...holeEntrances.map(([, hole]) => hole),
    "Hyrule Castle Secret Entrance Drop",
    "Pyramid Hole",
    ...skullHoles,
  ];
  const holeDoors = new Map<string, string>(
    [
      ...holeEntrances,
      [
        "Hyrule Castle Secret Entrance Stairs",
        "Hyrule Castle Secret Entrance Drop",
      ] as const,
      ["Pyramid Entrance", "Pyramid Hole"] as const,
    ]
      .filter(([door]) => !keptDoors.has(door))
      .map(([door, hole]) => [slug(hole), slug(door)]),
  );
  const entrances = [...new Set([...doors, ...holes])]
    .filter((name) => !keptDoors.has(name))
    .map(entranceNamed);

  // The pairs of holes and doors this world shuffles, and their caves
  const caves = HOLE_CAVES.filter(([exit]) => !keptTargets.has(slug(exit)));
  const exitOfDrop = new Map(
    caves.map(([exit, drop]) => [slug(drop), slug(exit)]),
  );
  const dropOfExit = new Map(
    caves.map(([exit, drop]) => [slug(exit), slug(drop)]),
  );
  const holeOfDoor = new Map(
    [...holeDoors].map(([hole, door]) => [door, hole]),
  );
  const ids = (list: readonly string[]) => new Set(list.map(slug));
  const groups = [
    { from: new Set(holeDoors.keys()), to: ids(caves.map(([, d]) => d)) },
    { from: new Set(holeOfDoor.keys()), to: ids(caves.map(([e]) => e)) },
    { from: ids(skullHoles), to: ids(skullHoleTargets) },
    { from: ids(skullDoors), to: ids(skullDoorTargets) },
  ];
  // Sanctuary's cave goes under the Pyramid in the crossed shuffle alone
  // (:1838-1844)
  const pyramid = ids(["Pyramid Entrance", "Pyramid Hole"]);
  const notUnderPyramid = ids(
    shuffle === "crossed" ? [] : ["Sanctuary Exit", "Sewer Drop"],
  );

  const doorTargets = doorTargetsOf(shuffle, open);
  const targetsOf = new Map(
    entrances.map((entrance) => {
      const may =
        groups.find(({ from }) => from.has(entrance.id))?.to ??
        ids(doorTargets(entrance.name));
      const targets = TARGETS.filter(
        (t) =>
          may.has(t.id) &&
          !keptTargets.has(t.id) &&
          !(pyramid.has(entrance.id) && notUnderPyramid.has(t.id)),
      );
      // A take-any takes the door of a cave it draws (set_up_take_anys)
      const takeAny =
        retro && targets.some((t) => TAKE_ANY_CAVES.has(t.id))
          ? TARGETS.filter((t) => TAKE_ANYS.has(t.id))
          : [];
      return [entrance.id, [...targets, ...takeAny]];
    }),
  );

  const nameOf = new Map(entrances.map((e) => [e.id, e.name]));
  const targetNameOf = new Map(TARGETS.map((t) => [t.id, t.name]));
  /** What a door's note settles beside a hole's: a cave's, a dungeon's. */
  const settled = (
    entrance: string,
    target: string,
  ): (readonly [string, string])[] => {
    const door = nameOf.get(entrance) ?? "";
    const exit = targetNameOf.get(target) ?? "";
    // In the simple shuffle a pair of doors takes a two-door cave whole
    // (:76-95): the other door leads to the cave's other exit
    const other = shuffle === "simple" ? OTHER_OF_PAIR.get(door) : undefined;
    if (other !== undefined) {
      const cave = TWO_DOOR_CAVES.find((c) => c.includes(exit));
      const otherExit = cave?.find((e) => e !== exit);
      return otherExit === undefined ? [] : [[slug(other), slug(otherExit)]];
    }
    // In the simple and restricted shuffles a four-door dungeon moves
    // whole, by its table: one door tells the other three
    const four = apart ? FOUR_DOOR_AT.get(door) : undefined;
    if (four === undefined) return [];
    const dungeon = fourDoorDungeons(open).find(
      (d) => FOUR_DOOR_EXITS[d][four.at][four.index] === exit,
    );
    if (dungeon === undefined) return [];
    const exits = FOUR_DOOR_EXITS[dungeon][four.at];
    return FOUR_DOORS[four.at].flatMap((at, index) =>
      index === four.index
        ? []
        : [[slug(at), slug(exits[index] ?? "")] as const],
    );
  };

  return {
    entrances,
    holeDoors,
    partners: (entrance, target) => {
      const door = holeDoors.get(entrance);
      const exit = exitOfDrop.get(target);
      if (door !== undefined && exit !== undefined) return [[door, exit]];
      const hole = holeOfDoor.get(entrance);
      const drop = dropOfExit.get(target);
      if (hole !== undefined && drop !== undefined) return [[hole, drop]];
      return settled(entrance, target);
    },
    shuffle,
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

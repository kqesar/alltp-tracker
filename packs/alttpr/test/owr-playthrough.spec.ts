// The Overworld Randomizer's world held to seeds of the fork itself: each
// log of test/owr-spoilers/ (recorded by scripts/record-dr-spoilers.mjs owr:
// avianart.games seeds of OWR 0.8.0.2 on DR 1.5.7, generated for it, the
// overworld, doors and entrances vanilla, Open and Inverted, bonk drops
// shuffled or not, as no OWR race's spoiler is public) and of test/owr-
// crossed-spoilers/ (… owr-crossed: Open, its edges crossed, grouped and
// unrestricted, each edge noted as the log pairs it) and of test/owr-mixed-
// spoilers/ (… owr-mixed: screens flipped by Mixed, Open and Inverted,
// with crossed edges or shuffled whirlpools, each flip noted from the
// log's `Maps`) and of test/owr-entrance-spoilers/ (… owr-entrances: the
// fork's own entrance shuffles, each of its modes, a District and a Crossed
// seed with Mixed, a Crossed one with its edges crossed, Crossed and Lite in
// the Inverted world, each entrance noted as its `Entrances` says) and of
// test/owr-standard-spoilers/ (… owr-standard: the Standard world, its
// overworld and entrances vanilla, with bonk drops, Mixed, or entrances
// shuffled) and of test/owr-door-spoilers/ (… owr-doors: its doors
// shuffled, basic, partitioned and crossed, with Mixed, crossed entrances,
// decoupled doors, Inverted and Standard, each door noted as its `Doors`,
// `Lobbies` and `DoorTypes` say, test/dr-doors.ts), in the world the app
// solves an OWR run in (drWorld on OWR_DATA, its bonk drops added as the
// app adds them, `doorAddedOf`).
//
// The walks are test/dr-playthrough.ts's: a location of sphere k is `yes`
// with the items of the spheres before it held, unless the reviewed list
// says why not, and no location of a later sphere is `yes` too early.

import { describe, expect, it } from "vitest";
import { BONK_DROPS } from "../src/door-rando/bonk";
import {
  drEntranceName,
  drEntranceOf,
  drTargetOf,
  type OwrShuffle,
  owrCombineMap,
  owrEntrancePool,
  owrShuffled,
  owrSwapPartners,
  vanillaEntrances,
} from "../src/door-rando/entrances";
import rules from "../src/door-rando/owr/rules.json" with { type: "json" };
import { notedConnections } from "../src/door-world/connections";
import {
  type DrNotedDoors,
  type DrNotedEntrances,
  doorNotesFromSpoiler,
  doorTargets,
  drWorld,
  isShuffledDoor,
  kindShuffled,
  lobbyDoors,
  type OwrNotes,
  owrNotesFromSpoiler,
} from "../src/door-world/index";
import {
  crossingsOf,
  edgePartnersOf,
  factOf,
  owrScreensOf,
  towersTradedOf,
} from "../src/door-world/overworld";
import { OWR_DATA } from "../src/door-world/owr-data";
import {
  doorLog,
  doorNotesOf,
  doorShuffleOf,
  plain,
  withoutDoors,
} from "./dr-doors";
import {
  early,
  flag,
  jsonLog,
  type Log,
  notYesWithEveryKey,
  poolOf,
  readFixture,
  settingsFor,
  walk,
} from "./dr-playthrough";
import { eventsOf } from "./dr-state";

/**
 * The sets, by directory: whether their edges are crossed and their
 * screens flipped by Mixed (either, where absent), and whether their
 * entrances are shuffled.
 */
const SETS: Readonly<
  Record<
    string,
    {
      readonly crossed?: boolean;
      readonly mixed?: boolean;
      readonly entrances?: boolean;
      readonly doors?: boolean;
    }
  >
> = {
  "owr-crossed-spoilers": { crossed: true, entrances: false, mixed: false },
  "owr-door-spoilers": { doors: true },
  "owr-entrance-spoilers": { entrances: true },
  "owr-mixed-spoilers": { entrances: false, mixed: true },
  "owr-spoilers": { crossed: false, entrances: false, mixed: false },
  "owr-standard-spoilers": { crossed: false },
};

/** Each log, by `<set>/<file>`. */
const LOGS: readonly string[] = Object.keys(SETS).flatMap((set) =>
  Object.keys(
    (
      JSON.parse(readFixture(set, "index.json")) as {
        logs: Readonly<Record<string, unknown>>;
      }
    ).logs,
  ).map((name) => `${set}/${name}`),
);

const read = (path: string) => {
  const [set = "", name = ""] = path.split("/");
  return readFixture(set, name);
};

/** A log's world: Open, Standard or Inverted. */
const modeOf = (meta: Log["meta"]): "open" | "standard" | "inverted" =>
  meta.mode === "inverted" || meta.mode === "standard" ? meta.mode : "open";

/** A log's set's kind. */
const setOf = (path: string) => {
  const set = SETS[path.split("/")[0] ?? ""];
  if (set === undefined) throw new RangeError(`No set for ${path}`);
  return set;
};

/** Whether a log's entrances are shuffled: its set's, else its meta's. */
const shuffledLog = (path: string): boolean =>
  setOf(path).entrances ??
  (JSON.parse(read(path)) as { meta: Json }).meta.shuffle !== "vanilla";

/** Whether a log's edges are crossed (grouped or unrestricted). */
const crossedLog = (path: string): boolean => {
  const { ow_crossed: crossed } = (JSON.parse(read(path)) as { meta: Json })
    .meta;
  return crossed === "grouped" || crossed === "unrestricted";
};

type Json = Readonly<Record<string, unknown>>;

/**
 * The fork's events by the item its playthrough holds: Regions.py's, and
 * the farms its world makes in code (create_farm_locations, the world's
 * dynamic events: "Farmable Bombs" at a bush), each the fact it gives.
 */
const EVENTS: ReadonlyMap<string, string> = new Map([
  ...eventsOf(rules.events),
  ...rules.dynamicEvents.map(({ item }) => [item, factOf(item)] as const),
]);

/**
 * A dungeon whose portals the key walk does not all reach on the noted
 * world (portalsKnown: a portal moved behind a ledge or into a cave only
 * the dungeon reaches) keeps the strict-safe rule, every key of the
 * dungeon (keys.ts), where the fork's analysis counts fewer.
 */
const STRICT_SAFE =
  "its key doors ask every key of the dungeon, its portals not all reached by the walk (portalsKnown)";

/**
 * Insanity parts each door from its way back (decoupled, EntranceShuffle2.
 * py:2761-2766): the log's exit lines tell where a cave's exit leads out,
 * which no note says (the tracker notes doors), so the world links none and
 * what lies past one is not reached.
 */
const DECOUPLED =
  "Insanity: what lies past a cave's exit, which no note links (decoupled), the rest as STRICT_SAFE";

/**
 * Standard's escape (standard_rules, Rules.py:1728-1747): its rooms' kill
 * rules read Uncle's item (bomb_escape_rule), `maybe` while Link holds
 * nothing to fight with; the fork's playthrough counts them in Uncle's own
 * sphere. Its castle keeps the strict-safe rule (keys.ts: no analysis for
 * Standard's Hyrule Castle once entrances are shuffled), so Zelda's
 * delivery waits on its keys.
 */
const ESCAPE =
  "Standard's escape: its kill rules read Uncle's item, nothing held in sphere 1";

/**
 * A door-shuffled log's key doors read strict-safe (shuffle.ts): the fork
 * analyses the layout it generated (KeyDoorShuffle.py) and asks fewer keys
 * than all of the dungeon's, which the notes cannot tell; each turns `yes`
 * once every key is held, which the door tests assert.
 */
const DOOR_KEYS =
  "its key doors strict-safe under door shuffle: every key of the room's dungeon";

/**
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed: every one turns `yes` once the dungeon's keys
 * (its chests' and its pots') are all held (checked 2026-10-30), but
 * Insanity's past an exit (DECOUPLED), which no key opens.
 */
const REVIEWED: Readonly<
  Record<
    string,
    {
      readonly why: string;
      readonly at: Record<string, string>;
      /**
       * Of `at`, what no key opens: Standard's escape (ESCAPE), Insanity's
       * past an exit (DECOUPLED).
       */
      readonly notKeys?: readonly string[];
    }
  >
> = {
  "owr-door-spoilers/avianart-0tUGDpve7.json": {
    at: {
      "4:Ice Palace - Prize": "maybe",
      "4:Tower of Hera - Basement Cage": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-61u7cpluY.json": {
    at: {
      "3:Desert Palace - Big Key Chest": "maybe",
      "4:Misery Mire - Compass Chest": "maybe",
      "4:Thieves' Town - Big Chest": "maybe",
      "4:Tower of Hera - Prize": "maybe",
      "5:Agahnim 2": "maybe",
      "5:Swamp Palace - Prize": "maybe",
      "6:Ice Palace - Prize": "maybe",
      "6:Turtle Rock - Compass Chest": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-CTRTq1Rhj.json": {
    at: {
      "3:Desert Palace - Map Chest": "maybe",
      "4:Agahnim 1": "maybe",
      "11:Ice Palace - Prize": "maybe",
      "14:Turtle Rock - Prize": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-kxnOoGUE9.json": {
    at: {
      "4:Misery Mire - Main Lobby": "maybe",
      "8:Misery Mire - Prize": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-nrVetY8I2.json": {
    at: {
      "2:Sewers - Secret Room - Left": "maybe",
      "4:Agahnim 1": "maybe",
      "5:Skull Woods - Prize": "maybe",
      "7:Ice Palace - Prize": "maybe",
      "9:Swamp Drain": "maybe",
      "10:Trench 1 Switch": "maybe",
      "11:Swamp Palace - Prize": "maybe",
      "12:Agahnim 2": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-pSf43q0bF.json": {
    at: {
      "8:Trench 1 Switch": "maybe",
      "9:Attic Cracked Floor": "maybe",
      "9:Ice Palace - Prize": "maybe",
      "12:Agahnim 2": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-tIJDkPsK3.json": {
    at: {
      "7:Palace of Darkness - Prize": "maybe",
      "8:Desert Ledge": "maybe",
      "9:Ice Palace - Prize": "maybe",
      "11:Agahnim 2": "maybe",
    },
    why: DOOR_KEYS,
  },
  "owr-door-spoilers/avianart-uVQOPwIvs.json": {
    at: {
      "1:Zelda Pickup": "maybe",
      "2:Zelda Drop Off": "maybe",
      "5:Skull Woods - Prize": "maybe",
      "6:Swamp Palace - Prize": "maybe",
      "7:Ice Palace - Prize": "maybe",
      "8:Turtle Rock - Prize": "maybe",
    },
    notKeys: ["1:Zelda Pickup", "2:Zelda Drop Off"],
    why: `${ESCAPE}; her way back runs through a bombable door, whose bombs the fork's can_farm_bombs reads maybe before her delivery; ${DOOR_KEYS}`,
  },
  "owr-entrance-spoilers/avianart-1IAKwFudE.json": {
    at: {
      "5:Skull Woods - Prize": "maybe",
      "6:Agahnim 2": "maybe",
      "6:Ganons Tower - Map Chest": "maybe",
      "7:Turtle Rock - Prize": "maybe",
    },
    why: `Ganons Tower (at Skull Woods' back door), Skull Woods, Turtle Rock: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-4cwdgebPq.json": {
    at: {
      "7:Turtle Rock - Compass Chest": "maybe",
      "8:Desert Palace - Prize": "maybe",
      "8:Turtle Rock - Prize": "maybe",
    },
    why: `Turtle Rock, Desert Palace: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-89uvVx2xg.json": {
    at: { "5:Desert Palace - Prize": "maybe" },
    why: `Desert Palace: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-DLSrm8B0f.json": {
    at: {
      "1:Desert Palace - Big Key Chest": "no",
      "1:Mini Moldorm Cave - Far Right": "no",
      "4:Desert Palace - Boss": "maybe",
      "4:Desert Palace - Prize": "maybe",
      "4:Palace of Darkness - Big Chest": "no",
      "5:Palace of Darkness - Prize": "no",
      "5:Trench 1 Switch": "maybe",
      "6:Swamp Drain": "maybe",
      "7:Swamp Palace - Boss": "maybe",
      "7:Swamp Palace - Prize": "maybe",
      "8:Agahnim 2": "maybe",
      "8:Ganons Tower - Bob's Chest": "maybe",
      "8:Ganons Tower - Randomizer Room - Bottom Left": "maybe",
      "9:Attic Cracked Floor": "no",
      "9:Suspicious Maiden": "no",
      "10:Revealing Light": "no",
      "11:Thieves' Town - Prize": "no",
    },
    notKeys: [
      "1:Desert Palace - Big Key Chest",
      "1:Mini Moldorm Cave - Far Right",
      "4:Palace of Darkness - Big Chest",
      "5:Palace of Darkness - Prize",
      "9:Attic Cracked Floor",
      "9:Suspicious Maiden",
      "10:Revealing Light",
      "11:Thieves' Town - Prize",
    ],
    why: DECOUPLED,
  },
  "owr-entrance-spoilers/avianart-ERKxf6EjS.json": {
    at: {
      "9:Turtle Rock - Eye Bridge - Bottom Right": "maybe",
      "9:Turtle Rock - Eye Bridge - Top Right": "maybe",
      "12:Desert Palace - Prize": "maybe",
      "12:Turtle Rock - Prize": "maybe",
    },
    why: `Turtle Rock, Desert Palace: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-jRN0n0tst.json": {
    at: { "3:Hyrule Castle - Zelda's Chest": "maybe" },
    why: `Hyrule Castle (its front door at Bumper Cave's top): ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-jUsfGyWR1.json": {
    at: {
      "5:Ganons Tower - Big Key Chest": "maybe",
      "5:Ganons Tower - Randomizer Room - Bottom Right": "maybe",
      "7:Skull Woods - Prize": "maybe",
      "7:Turtle Rock - Prize": "maybe",
    },
    why: `Ganons Tower (at Ice Palace's door), Skull Woods, Turtle Rock: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-kL7bNLknt.json": {
    at: {
      "3:Desert Palace - Boss": "maybe",
      "3:Desert Palace - Prize": "maybe",
      "8:Skull Woods - Prize": "maybe",
      "9:Turtle Rock - Prize": "maybe",
    },
    why: `Desert Palace, Skull Woods, Turtle Rock: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-p5dYMs8jC.json": {
    at: {
      "6:Attic Cracked Floor": "maybe",
      "6:Suspicious Maiden": "maybe",
      "7:Desert Palace - Prize": "maybe",
      "8:Skull Woods - Prize": "maybe",
    },
    why: `Thieves Town, Desert Palace, Skull Woods: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-qzj33CUOO.json": {
    at: {
      "6:Desert Palace - Prize": "maybe",
      "6:Skull Woods - Prize": "maybe",
      "10:Turtle Rock - Prize": "maybe",
    },
    why: `Turtle Rock, Desert Palace, Skull Woods: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-sLcpC6Z45.json": {
    at: {
      "3:Skull Woods - Boss": "maybe",
      "3:Skull Woods - Prize": "maybe",
    },
    why: `Skull Woods: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-tZeE1P1Du.json": {
    at: {
      "7:Desert Palace - Prize": "maybe",
      "9:Turtle Rock - Prize": "maybe",
    },
    why: `Desert Palace, Turtle Rock: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-uegcykSHR.json": {
    at: { "2:Skull Woods - Prize": "maybe" },
    why: `Skull Woods: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-waofX3504.json": {
    at: { "4:Desert Palace - Prize": "maybe" },
    why: `Desert Palace: ${STRICT_SAFE}`,
  },
  "owr-entrance-spoilers/avianart-zXFy19ljb.json": {
    at: {
      "7:Skull Woods - Prize": "maybe",
      "10:Turtle Rock - Prize": "maybe",
    },
    why: `Skull Woods, Turtle Rock: ${STRICT_SAFE}`,
  },
  "owr-standard-spoilers/avianart-0pr3QtXLU.json": {
    at: {
      "1:Zelda Pickup": "maybe",
      "2:Zelda Drop Off": "maybe",
      "9:Skull Woods - Prize": "maybe",
      "11:Turtle Rock - Prize": "maybe",
      "12:Desert Palace - Prize": "maybe",
    },
    notKeys: ["1:Zelda Pickup"],
    why: `${ESCAPE}; Hyrule Castle, Skull Woods, Turtle Rock, Desert Palace: ${STRICT_SAFE}`,
  },
  "owr-standard-spoilers/avianart-0rrVwugI5.json": {
    at: { "1:Hyrule Castle - Map Chest": "maybe", "1:Zelda Pickup": "maybe" },
    notKeys: ["1:Hyrule Castle - Map Chest", "1:Zelda Pickup"],
    why: ESCAPE,
  },
  "owr-standard-spoilers/avianart-AjT8OHdZc.json": {
    at: { "1:Hyrule Castle - Map Chest": "maybe", "1:Zelda Pickup": "maybe" },
    notKeys: ["1:Hyrule Castle - Map Chest", "1:Zelda Pickup"],
    why: ESCAPE,
  },
  "owr-standard-spoilers/avianart-CK14WlYnG.json": {
    at: {
      "1:Zelda Pickup": "maybe",
      "2:Zelda Drop Off": "maybe",
      "15:Ice Block Drop": "maybe",
      "15:Ice Palace - Freezor Chest": "maybe",
      "15:Skull Woods - Prize": "maybe",
      "16:Ice Palace - Prize": "maybe",
    },
    notKeys: ["1:Zelda Pickup"],
    why: `${ESCAPE}; Hyrule Castle, Ice Palace, Skull Woods: ${STRICT_SAFE}`,
  },
  "owr-standard-spoilers/avianart-mGEeueUjZ.json": {
    at: {
      "1:Zelda Pickup": "maybe",
      "2:Sewers - Secret Room - Middle": "maybe",
      "2:Zelda Drop Off": "maybe",
    },
    notKeys: ["1:Zelda Pickup"],
    why: `${ESCAPE}; Hyrule Castle: ${STRICT_SAFE}`,
  },
  "owr-standard-spoilers/avianart-mhKQq39uX.json": {
    at: { "1:Hyrule Castle - Map Chest": "maybe", "1:Zelda Pickup": "maybe" },
    notKeys: ["1:Hyrule Castle - Map Chest", "1:Zelda Pickup"],
    why: ESCAPE,
  },
};

/** The prize-pack farms taken out of each log (PRIZE_FARM), reviewed. */
const FARMS: Readonly<Record<string, readonly string[]>> = {
  "owr-crossed-spoilers/avianart-o4mamwuKZ.json": [
    "1:South Pass Area Crab Drop",
  ],
  "owr-door-spoilers/avianart-uVQOPwIvs.json": [
    "3:Lost Woods East Area Tree Pull",
  ],
  "owr-door-spoilers/avianart-x1FHBuUpu.json": ["1:South Pass Area Crab Drop"],
  "owr-entrance-spoilers/avianart-DLSrm8B0f.json": [
    "1:South Pass Area Crab Drop",
  ],
  "owr-mixed-spoilers/avianart-mPEeiQvu1.json": [
    "1:Mountain Pass Area Crab Drop",
  ],
  "owr-mixed-spoilers/avianart-t8B3wJpHK.json": [
    "1:Lost Woods East Area Crab Drop",
  ],
  "owr-standard-spoilers/avianart-0rrVwugI5.json": [
    "3:Lost Woods East Area Crab Drop",
  ],
  "owr-standard-spoilers/avianart-mGEeueUjZ.json": [
    "3:Hyrule Castle Courtyard Tree Pull",
  ],
  "owr-standard-spoilers/avianart-mhKQq39uX.json": [
    "3:Bumper Cave Area Tree Pull",
  ],
};

/**
 * The farms a seed's prize packs make (create_farm_locations, ItemList.py:
 * 742-760: tree pulls and crabs, only where the seed's random `pull` and
 * `crab` packs drop rupees or bombs), which no tracker knows: the world
 * holds none, so the walks take them out, their items never held.
 */
const PRIZE_FARM = / (?:Tree Pull|Crab Drop)$/;

/**
 * A log without the farms of its prize packs (PRIZE_FARM), and those, as
 * `sphere:location`.
 */
function withoutPrizeFarms(log: Log): { log: Log; farms: readonly string[] } {
  const farms: string[] = [];
  const playthrough = Object.fromEntries(
    Object.entries(log.playthrough).map(([k, sphere]) => {
      if (Array.isArray(sphere)) return [k, sphere];
      const kept = Object.entries(sphere).filter(([location]) => {
        if (!PRIZE_FARM.test(location)) return true;
        farms.push(`${k}:${location}`);
        return false;
      });
      return [k, Object.fromEntries(kept)];
    }),
  );
  return { farms, log: { ...log, playthrough } };
}

/** A log's entrance shuffle, one of the fork's `modes`. */
const shuffleOf = (log: Log): OwrShuffle => {
  const { shuffle } = log.meta;
  const modes = OWR_DATA.tableOf<unknown>("EntranceShuffle2", "modes");
  if (typeof shuffle !== "string" || modes[shuffle] === undefined)
    throw new RangeError(`Not an entrance shuffle of the fork: ${shuffle}`);
  return shuffle as OwrShuffle;
};

/**
 * A log's pool settings: DR's, and the fork's bonk drops and take-any
 * caves, which lite's and lean's kept caves read.
 */
const owrPoolOf = (meta: Log["meta"]) => ({
  ...poolOf(meta),
  bonkDrops: flag(meta.bonk_drops),
  mode: modeOf(meta),
  takeAny: String(meta.take_any ?? "none"),
});

/**
 * A log's shuffled entrances, noted as its `Entrances` says: each entrance
 * the fork's pool may move (both start houses' doors, as a run noting
 * them all would) to the target it took.
 */
function entranceNotesOf(log: Log): DrNotedEntrances {
  const pool = owrPoolOf(log.meta);
  const moved = new Set(
    owrEntrancePool(shuffleOf(log), {
      ...pool,
      bombShopStart: undefined,
    }).entrances.map((entrance) => entrance.id),
  );
  const noted: Record<string, string> = {};
  for (const link of log.Entrances) {
    if (link.direction === "exit") continue;
    const id = drEntranceOf(link.entrance).id;
    if (moved.has(id)) noted[id] = drTargetOf(link.exit).id;
  }
  return { noted, pool, shuffle: shuffleOf(log) };
}

/** Whether a log's doors are shuffled: its set's. */
const doorLogOf = (path: string): boolean => setOf(path).doors === true;

/** A log, its settings those the fork's world holds, and its notes. */
function logOf(name: string): {
  log: Log;
  notes: OwrNotes;
  farms: readonly string[];
  entrances?: DrNotedEntrances;
  doors?: DrNotedDoors;
} {
  const json = JSON.parse(read(name)) as Json;
  const { Maps: maps, Overworld: edges, Whirlpools: pools, ...rest } = json;
  const doors = doorLogOf(name);
  const read0 = jsonLog(withoutDoors(rest));
  const { farms, log } = withoutPrizeFarms(
    doors ? doorLog(read0, OWR_DATA) : read0,
  );
  const { meta } = log;
  const crossed = crossedLog(name);
  const set = setOf(name);
  const mixed = flag(meta.ow_mixed);
  if (set.crossed !== undefined) expect(crossed).toBe(set.crossed);
  if (set.mixed !== undefined) expect(mixed).toBe(set.mixed);
  // Edges listed once crossed or flipped (all 141 pairs, connect_two_way's
  // spoiler, OverworldShuffle.py:721-722); whirlpools and flute spots only
  // where meta shuffles them
  expect((edges as readonly unknown[]).length).toBe(crossed || mixed ? 141 : 0);
  expect(meta.ow_crossed !== "none").toBe(crossed);
  expect((pools as readonly unknown[]).length > 0).toBe(
    flag(meta.ow_whirlpool),
  );
  // Grouped writes its crossed screens as a map too (:271)
  expect(
    (maps as readonly { type: string }[]).filter((m) => m.type === "flute")
      .length > 0,
  ).toBe(meta.ow_fluteshuffle !== "vanilla");
  expect([
    meta.door_shuffle,
    meta.shuffle !== "vanilla",
    meta.logic,
    meta.ow_layout,
    meta.prizeshuffle,
    flag(meta.shuffle_followers),
    flag(meta.bombbag),
  ]).toEqual([
    doors ? meta.door_shuffle : "vanilla",
    shuffledLog(name),
    "noglitches",
    "vanilla",
    "none",
    false,
    false,
  ]);
  expect(Object.values(meta.custom_goals as object)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect((meta.versions as Record<string, string>).Overworld).toBe("0.8.0.2-u");
  if (doors) expect(meta.door_shuffle).not.toBe("vanilla");
  const read1 = {
    farms,
    log,
    notes: owrNotesFromSpoiler(
      json as Parameters<typeof owrNotesFromSpoiler>[0],
    ),
    ...(shuffledLog(name) ? { entrances: entranceNotesOf(log) } : {}),
  };
  if (!doors) return read1;
  return {
    ...read1,
    doors: doorNotesOf(
      json,
      meta,
      OWR_DATA,
      (notes, settings) =>
        worldOf({ ...read1, doors: { notes, settings } }, {}).roomDungeons,
    ),
  };
}

/**
 * A log's world: the fork's, its mode and its bonk drops as it says, its
 * whirlpools and flute spots as noted.
 */
const worldOf = (
  {
    log,
    notes,
    entrances,
    doors,
  }: {
    readonly log: Log;
    readonly notes: OwrNotes;
    readonly entrances?: DrNotedEntrances;
    readonly doors?: DrNotedDoors;
  },
  options: { readonly sweepEvents?: boolean },
) => {
  const { meta } = log;
  const bonks = flag(meta.bonk_drops);
  return drWorld(
    {
      ...settingsFor(meta),
      ...(meta.mode === "inverted" ? { invertedMode: true } : {}),
      ...(meta.mode === "standard" ? { standardMode: true } : {}),
      ...(bonks ? { bonkDrops: true } : {}),
      ...(entrances === undefined
        ? {}
        : { [`shuffle_${entrances.shuffle}`]: true }),
    },
    {
      data: OWR_DATA,
      overworld: notes,
      ...(entrances === undefined ? {} : { entrances }),
      ...(doors === undefined ? {} : { doors }),
      ...(bonks
        ? {
            dropsAndPots: BONK_DROPS.map(({ name, region }) => ({
              name,
              region,
            })),
          }
        : {}),
      ...options,
    },
  );
};

describe("the Overworld Randomizer's world against its own seeds' playthroughs", () => {
  const logs = LOGS;

  it("reads Open, Inverted and Standard seeds, doors shuffled, bonk drops, whirlpools and flute spots shuffled and not, edges crossed, screens flipped, entrances shuffled", () => {
    const seen = logs.map((name) => {
      const { meta } = logOf(name).log;
      return `${meta.mode} ${flag(meta.bonk_drops)} ${flag(meta.ow_whirlpool)} ${meta.ow_fluteshuffle} ${meta.ow_crossed} ${flag(meta.ow_mixed)} ${meta.shuffle} ${meta.keyshuffle}`;
    });
    expect(seen.sort()).toEqual([
      "inverted false false vanilla none false crossed none",
      "inverted false false vanilla none false lite none",
      "inverted false false vanilla none false vanilla none",
      "inverted false false vanilla none false vanilla none",
      "inverted false false vanilla none true vanilla none",
      "inverted false true balanced none false vanilla none",
      "inverted true false vanilla none false vanilla none",
      "open false false vanilla grouped false vanilla none",
      "open false false vanilla grouped true vanilla none",
      "open false false vanilla none false crossed none",
      "open false false vanilla none false crossed none",
      "open false false vanilla none false district none",
      "open false false vanilla none false dungeonsfull none",
      "open false false vanilla none false dungeonssimple none",
      "open false false vanilla none false full none",
      "open false false vanilla none false insanity none",
      "open false false vanilla none false lean none",
      "open false false vanilla none false lite none",
      "open false false vanilla none false restricted none",
      "open false false vanilla none false simple none",
      "open false false vanilla none false swapped none",
      "open false false vanilla none false swapped wild",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none true crossed none",
      "open false false vanilla none true district none",
      "open false false vanilla none true vanilla none",
      "open false false vanilla none true vanilla none",
      "open false false vanilla unrestricted false crossed none",
      "open false false vanilla unrestricted false vanilla none",
      "open false true random none false vanilla none",
      "open false true vanilla none true vanilla none",
      "open true false vanilla none false vanilla none",
      "standard false false vanilla none false crossed none",
      "standard false false vanilla none false dungeonssimple none",
      "standard false false vanilla none false lite none",
      "standard false false vanilla none false vanilla none",
      "standard false false vanilla none false vanilla none",
      "standard false false vanilla none true vanilla none",
      "standard true false vanilla none false vanilla none",
    ]);
  });

  it("offers each entrance a shuffled seed moved, and its target; the rest stand", () => {
    const shuffled = logs.filter(shuffledLog);
    expect(shuffled).toHaveLength(21);
    const maps = vanillaEntrances(false);
    for (const name of shuffled) {
      const { log, notes, entrances } = logOf(name);
      const screens = owrScreensOf(OWR_DATA, modeOf(log.meta), notes);
      const shuffle = shuffleOf(log);
      // District's pools read the worlds the entrances stand in, known
      // without Mixed
      const mixed = flag(log.meta.ow_mixed);
      const pool = owrEntrancePool(shuffle, {
        ...owrPoolOf(log.meta),
        bombShopStart: screens.swapped(0x2c),
        tilesSwapped: mixed ? undefined : log.meta.mode === "inverted",
      });
      // The log lists what the shuffle connects (spoiler.set_entrance),
      // never what it leaves to vanilla connections (connect_vanilla*)
      const ways = log.Entrances.filter((link) => link.direction !== "exit");
      expect(ways.length).toBeGreaterThan(20);
      // District and Swapped place every entrance (`undefined` error and
      // swap); an unmixed District seed's pickers offer each entrance its
      // own district's targets alone: far fewer than the fork's 129 doors'
      // and 12 holes'
      const widest = Math.max(
        ...[...pool.targetsOf.values()].map((targets) => targets.length),
      );
      if (shuffle === "district" || shuffle === "swapped") {
        expect(ways, name).toHaveLength(140);
        if (shuffle === "district" && !mixed)
          expect(widest, name).toBeLessThan(40);
        else expect(widest, name).toBeGreaterThan(100);
      }
      const kept: string[] = [];
      for (const link of ways) {
        const offered = pool.targetsOf.get(drEntranceOf(link.entrance).id);
        if (offered === undefined) {
          const vanilla =
            maps.twoWay.get(link.entrance) ?? maps.oneWay.get(link.entrance);
          if (vanilla !== link.exit) kept.push(link.entrance);
          continue;
        }
        expect(
          offered.map((t) => t.id),
          `${name}: ${link.entrance} → ${link.exit}`,
        ).toContain(drTargetOf(link.exit).id);
      }
      expect(kept, name).toEqual([]);
      // Each the pool moves noted; the start house kept (no shufflelinks),
      // the Tavern's back moved (shuffletavern)
      expect(
        pool.entrances
          .filter((e) => entrances?.noted[e.id] === undefined)
          .map((e) => drEntranceName(e.id)),
      ).toEqual([]);
      expect(pool.entrances.map((e) => drEntranceName(e.id))).not.toContain(
        screens.swapped(0x2c) ? "Big Bomb Shop" : "Links House",
      );
      // The dungeon shuffles leave it to vanilla connections
      if (!shuffle.startsWith("dungeons"))
        expect(pool.entrances.map((e) => drEntranceName(e.id))).toContain(
          "Tavern North",
        );
      // Some entrance leads elsewhere than its vanilla target
      expect(
        ways.filter(
          (link) =>
            (maps.twoWay.get(link.entrance) ??
              maps.oneWay.get(link.entrance)) !== link.exit,
        ).length,
      ).toBeGreaterThan(10);
    }
  });

  it("tells each Swapped seed's other half from half its notes, as connect_swap pairs them", () => {
    const swapped = logs.filter(
      (name) =>
        setOf(name).entrances && logOf(name).log.meta.shuffle === "swapped",
    );
    expect(swapped).toHaveLength(2);
    for (const name of swapped) {
      const { log, notes, entrances } = logOf(name);
      if (entrances === undefined) throw new Error(`${name}: no entrances`);
      const mode = log.meta.mode === "inverted" ? "inverted" : "open";
      const screens = owrScreensOf(OWR_DATA, mode, notes);
      const moved = owrShuffled("swapped", {
        ...entrances.pool,
        bombShopStart: screens.swapped(0x2c),
      });
      const traded = towersTradedOf(screens);
      const combine = owrCombineMap(traded);
      const entranceOf = new Map([...combine].map(([e, t]) => [t, e]));
      // The log trades targets two by two (connect_swap, connect_swapped):
      // A at B's target, B at A's; keep one of each pair
      const full = entrances.noted;
      const half: Record<string, string> = {};
      const partnered = new Set<string>();
      let pairs = 0;
      for (const [id, targetId] of Object.entries(full).sort()) {
        if (partnered.has(id)) continue;
        half[id] = targetId;
        const entrance = drEntranceName(id) ?? "";
        const own = combine.get(entrance) ?? "";
        const target = [...combine.values()].find(
          (t) => drTargetOf(t).id === targetId,
        );
        if (target === undefined || target === own) continue;
        const partner = entranceOf.get(target) ?? "";
        expect(full[drEntranceOf(partner).id], `${name}: ${entrance}`).toBe(
          drTargetOf(own).id,
        );
        partnered.add(drEntranceOf(partner).id);
        pairs++;
      }
      expect(pairs, name).toBeGreaterThan(50);
      // Half the notes tell the rest
      const derived = owrSwapPartners(half, moved, traded);
      expect(derived.size, name).toBe(pairs);
      expect({
        ...half,
        ...Object.fromEntries(
          [...derived].map(([id, note]) => [id, note.target]),
        ),
      }).toEqual(full);
      const world = (noted: Readonly<Record<string, string>>) =>
        notedConnections(
          OWR_DATA,
          mode,
          { ...entrances, noted },
          undefined,
          undefined,
          notes,
        );
      const fromHalf = world(half);
      expect(fromHalf.complete, name).toBe(true);
      expect(fromHalf.connections).toEqual(world(full).connections);
    }
  });

  it("crosses exactly the edges a Mixed seed lists, from its flips alone", () => {
    const mixed = logs.filter((name) => setOf(name).mixed && !crossedLog(name));
    expect(mixed.length).toBeGreaterThan(1);
    for (const name of mixed) {
      const json = JSON.parse(read(name)) as {
        meta: Json;
        Overworld: readonly { entrance: string; exit: string }[];
      };
      const listed: Record<string, string> = {};
      for (const { entrance, exit } of json.Overworld) {
        listed[entrance] = exit;
        listed[exit] = entrance;
      }
      const { notes } = logOf(name);
      expect(notes.edges).toBeUndefined();
      expect(
        Object.values(notes.flips ?? {}).filter(Boolean).length,
      ).toBeGreaterThan(10);
      const screens = owrScreensOf(
        OWR_DATA,
        modeOf(json.meta as Log["meta"]),
        notes,
      );
      expect(
        Object.fromEntries(edgePartnersOf(OWR_DATA, notes, screens)),
      ).toEqual(listed);
      // Some cross, as their screens flip apart
      expect(
        Object.entries(listed).filter(
          ([a, b]) => edgePartnersOf(OWR_DATA).get(a) !== b,
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it("notes every edge of a crossed seed both ways, some into the other world", () => {
    for (const name of logs) {
      const { log, notes } = logOf(name);
      if (!crossedLog(name)) {
        expect(notes.edges).toBeUndefined();
        continue;
      }
      const edges = notes.edges ?? {};
      expect(Object.keys(edges)).toHaveLength(282);
      for (const [a, b] of Object.entries(edges)) expect(edges[b]).toBe(a);
      // Not every edge meets its vanilla partner
      const moved = Object.entries(edges).filter(
        ([a, b]) => edgePartnersOf(OWR_DATA).get(a) !== b,
      );
      expect(moved.length, name).toBeGreaterThan(0);
      // As a player notes them, a crossing per pair: the same links, where
      // Mixed flipped one screen of a pair turned round by its flips
      const screens = owrScreensOf(OWR_DATA, modeOf(log.meta), notes);
      const crossings = crossingsOf(
        OWR_DATA,
        edges,
        notes.flips === undefined ? undefined : screens,
      );
      expect(Object.keys(crossings)).toHaveLength(67);
      const seen = {
        crossings,
        ...(notes.flips === undefined ? {} : { flips: notes.flips }),
      };
      expect(
        Object.fromEntries(edgePartnersOf(OWR_DATA, seen, screens)),
      ).toEqual(edges);
    }
  });

  it("notes every whirlpool and the eight flute spots of a shuffled seed", () => {
    for (const name of logs) {
      const { log, notes } = logOf(name);
      if (flag(log.meta.ow_whirlpool))
        expect(Object.keys(notes.whirlpools ?? {})).toHaveLength(8);
      else expect(notes.whirlpools).toBeUndefined();
      if (log.meta.ow_fluteshuffle === "vanilla")
        expect(notes.flute).toBeUndefined();
      else expect(notes.flute).toHaveLength(8);
    }
  });

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const read = logOf(name);
      expect(read.farms).toEqual(FARMS[name] ?? []);
      const world = worldOf(read, {});
      const { checked, notYes } = walk(read.log, world, EVENTS);
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
      // Each a key door's, as reviewed: yes once every key is held, but
      // what the review names no key opens
      expect(
        notYesWithEveryKey(read.log, world, notYes, EVENTS).sort(),
      ).toEqual([...(REVIEWED[name]?.notKeys ?? [])].sort());
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const read = logOf(name);
      expect(
        early(read.log, worldOf(read, { sweepEvents: false }), EVENTS),
      ).toEqual([]);
    });

  const doorLogs = logs.filter(doorLogOf);

  for (const name of doorLogs)
    it(`offers each link, lobby and kind a door log made (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const settings = doorShuffleOf(json.meta as Log["meta"]);
      const doors = json.Doors as readonly { entrance: string; exit: string }[];
      expect(doors.length).toBeGreaterThan(150);
      for (const { entrance, exit } of doors) {
        const a = OWR_DATA.doorByName.get(entrance);
        const b = OWR_DATA.doorByName.get(exit);
        if (a === undefined || b === undefined) throw new Error(entrance);
        expect(isShuffledDoor(a, settings, OWR_DATA), entrance).toBe(true);
        expect(
          doorTargets(a, settings, OWR_DATA).map((d) => d.name),
          `${entrance} → ${exit}`,
        ).toContain(exit);
      }
      for (const { door_name, lobby_name } of (json.Lobbies ?? []) as {
        door_name: string;
        lobby_name: string;
      }[])
        expect(
          lobbyDoors(lobby_name, settings.shuffle, OWR_DATA).map((d) => d.name),
        ).toContain(door_name);
      const notes = doorNotesFromSpoiler(json, settings, OWR_DATA);
      for (const [id, kind] of Object.entries(notes.kinds ?? {}))
        if (kind !== "normal")
          expect(
            [...OWR_DATA.doorByName.values()].some(
              (d) => kindShuffled(d, settings) && notes.kinds?.[id] === kind,
            ),
          ).toBe(true);
    });

  for (const name of doorLogs)
    it(`puts each room in the dungeon a door log does (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const log = jsonLog(withoutDoors(json));
      const world = worldOf(logOf(name), {});
      const regionOf = new Map(
        OWR_DATA.regions.flatMap((r) =>
          r.locations.map((l) => [l, r.name] as const),
        ),
      );
      const wrong: string[] = [];
      let checked = 0;
      for (const at of Object.keys(log.Locations)) {
        const tagged = / @ ([^@]+)$/.exec(at);
        const region = regionOf.get(plain(at));
        if (tagged === null || region === undefined) continue;
        checked++;
        const found = world.roomDungeons?.get(region);
        if (found !== tagged[1]) wrong.push(`${at}: ${found}`);
      }
      expect(wrong).toEqual([]);
      if (log.meta.door_shuffle !== "basic")
        expect(checked).toBeGreaterThan(50);
    });
});

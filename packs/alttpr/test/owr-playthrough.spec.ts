// The Overworld Randomizer's world held to seeds of the fork itself: each
// log of test/owr-spoilers/ (recorded by scripts/record-dr-spoilers.mjs owr:
// avianart.games seeds of OWR 0.8.0.2 on DR 1.5.7, generated for it, the
// overworld, doors and entrances vanilla, Open and Inverted, bonk drops
// shuffled or not, as no OWR race's spoiler is public) and of test/owr-
// crossed-spoilers/ (… owr-crossed: Open, its edges crossed, grouped and
// unrestricted, each edge noted as the log pairs it) and of test/owr-mixed-
// spoilers/ (… owr-mixed: screens flipped by Mixed, Open and Inverted,
// with crossed edges or shuffled whirlpools, each flip noted from the
// log's `Maps`), in the world the app
// solves an OWR run in (drWorld on OWR_DATA, its bonk drops added as the
// app adds them, `doorAddedOf`).
//
// The walks are test/dr-playthrough.ts's: a location of sphere k is `yes`
// with the items of the spheres before it held, unless the reviewed list
// says why not, and no location of a later sphere is `yes` too early.

import { describe, expect, it } from "vitest";
import { BONK_DROPS } from "../src/door-rando/bonk";
import rules from "../src/door-rando/owr/rules.json" with { type: "json" };
import {
  drWorld,
  type OwrNotes,
  owrNotesFromSpoiler,
} from "../src/door-world/index";
import {
  crossingsOf,
  edgePartnersOf,
  factOf,
  owrScreensOf,
} from "../src/door-world/overworld";
import { OWR_DATA } from "../src/door-world/owr-data";
import {
  early,
  flag,
  jsonLog,
  type Log,
  readFixture,
  settingsFor,
  walk,
} from "./dr-playthrough";
import { eventsOf } from "./dr-state";

/**
 * The sets, by directory: whether their edges are listed (crossed, or
 * moved by Mixed's flips) and their screens flipped by Mixed.
 */
const SETS = {
  "owr-crossed-spoilers": { listed: true, mixed: false },
  "owr-mixed-spoilers": { listed: true, mixed: true },
  "owr-spoilers": { listed: false, mixed: false },
} as const;

type Set = keyof typeof SETS;

/** Each log, by `<set>/<file>`. */
const LOGS: readonly string[] = (Object.keys(SETS) as Set[]).flatMap((set) =>
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

/** A log's set's kind. */
const setOf = (path: string) => SETS[(path.split("/")[0] ?? "") as Set];

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
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed.
 */
const REVIEWED: Readonly<
  Record<string, { readonly why: string; readonly at: Record<string, string> }>
> = {};

/** The prize-pack farms taken out of each log (PRIZE_FARM), reviewed. */
const FARMS: Readonly<Record<string, readonly string[]>> = {
  "owr-crossed-spoilers/avianart-o4mamwuKZ.json": [
    "1:South Pass Area Crab Drop",
  ],
  "owr-mixed-spoilers/avianart-mPEeiQvu1.json": [
    "1:Mountain Pass Area Crab Drop",
  ],
  "owr-mixed-spoilers/avianart-t8B3wJpHK.json": [
    "1:Lost Woods East Area Crab Drop",
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

/** A log, its settings those the fork's world holds, and its notes. */
function logOf(name: string): {
  log: Log;
  notes: OwrNotes;
  farms: readonly string[];
} {
  const json = JSON.parse(read(name)) as Json;
  const { Maps: maps, Overworld: edges, Whirlpools: pools, ...rest } = json;
  const { farms, log } = withoutPrizeFarms(jsonLog(rest));
  const { meta } = log;
  const crossed = crossedLog(name);
  const { listed, mixed } = setOf(name);
  // Only the Mixed set mixes its kinds
  if (!mixed) expect(crossed).toBe(listed);
  // Edges listed once crossed or flipped (all 141 pairs, connect_two_way's
  // spoiler, OverworldShuffle.py:721-722); whirlpools and flute spots only
  // where meta shuffles them
  expect((edges as readonly unknown[]).length).toBe(listed ? 141 : 0);
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
    meta.shuffle,
    meta.logic,
    meta.ow_layout,
    flag(meta.ow_mixed) === mixed,
    meta.prizeshuffle,
    flag(meta.shuffle_followers),
    flag(meta.bombbag),
  ]).toEqual([
    "vanilla",
    "vanilla",
    "noglitches",
    "vanilla",
    true,
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
  return {
    farms,
    log,
    notes: owrNotesFromSpoiler(
      json as Parameters<typeof owrNotesFromSpoiler>[0],
    ),
  };
}

/**
 * A log's world: the fork's, its mode and its bonk drops as it says, its
 * whirlpools and flute spots as noted.
 */
const worldOf = (
  { log, notes }: { readonly log: Log; readonly notes: OwrNotes },
  options: { readonly sweepEvents?: boolean },
) => {
  const { meta } = log;
  const bonks = flag(meta.bonk_drops);
  return drWorld(
    {
      ...settingsFor(meta),
      ...(meta.mode === "inverted" ? { invertedMode: true } : {}),
      ...(bonks ? { bonkDrops: true } : {}),
    },
    {
      data: OWR_DATA,
      overworld: notes,
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

  it("reads Open and Inverted seeds, bonk drops, whirlpools and flute spots shuffled and not, edges crossed, screens flipped", () => {
    const seen = logs.map((name) => {
      const { meta } = logOf(name).log;
      return `${meta.mode} ${flag(meta.bonk_drops)} ${flag(meta.ow_whirlpool)} ${meta.ow_fluteshuffle} ${meta.ow_crossed} ${flag(meta.ow_mixed)}`;
    });
    expect(seen.sort()).toEqual([
      "inverted false false vanilla none false",
      "inverted false false vanilla none true",
      "inverted false true balanced none false",
      "inverted true false vanilla none false",
      "open false false vanilla grouped false",
      "open false false vanilla grouped true",
      "open false false vanilla none false",
      "open false false vanilla none true",
      "open false false vanilla unrestricted false",
      "open false true random none false",
      "open false true vanilla none true",
      "open true false vanilla none false",
    ]);
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
        json.meta.mode === "inverted" ? "inverted" : "open",
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
      const screens = owrScreensOf(
        OWR_DATA,
        log.meta.mode === "inverted" ? "inverted" : "open",
        notes,
      );
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
      const { checked, notYes } = walk(read.log, worldOf(read, {}), EVENTS);
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const read = logOf(name);
      expect(
        early(read.log, worldOf(read, { sweepEvents: false }), EVENTS),
      ).toEqual([]);
    });
});

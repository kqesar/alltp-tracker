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
// fork's own entrance shuffles, District and Swapped, one District seed
// with Mixed, each entrance noted as its `Entrances` says), in the world the app
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
  type DrNotedEntrances,
  drWorld,
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
  early,
  flag,
  jsonLog,
  type Log,
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
      readonly entrances: boolean;
    }
  >
> = {
  "owr-crossed-spoilers": { crossed: true, entrances: false, mixed: false },
  "owr-entrance-spoilers": { crossed: false, entrances: true },
  "owr-mixed-spoilers": { entrances: false, mixed: true },
  "owr-spoilers": { crossed: false, entrances: false, mixed: false },
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

/** A log's set's kind. */
const setOf = (path: string) => {
  const set = SETS[path.split("/")[0] ?? ""];
  if (set === undefined) throw new RangeError(`No set for ${path}`);
  return set;
};

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
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed: every one turns `yes` once the dungeon's keys
 * (its chests' and its pots') are all held (checked 2026-10-30).
 */
const REVIEWED: Readonly<
  Record<string, { readonly why: string; readonly at: Record<string, string> }>
> = {
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
};

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

/** A log's entrance shuffle, the fork's own (District, Swapped). */
const shuffleOf = (log: Log): OwrShuffle => {
  const { shuffle } = log.meta;
  if (shuffle !== "district" && shuffle !== "swapped")
    throw new RangeError(`Not an entrance shuffle of the fork: ${shuffle}`);
  return shuffle;
};

/**
 * A log's shuffled entrances, noted as its `Entrances` says: each entrance
 * the fork's pool may move (both start houses' doors, as a run noting
 * them all would) to the target it took.
 */
function entranceNotesOf(log: Log): DrNotedEntrances {
  const pool = poolOf(log.meta);
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

/** A log, its settings those the fork's world holds, and its notes. */
function logOf(name: string): {
  log: Log;
  notes: OwrNotes;
  farms: readonly string[];
  entrances?: DrNotedEntrances;
} {
  const json = JSON.parse(read(name)) as Json;
  const { Maps: maps, Overworld: edges, Whirlpools: pools, ...rest } = json;
  const { farms, log } = withoutPrizeFarms(jsonLog(rest));
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
    "vanilla",
    set.entrances,
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
  return {
    farms,
    log,
    notes: owrNotesFromSpoiler(
      json as Parameters<typeof owrNotesFromSpoiler>[0],
    ),
    ...(set.entrances ? { entrances: entranceNotesOf(log) } : {}),
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
  }: {
    readonly log: Log;
    readonly notes: OwrNotes;
    readonly entrances?: DrNotedEntrances;
  },
  options: { readonly sweepEvents?: boolean },
) => {
  const { meta } = log;
  const bonks = flag(meta.bonk_drops);
  return drWorld(
    {
      ...settingsFor(meta),
      ...(meta.mode === "inverted" ? { invertedMode: true } : {}),
      ...(bonks ? { bonkDrops: true } : {}),
      ...(entrances === undefined
        ? {}
        : { [`shuffle_${entrances.shuffle}`]: true }),
    },
    {
      data: OWR_DATA,
      overworld: notes,
      ...(entrances === undefined ? {} : { entrances }),
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

  it("reads Open and Inverted seeds, bonk drops, whirlpools and flute spots shuffled and not, edges crossed, screens flipped, entrances shuffled", () => {
    const seen = logs.map((name) => {
      const { meta } = logOf(name).log;
      return `${meta.mode} ${flag(meta.bonk_drops)} ${flag(meta.ow_whirlpool)} ${meta.ow_fluteshuffle} ${meta.ow_crossed} ${flag(meta.ow_mixed)} ${meta.shuffle} ${meta.keyshuffle}`;
    });
    expect(seen.sort()).toEqual([
      "inverted false false vanilla none false vanilla none",
      "inverted false false vanilla none true vanilla none",
      "inverted false true balanced none false vanilla none",
      "inverted true false vanilla none false vanilla none",
      "open false false vanilla grouped false vanilla none",
      "open false false vanilla grouped true vanilla none",
      "open false false vanilla none false district none",
      "open false false vanilla none false swapped none",
      "open false false vanilla none false swapped wild",
      "open false false vanilla none false vanilla none",
      "open false false vanilla none true district none",
      "open false false vanilla none true vanilla none",
      "open false false vanilla unrestricted false vanilla none",
      "open false true random none false vanilla none",
      "open false true vanilla none true vanilla none",
      "open true false vanilla none false vanilla none",
    ]);
  });

  it("offers each entrance a shuffled seed moved, and its target; the rest stand", () => {
    const shuffled = logs.filter((name) => setOf(name).entrances);
    expect(shuffled).toHaveLength(4);
    const maps = vanillaEntrances(false);
    for (const name of shuffled) {
      const { log, notes, entrances } = logOf(name);
      const screens = owrScreensOf(OWR_DATA, "open", notes);
      const pool = owrEntrancePool(shuffleOf(log), {
        ...poolOf(log.meta),
        bombShopStart: screens.swapped(0x2c),
      });
      const ways = log.Entrances.filter((link) => link.direction !== "exit");
      expect(ways).toHaveLength(140);
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
        "Links House",
      );
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
      ).toBeGreaterThan(50);
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
      const moved = owrShuffled({
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

// The Overworld Randomizer's world held to seeds of the fork itself: each
// log of test/owr-spoilers/ (recorded by scripts/record-dr-spoilers.mjs owr:
// avianart.games seeds of OWR 0.8.0.2 on DR 1.5.7, generated for it, the
// overworld, doors and entrances vanilla, Open and Inverted, bonk drops
// shuffled or not, as no OWR race's spoiler is public), in the world the
// app solves an OWR run in (drWorld on OWR_DATA, its bonk drops added as the
// app adds them, `doorAddedOf`).
//
// The walks are test/dr-playthrough.ts's: a location of sphere k is `yes`
// with the items of the spheres before it held, unless the reviewed list
// says why not, and no location of a later sphere is `yes` too early.

import { describe, expect, it } from "vitest";
import { BONK_DROPS } from "../src/door-rando/bonk";
import rules from "../src/door-rando/owr/rules.json" with { type: "json" };
import { drWorld } from "../src/door-world/index";
import { factOf } from "../src/door-world/overworld";
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

const read = (name: string) => readFixture("owr-spoilers", name);

const INDEX = JSON.parse(read("index.json")) as {
  logs: Readonly<Record<string, unknown>>;
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

/** A log, its settings those the fork's world holds. */
function logOf(name: string): { json: Json; log: Log } {
  const json = JSON.parse(read(name)) as Json;
  const { Maps: maps, Overworld: edges, Whirlpools: pools, ...rest } = json;
  // The overworld left as it is: no edge, whirlpool or flute spot moved
  expect([edges, pools, maps]).toEqual([[], [], []]);
  const log = jsonLog(rest);
  const { meta } = log;
  expect([
    meta.door_shuffle,
    meta.shuffle,
    meta.logic,
    meta.ow_layout,
    meta.ow_crossed,
    flag(meta.ow_mixed),
    flag(meta.ow_whirlpool),
    meta.ow_fluteshuffle,
    meta.prizeshuffle,
    flag(meta.shuffle_followers),
    flag(meta.bombbag),
  ]).toEqual([
    "vanilla",
    "vanilla",
    "noglitches",
    "vanilla",
    "none",
    false,
    false,
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
  return { json, log };
}

/** A log's world: the fork's, its mode and its bonk drops as it says. */
const worldOf = (log: Log, options: { readonly sweepEvents?: boolean }) => {
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
  const logs = Object.keys(INDEX.logs);

  it("reads Open and Inverted seeds, bonk drops shuffled and not", () => {
    const seen = logs.map((name) => {
      const { meta } = logOf(name).log;
      return `${meta.mode} ${flag(meta.bonk_drops)}`;
    });
    expect(seen.sort()).toEqual([
      "inverted false",
      "inverted true",
      "open false",
      "open true",
    ]);
  });

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const { log } = logOf(name);
      const { checked, notYes } = walk(log, worldOf(log, {}), EVENTS);
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const { log } = logOf(name);
      expect(early(log, worldOf(log, { sweepEvents: false }), EVENTS)).toEqual(
        [],
      );
    });
});

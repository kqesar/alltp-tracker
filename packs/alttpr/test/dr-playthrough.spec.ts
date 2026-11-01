// The Door Randomizer's world held to real seeds: the playthrough of each
// spoiler race DR wrote (test/dr-spoilers/, recorded by
// scripts/record-dr-spoilers.mjs; DR 1.5.7-u for ten, 1.5.8-u and 1.5.6-u
// for one each, whose playthrough code is the same from 1.5.6 to 1.5.8),
// entrances vanilla. The walks are test/dr-playthrough.ts's: a location of
// sphere k is `yes` with the items of the spheres before it held, unless
// the reviewed list below says why not, and no location of a later sphere
// is yes too early (`early`).

import { describe, expect, it } from "vitest";
import { DR_DATA } from "../src/door-world/dr-data";
import { drWorld } from "../src/door-world/index";
import {
  early,
  type Log,
  readFixture,
  settingsFor,
  textLog,
  walk,
} from "./dr-playthrough";

const read = (name: string) => readFixture("dr-spoilers", name);

const INDEX = JSON.parse(read("index.json")) as {
  logs: Readonly<Record<string, unknown>>;
};

/**
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed.
 */
const REVIEWED: Readonly<
  Record<string, { readonly why: string; readonly at: Record<string, string> }>
> = {
  // Misery Mire's blue barriers open to two keys only where DR knows which
  // keys lie behind them (DoorShuffle.py:298-307, Rules.py:2356-2358): the
  // world says maybe (keys.ts). Thieves' Town's big chest: its key door's
  // rule rests on where a key lies (AllowSmall, Rules.py:2431-2446)
  "DR_278438665_Spoiler.txt": {
    at: {
      "7:Misery Mire - Map Chest": "maybe",
      "8:Thieves' Town - Big Chest": "maybe",
    },
    why: "Mire's crystal alternative; a placement-dependent key rule",
  },
};

/** A log, its settings those the vanilla world holds. */
function logOf(name: string): Log {
  const log = textLog(read(name));
  const { meta } = log;
  expect([meta.mode, meta.door_shuffle, meta.shuffle, meta.logic]).toEqual([
    "open",
    "vanilla",
    "vanilla",
    "noglitches",
  ]);
  return log;
}

describe("DR's world against real seeds' playthroughs", () => {
  const logs = Object.keys(INDEX.logs);

  it("reads at least ten seeds", () => {
    expect(logs.length).toBeGreaterThanOrEqual(10);
  });

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const log = logOf(name);
      const { checked, notYes } = walk(
        log,
        drWorld(settingsFor(log.meta), { data: DR_DATA }),
      );
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const log = logOf(name);
      expect(
        early(
          log,
          drWorld(settingsFor(log.meta), { data: DR_DATA, sweepEvents: false }),
        ),
      ).toEqual([]);
    });
});

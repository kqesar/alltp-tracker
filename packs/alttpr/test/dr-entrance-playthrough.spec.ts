// The Door Randomizer's world on shuffled entrances, held to real seeds:
// each log of test/dr-entrance-spoilers/ (recorded by
// scripts/record-dr-spoilers.mjs entrances: every spoiler race of
// racetime.gg's alttpr category whose DR log shuffles entrances and has a
// playthrough, Crosskeys on DR 1.4.8 and 1.4.8.1, and an avianart.games
// Crosskeys seed of DR 1.5.8, generated for it),
// its entrances noted as its spoiler says, as a player notes them.
//
// - Its pool (`drEntrancePool`) offers each door the log moved, with the
//   target it took; a door the pool keeps leads where the vanilla world
//   leads it in the log too (the pool never keeps what DR moved).
// - The playthrough both ways (test/dr-playthrough.ts): each sphere `yes`
//   with the spheres before it, but where the reviewed list says why not,
//   and no location of a later sphere `yes` too early.

import { describe, expect, it } from "vitest";
import {
  type DrShuffle,
  drEntranceName,
  drEntranceOf,
  drEntrancePool,
  drTargetOf,
  vanillaEntrances,
} from "../src/door-rando/entrances";
import { DR_DATA } from "../src/door-world/dr-data";
import { drWorld } from "../src/door-world/index";
import {
  early,
  jsonLog,
  type Log,
  entranceNotesOf as notesOf,
  notYesWithEveryKey,
  poolOf,
  readFixture,
  settingsFor,
  textLog,
  walk,
} from "./dr-playthrough";

const read = (name: string) => readFixture("dr-entrance-spoilers", name);

const INDEX = JSON.parse(read("index.json")) as {
  logs: Readonly<Record<string, unknown>>;
};

/** A recorded log, text (a race's) or JSON (avianart's). */
const logOf = (name: string): Log =>
  name.endsWith(".json")
    ? jsonLog(JSON.parse(read(name)))
    : textLog(read(name));

/**
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed: every one turns `yes` once the dungeon's keys are
 * all held (checked 2026-10-30), so each is a key door read strict-safe
 * where DR's analysis counts fewer.
 */
const STRICT_SAFE =
  "its dungeon's portals not all reached by the walk (portalsKnown): its key doors ask every key";
const MIRE =
  "Mire's blue barriers open to two keys only where DR knows which lie behind them (DoorShuffle.py:298-307)";
const REVIEWED: Readonly<
  Record<string, { readonly why: string; readonly at: Record<string, string> }>
> = {
  "DR_545713192_Spoiler.txt": {
    at: {
      "3:Desert Palace - Beamos Hall Pot Key": "maybe",
      "4:Misery Mire - Main Lobby": "maybe",
      "4:Misery Mire - Map Chest": "maybe",
    },
    why: `Desert Palace: ${STRICT_SAFE}; ${MIRE}`,
  },
  "DR_643975221_Spoiler.txt": {
    at: {
      "2:Hyrule Castle - Boomerang Guard Key Drop": "maybe",
      "2:Hyrule Castle - Key Rat Key Drop": "maybe",
    },
    why: `Hyrule Castle: ${STRICT_SAFE}`,
  },
  "DR_662971471_Spoiler.txt": {
    at: { "11:Turtle Rock - Prize": "maybe" },
    why: `Turtle Rock: ${STRICT_SAFE}`,
  },
  "DR_832495269_Spoiler.txt": {
    at: { "6:Misery Mire - Main Lobby": "maybe" },
    why: MIRE,
  },
};

describe("DR's world on shuffled entrances against real seeds", () => {
  const logs = Object.keys(INDEX.logs);

  it("reads the races and the seed recorded", () => {
    expect(logs.length).toBeGreaterThanOrEqual(6);
  });

  for (const name of logs)
    it(`offers each door the log moved, and its target (${name})`, () => {
      const log = logOf(name);
      expect([log.meta.mode, log.meta.door_shuffle, log.meta.logic]).toEqual([
        "open",
        "vanilla",
        "noglitches",
      ]);
      const shuffle = log.meta.shuffle as DrShuffle;
      const pool = drEntrancePool(shuffle, poolOf(log.meta));
      const maps = vanillaEntrances(false);
      const ways = log.Entrances.filter((link) => link.direction !== "exit");
      expect(ways.length).toBeGreaterThan(100);
      const kept: string[] = [];
      for (const link of ways) {
        const entrance = drEntranceOf(link.entrance);
        const target = drTargetOf(link.exit);
        const offered = pool.targetsOf.get(entrance.id);
        if (offered === undefined) {
          // Kept by the pool: where the vanilla world leads it
          const vanilla =
            maps.twoWay.get(link.entrance) ?? maps.oneWay.get(link.entrance);
          if (vanilla !== link.exit) kept.push(link.entrance);
          continue;
        }
        expect(
          offered.map((t) => t.id),
          `${link.entrance} → ${link.exit}`,
        ).toContain(target.id);
      }
      expect(kept).toEqual([]);
      // Every door the pool moves is noted
      const { noted } = notesOf(log);
      expect(
        pool.entrances
          .filter((entrance) => noted[entrance.id] === undefined)
          .map((entrance) => drEntranceName(entrance.id)),
      ).toEqual([]);
    });

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const log = logOf(name);
      const world = drWorld(settingsFor(log.meta), {
        data: DR_DATA,
        entrances: notesOf(log),
      });
      const { checked, notYes } = walk(log, world);
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
      // Each a key door's, as reviewed: yes once every key is held
      expect(notYesWithEveryKey(log, world, notYes)).toEqual([]);
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const log = logOf(name);
      const world = drWorld(settingsFor(log.meta), {
        data: DR_DATA,
        entrances: notesOf(log),
        sweepEvents: false,
      });
      expect(early(log, world)).toEqual([]);
    });
});

// The Door Randomizer's world on shuffled doors, held to real seeds: each
// log of test/dr-door-spoilers/ (recorded by scripts/record-dr-spoilers.mjs
// doors: avianart.games seeds of DR 1.5.8 generated for it, basic,
// partitioned and crossed at each intensity, decoupled, Inverted, and
// crossed with Crosskeys' entrances, as no door-shuffled race's spoiler is
// public), its doors noted as its spoiler says (doors.ts
// doorNotesFromSpoiler), as a player who walked them notes them, and its
// entrances too where they are shuffled.
//
// - Its model offers each link, lobby and kind the log made: each door it
//   links is one the shuffle relinks and its pair a door the picker offers
//   it, each lobby a door the portal may open on, each kind a door the
//   shuffle may change.
// - Each room is in the dungeon the log puts its locations in (`@`).
// - The playthrough both ways (test/dr-playthrough.ts): each sphere `yes`
//   with the spheres before it, but where the reviewed list says why not,
//   and no location of a later sphere `yes` too early.
import { describe, expect, it } from "vitest";
import { DR_DATA } from "../src/door-world/dr-data";
import {
  doorNotesFromSpoiler,
  doorTargets,
  drWorld,
  isShuffledDoor,
  kindShuffled,
  lobbyDoors,
} from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import { type Medallion, medallionFacts } from "../src/medallions";
import {
  doorLog,
  doorNotesOf,
  doorShuffleOf,
  EVERY_KEY,
  plain,
  withoutDoors,
} from "./dr-doors";
import {
  early,
  entranceNotesOf,
  flag,
  jsonLog,
  type Log,
  readFixture,
  settingsFor,
  walk,
} from "./dr-playthrough";
import { collect } from "./dr-state";

const read = (name: string) => readFixture("dr-door-spoilers", name);

const INDEX = JSON.parse(read("index.json")) as {
  logs: Readonly<Record<string, unknown>>;
};

type Json = Readonly<Record<string, unknown>>;

/** A log's JSON, its locations named as DR's world names them. */
const logOf = (json: Json): Log =>
  doorLog(jsonLog(withoutDoors(json)), DR_DATA);

/** A log's door notes, its dungeons' keys counted (dr-doors.ts). */
const notesOf = (json: Json, log: Log) =>
  doorNotesOf(
    json,
    log.meta,
    DR_DATA,
    (notes, settings) =>
      drWorld(settingsOf(log.meta), {
        data: DR_DATA,
        doors: { notes, settings },
      }).roomDungeons,
  );

/** A log's door shuffle. */
const shuffleOf = doorShuffleOf;

/** The world's settings for a log's header. */
const settingsOf = (meta: Log["meta"]) => ({
  ...settingsFor(meta),
  ...(meta.mode === "standard" ? { standardMode: true } : {}),
  ...(meta.mode === "inverted" ? { invertedMode: true } : {}),
  ...(flag(meta.bombbag) ? { bombBag: true } : {}),
});

/** A log's world: its doors noted, and its entrances where shuffled. */
const worldOf = (
  json: Json,
  log: Log,
  options: { readonly sweepEvents?: boolean } = {},
) =>
  drWorld(settingsOf(log.meta), {
    data: DR_DATA,
    doors: notesOf(json, log),
    ...(log.meta.shuffle === "vanilla"
      ? {}
      : { entrances: entranceNotesOf(log) }),
    ...options,
  });

/**
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer. Each is a key door read strict-safe (shuffle.ts): DR analyses the
 * layout it generated (KeyDoorShuffle.py) and asks fewer keys than all of
 * the dungeon's, which the notes cannot tell. The walk holds each to that:
 * every one turns `yes` once every key is held.
 */
const REVIEWED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "avianart-1d6rBFvOW.json": {
    "5:Swamp Palace - Boss": "maybe",
    "5:Swamp Palace - Prize": "maybe",
    "11:Agahnim 2": "maybe",
  },
  "avianart-4L77dyaAg.json": {
    "4:Agahnim 1": "maybe",
    "4:Ice Palace - Spike Room": "maybe",
    "4:Palace of Darkness - The Arena - Bridge": "maybe",
    "5:Swamp Palace - Waterway Pot Key": "maybe",
    "6:Ganons Tower - Validation Chest": "maybe",
    "6:Swamp Palace - Prize": "maybe",
    "8:Ice Palace - Prize": "maybe",
    "10:Eastern Palace - Big Chest": "maybe",
    "10:Ganons Tower - DMs Room - Bottom Right": "maybe",
    "10:Ganons Tower - DMs Room - Top Right": "maybe",
    "10:Turtle Rock - Crystaroller Room": "maybe",
    "13:Palace of Darkness - Dark Maze - Bottom": "maybe",
  },
  "avianart-7SFJ6YE0k.json": {
    "5:Misery Mire - Prize": "maybe",
    "5:Swamp Palace - Pot Row Pot Key": "maybe",
    "9:Desert Palace - Desert Tiles 1 Pot Key": "maybe",
    "9:Hyrule Castle - Boomerang Guard Key Drop": "maybe",
    "9:Hyrule Castle - Key Rat Key Drop": "maybe",
    "9:Thieves' Town - Spike Switch Pot Key": "maybe",
    "10:Ganons Tower - Conveyor Cross Pot Key": "maybe",
    "10:Swamp Drain": "maybe",
    "11:Desert Palace - Boss": "maybe",
    "11:Palace of Darkness - The Arena - Ledge": "maybe",
    "12:Ice Palace - Spike Room": "maybe",
    "14:Ice Palace - Prize": "maybe",
  },
  "avianart-CURaRjUhM.json": {
    "2:Suspicious Maiden": "maybe",
    "4:Ganons Tower - Compass Room - Bottom Left": "maybe",
    "4:Misery Mire - Prize": "maybe",
    "4:Palace of Darkness - Prize": "maybe",
    "5:Attic Cracked Floor": "maybe",
  },
  "avianart-D14rBE1uq.json": {
    "4:Swamp Palace - Boss": "maybe",
    "5:Ice Palace - Prize": "maybe",
    "5:Skull Woods - Prize": "maybe",
    "6:Turtle Rock - Prize": "maybe",
    "7:Agahnim 2": "maybe",
  },
  "avianart-fKa1LLrNU.json": {
    "1:Misery Mire - Fishbone Pot Key": "maybe",
    "4:Desert Palace - Prize": "maybe",
  },
  "avianart-giw5Y13cP.json": {
    "3:Swamp Palace - Waterfall Room": "maybe",
    "6:Ice Palace - Prize": "maybe",
  },
  "avianart-uMJQnKFrH.json": {
    "5:Ganons Tower - Conveyor Star Pits Pot Key": "maybe",
    "5:Ice Palace - Conveyor Key Drop": "maybe",
    "5:Ice Palace - Prize": "maybe",
    "5:Misery Mire - Spikes Pot Key": "maybe",
    "5:Swamp Palace - Trench 2 Pot Key": "maybe",
    "6:Hyrule Castle - Key Rat Key Drop": "maybe",
    "6:Misery Mire - Prize": "maybe",
    "6:Tower of Hera - Prize": "maybe",
    "7:Eastern Palace - Dark Square Pot Key": "maybe",
    "7:Ganons Tower - Mini Helmasaur Key Drop": "maybe",
    "7:Turtle Rock - Pokey 2 Key Drop": "maybe",
    "8:Misery Mire - Fishbone Pot Key": "maybe",
    "8:Skull Woods - Prize": "maybe",
    "9:Ganons Tower - Pre-Moldorm Chest": "maybe",
  },
  "avianart-w6Jx8UcW6.json": { "10:Agahnim 2": "maybe" },

  "avianart-xd8m0E50c.json": {
    "7:Ganons Tower - Conveyor Cross Pot Key": "maybe",
    "7:Misery Mire - Prize": "maybe",
  },
};

describe("DR's world on shuffled doors against real seeds", () => {
  const logs = Object.keys(INDEX.logs);

  it("reads the seeds recorded: every shuffle, every intensity", () => {
    const metas = logs.map(
      (name) => (JSON.parse(read(name)) as Json).meta as Log["meta"],
    );
    const kinds = new Set(metas.map((m) => `${m.door_shuffle} ${m.intensity}`));
    for (const shuffle of ["basic", "partitioned", "crossed"])
      expect([...kinds].some((k) => k.startsWith(shuffle))).toBe(true);
    for (const intensity of [1, 2, 3])
      expect([...kinds].some((k) => k.endsWith(` ${intensity}`))).toBe(true);
    // Decoupled doors, the Inverted world, entrances shuffled with doors
    expect(metas.some((m) => flag(m.decoupledoors))).toBe(true);
    expect(metas.some((m) => m.mode === "inverted")).toBe(true);
    expect(metas.some((m) => m.shuffle === "crossed")).toBe(true);
  });

  for (const name of logs)
    it(`offers each link, lobby and kind the log made (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const settings = shuffleOf(json.meta as Log["meta"]);
      const doors = json.Doors as readonly { entrance: string; exit: string }[];
      expect(doors.length).toBeGreaterThan(150);
      for (const { entrance, exit } of doors) {
        const a = DR_DATA.doorByName.get(entrance);
        const b = DR_DATA.doorByName.get(exit);
        if (a === undefined || b === undefined) throw new Error(entrance);
        expect(isShuffledDoor(a, settings, DR_DATA), entrance).toBe(true);
        expect(
          doorTargets(a, settings, DR_DATA).map((d) => d.name),
          `${entrance} → ${exit}`,
        ).toContain(exit);
      }
      for (const { door_name, lobby_name } of (json.Lobbies ?? []) as {
        door_name: string;
        lobby_name: string;
      }[])
        expect(
          lobbyDoors(lobby_name, settings.shuffle, DR_DATA).map((d) => d.name),
        ).toContain(door_name);
      const notes = doorNotesFromSpoiler(json, settings, DR_DATA);
      for (const [id, kind] of Object.entries(notes.kinds ?? {}))
        if (kind !== "normal")
          expect(
            [...DR_DATA.doorByName.values()].some(
              (d) => kindShuffled(d, settings) && notes.kinds?.[id] === kind,
            ),
          ).toBe(true);
    });

  for (const name of logs)
    it(`puts each room in the dungeon the log does (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const log = jsonLog(withoutDoors(json));
      const world = worldOf(json, logOf(json));
      const regionOf = new Map(
        DR_DATA.regions.flatMap((r) =>
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

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const log = logOf(json);
      const world = worldOf(json, log);
      const { checked, notYes } = walk(log, world);
      expect(checked).toBeGreaterThan(15);
      expect(notYes).toEqual(REVIEWED[name] ?? {});
      // Each a key door's: yes once every key is held
      for (const at of Object.keys(notYes)) {
        const sphere = Number(at.slice(0, at.indexOf(":")));
        const location = at.slice(at.indexOf(":") + 1);
        const items = [
          ...((log.playthrough["0"] as readonly string[]) ?? []),
          ...Array.from({ length: sphere - 1 }, (_, i) =>
            Object.values(log.playthrough[i + 1] as Record<string, string>),
          ).flat(),
          ...EVERY_KEY,
        ].filter((item) => item !== "Never in logic");
        const state = {
          ...collect(items),
          ...medallionFacts({
            mire: String(log.Special["Misery Mire"]).toLowerCase() as Medallion,
            turtleRock: String(
              log.Special["Turtle Rock"],
            ).toLowerCase() as Medallion,
          }),
        };
        expect(
          solveFacts(world, state).location(
            world.locationIds.get(location) ?? "",
          ),
          at,
        ).toBe("yes");
      }
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const log = logOf(json);
      const world = worldOf(json, log, { sweepEvents: false });
      expect(early(log, world)).toEqual([]);
    });
});

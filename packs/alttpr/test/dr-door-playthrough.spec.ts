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
import { DR_LOCATIONS } from "../src/door-rando/locations";
import { DR_DATA } from "../src/door-world/dr-data";
import {
  type DoorShuffleSettings,
  doorNotesFromSpoiler,
  doorTargets,
  drWorld,
  isShuffledDoor,
  kindShuffled,
  lobbyDoors,
} from "../src/door-world/index";
import { forgetNotedKeyLogic } from "../src/door-world/key-analysis/noted";
import { keyDropsOf } from "../src/door-world/keys";
import { solveFacts } from "../src/facts";
import { type Medallion, medallionFacts } from "../src/medallions";
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

/** A location's name without the dungeon a crossed log adds (`@ Dungeon`). */
const plain = (name: string) => name.replace(/ @ [^@]+$/, "");

/** A log's JSON, its door sections aside (jsonLog reads the rest). */
const withoutDoors = (json: Json): Json => {
  const { DoorTypes: _types, Doors: _doors, Lobbies: _lobbies, ...rest } = json;
  return rest;
};

/**
 * The vanilla drops whose keys a log forces (its dropshuffle and pottery
 * leave them): their keys are the world's facts (keys.ts), which a player
 * does not record, so the walk holds no item for them.
 */
const forcedDrops = (meta: Log["meta"]): ReadonlySet<string> =>
  new Set(
    keyDropsOf(DR_DATA)
      .filter((d) =>
        d.pot
          ? ["none", "cave"].includes(String(meta.pottery ?? "none"))
          : String(meta.dropshuffle ?? "none") === "none",
      )
      .map((d) => d.location),
  );

/** A log's JSON, its locations named as DR's world names them. */
function logOf(json: Json): Log {
  const log = jsonLog(withoutDoors(json));
  const forced = forcedDrops(log.meta);
  const strip = (section: Readonly<Record<string, string>>) =>
    Object.fromEntries(
      Object.entries(section).map(([k, v]) => [
        plain(k),
        forced.has(plain(k)) ? "Never in logic" : v,
      ]),
    );
  return {
    ...log,
    Locations: strip(log.Locations),
    playthrough: Object.fromEntries(
      Object.entries(log.playthrough).map(([k, sphere]) => [
        k,
        Array.isArray(sphere)
          ? sphere
          : strip(sphere as Record<string, string>),
      ]),
    ),
  };
}

/** A log's door shuffle. */
const shuffleOf = (meta: Log["meta"]): DoorShuffleSettings => ({
  decoupled: flag(meta.decoupledoors),
  intensity: Number(meta.intensity) as 1 | 2 | 3,
  shuffle: meta.door_shuffle as DoorShuffleSettings["shuffle"],
  trapMode: meta.trap_door_mode as DoorShuffleSettings["trapMode"],
});

/** The dungeons by the word DR's items name them with. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  "Agahnims Tower": "Agahnims Tower",
  "Desert Palace": "Desert Palace",
  "Eastern Palace": "Eastern Palace",
  "Ganons Tower": "Ganons Tower",
  "Hyrule Castle": "Escape",
  "Ice Palace": "Ice Palace",
  "Misery Mire": "Misery Mire",
  "Palace of Darkness": "Palace of Darkness",
  "Skull Woods": "Skull Woods",
  "Swamp Palace": "Swamp Palace",
  "Thieves Town": "Thieves Town",
  "Tower of Hera": "Tower of Hera",
  "Turtle Rock": "Turtle Rock",
};

/**
 * A log's door notes, and each dungeon's small keys as its counter shows
 * them: its chests' (the log's locations) and the forced drops its rooms
 * hold (update_forced_keys, DoorShuffle.py:1039-1050).
 */
function notesOf(json: Json, log: Log) {
  const settings = shuffleOf(log.meta);
  const notes = doorNotesFromSpoiler(json, settings, DR_DATA);
  const rooms =
    drWorld(settingsOf(log.meta), { data: DR_DATA, doors: { notes, settings } })
      .roomDungeons ?? new Map<string, string>();
  const chests = Object.values(jsonLog(withoutDoors(json)).Locations);
  const forced = forcedDrops(log.meta);
  const keys: Record<string, number> = {};
  for (const [dungeon, word] of Object.entries(KEY_NAMES))
    keys[dungeon] =
      chests.filter((item) => item === `Small Key (${word})`).length +
      keyDropsOf(DR_DATA).filter(
        (d) =>
          !d.big &&
          forced.has(d.location) &&
          rooms.get(REGION_OF.get(d.location) ?? "") === dungeon,
      ).length;
  return { notes: { ...notes, keys }, settings };
}

/** The region of each DR location (its own and its key drops). */
const REGION_OF: ReadonlyMap<string, string> = new Map([
  ...DR_DATA.regions.flatMap((r) =>
    r.locations.map((l) => [l, r.name] as const),
  ),
  ...DR_LOCATIONS.map((l) => [l.name, l.region] as const),
]);

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
 * answer. Below intensity 3 with vanilla entrances and coupled doors, the
 * notes tell each layout whole and DR's own analysis of it is run
 * (key-analysis/noted.ts): what stays is a rule's placement alternative,
 * xd8m0E50c's Misery Mire (its big key behind a door, the `(Lock, big
 * key)` branch DR's fill made true, maybe while the tracker cannot know
 * where the big key lies). Elsewhere (intensity 3, shuffled entrances,
 * decoupled doors) each is a key door read strict-safe (shuffle.ts): DR
 * asks fewer keys than all of the dungeon's, from start regions its own
 * random portal choices decide. The walk holds each to that: every one
 * turns `yes` once every key is held.
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
  "avianart-CURaRjUhM.json": {
    "2:Suspicious Maiden": "maybe",
    "4:Ganons Tower - Compass Room - Bottom Left": "maybe",
    "4:Misery Mire - Prize": "maybe",
    "4:Palace of Darkness - Prize": "maybe",
    "5:Attic Cracked Floor": "maybe",
  },
  "avianart-fKa1LLrNU.json": {
    "1:Misery Mire - Fishbone Pot Key": "maybe",
    "4:Desert Palace - Prize": "maybe",
  },
  "avianart-xd8m0E50c.json": { "7:Misery Mire - Prize": "maybe" },
};

/** Every key and big key DR's items name, thirty of each small key. */
const EVERY_KEY = Object.values(KEY_NAMES).flatMap((word) => [
  ...Array.from({ length: 30 }, () => `Small Key (${word})`),
  `Big Key (${word})`,
]);

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

  it("runs DR's key analysis on each layout the notes tell whole, below intensity 3 alone", () => {
    const analysed = Object.fromEntries(
      logs.map((name) => {
        const json = JSON.parse(read(name)) as Json;
        const keyLogic = worldOf(json, logOf(json)).doorKeyLogic;
        return [name, keyLogic === undefined ? -1 : keyLogic.size];
      }),
    );
    // Every dungeon of a seed at intensity 1 or 2, coupled, entrances
    // vanilla (but Standard's escape); none at 3, decoupled or with ER
    expect(analysed).toEqual({
      "avianart-1d6rBFvOW.json": 0,
      "avianart-2uDU33UMw.json": 0,
      "avianart-4L77dyaAg.json": -1,
      "avianart-7SFJ6YE0k.json": 13,
      "avianart-CURaRjUhM.json": 0,
      "avianart-D14rBE1uq.json": 13,
      "avianart-fKa1LLrNU.json": 0,
      "avianart-giw5Y13cP.json": 13,
      "avianart-gVe3VdZba.json": 0,
      "avianart-uMJQnKFrH.json": 13,
      "avianart-w6Jx8UcW6.json": 12,
      "avianart-xd8m0E50c.json": 12,
    });
  });

  it("counts each analysed layout's chest keys as the log holds them", () => {
    // calc_max_chests (KeyDoorShuffle.py:262-265) over the noted layout:
    // the small keys DR's pool held for the dungeon, which its fill placed
    // (each a "Small Key" item of the log, in a chest, or a drop's or pot's
    // where the run shuffles those)
    let compared = 0;
    for (const name of logs) {
      const json = JSON.parse(read(name)) as Json;
      const log = logOf(json);
      const placed = Object.values(jsonLog(withoutDoors(json)).Locations);
      for (const [dungeon, logic] of worldOf(json, log).doorKeyLogic ?? []) {
        const word = KEY_NAMES[dungeon];
        expect(logic.layout.maxChests, `${name}: ${dungeon}`).toBe(
          placed.filter((item) => item === `Small Key (${word})`).length,
        );
        compared++;
      }
    }
    // The six seeds whose layouts are analysed, every dungeon (but the
    // escape of the two Standard ones)
    expect(compared).toBe(76);
  });

  it("answers the same with each dungeon's analysis kept as worked out afresh", () => {
    for (const name of logs) {
      const json = JSON.parse(read(name)) as Json;
      const log = logOf(json);
      const items = [
        ...((log.playthrough["0"] as readonly string[]) ?? []),
        ...Object.keys(log.playthrough)
          .filter((k) => k !== "0")
          .flatMap((k) =>
            Object.values(log.playthrough[k] as Record<string, string>),
          ),
      ].filter((item) => item !== "Never in logic" && item !== "Triforce");
      const half = items.slice(0, Math.floor(items.length / 2));
      // Half the game's items, its keys among them: where key doors decide
      const answers = (world: ReturnType<typeof worldOf>) => {
        const solution = solveFacts(world, collect(half));
        return [...world.locationIds.values()].map((id) =>
          solution.location(id),
        );
      };
      forgetNotedKeyLogic();
      const fresh = worldOf(json, log);
      const kept = worldOf(json, log);
      // Kept: the very analyses, not worked out again
      for (const [dungeon, logic] of fresh.doorKeyLogic ?? [])
        expect(kept.doorKeyLogic?.get(dungeon), `${name}: ${dungeon}`).toBe(
          logic,
        );
      expect(answers(kept), name).toEqual(answers(fresh));
    }
    // Two worlds of each of the twelve seeds: past the pack's default
    // timeout under coverage, not hung
  }, 120_000);

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      const json = JSON.parse(read(name)) as Json;
      const log = logOf(json);
      const world = worldOf(json, log, { sweepEvents: false });
      expect(early(log, world)).toEqual([]);
    });
});

// A door-shuffled log's reading, shared by DR's door contract
// (dr-door-playthrough.spec.ts) and the Overworld Randomizer's
// (owr-door-playthrough.spec.ts), each on its own release's data: the log
// without its door sections and its rooms' dungeon tags, the vanilla drops
// whose keys are the world's facts, the shuffle its header names, and each
// dungeon's small keys as its counter shows them.
import { DR_LOCATIONS } from "../src/door-rando/locations";
import type { DrData } from "../src/door-world/data";
import {
  type DoorShuffleSettings,
  doorNotesFromSpoiler,
} from "../src/door-world/index";
import { keyDropsOf } from "../src/door-world/keys";
import { flag, jsonLog, type Log } from "./dr-playthrough";

type Json = Readonly<Record<string, unknown>>;

/** A location's name without the dungeon a crossed log adds (`@ Dungeon`). */
export const plain = (name: string) => name.replace(/ @ [^@]+$/, "");

/** A log's JSON, its door sections aside (jsonLog reads the rest). */
export const withoutDoors = (json: Json): Json => {
  const { DoorTypes: _types, Doors: _doors, Lobbies: _lobbies, ...rest } = json;
  return rest;
};

/**
 * The vanilla drops whose keys a log forces (its dropshuffle and pottery
 * leave them): their keys are the world's facts (keys.ts), which a player
 * does not record, so the walk holds no item for them.
 */
export const forcedDrops = (
  meta: Log["meta"],
  data: DrData,
): ReadonlySet<string> =>
  new Set(
    keyDropsOf(data)
      .filter((d) =>
        d.pot
          ? ["none", "cave"].includes(String(meta.pottery ?? "none"))
          : String(meta.dropshuffle ?? "none") === "none",
      )
      .map((d) => d.location),
  );

/**
 * A log read as its world names its locations: the dungeon tags gone, a
 * forced drop's key never held (`forcedDrops`).
 */
export function doorLog(log: Log, data: DrData): Log {
  const forced = forcedDrops(log.meta, data);
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
export const doorShuffleOf = (meta: Log["meta"]): DoorShuffleSettings => ({
  decoupled: flag(meta.decoupledoors),
  intensity: Number(meta.intensity) as 1 | 2 | 3,
  shuffle: meta.door_shuffle as DoorShuffleSettings["shuffle"],
  trapMode: meta.trap_door_mode as DoorShuffleSettings["trapMode"],
});

/** The dungeons by the word DR's items name them with. */
export const KEY_NAMES: Readonly<Record<string, string>> = {
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

/** Every key and big key DR's items name, thirty of each small key. */
export const EVERY_KEY = Object.values(KEY_NAMES).flatMap((word) => [
  ...Array.from({ length: 30 }, () => `Small Key (${word})`),
  `Big Key (${word})`,
]);

/** The region of each location of a release (its own and its key drops). */
const regionsOf = (data: DrData): ReadonlyMap<string, string> =>
  new Map([
    ...data.regions.flatMap((r) =>
      r.locations.map((l) => [l, r.name] as const),
    ),
    ...DR_LOCATIONS.map((l) => [l.name, l.region] as const),
  ]);

/**
 * A log's door notes, and each dungeon's small keys as its counter shows
 * them: its chests' (the log's locations) and the forced drops its rooms
 * hold (update_forced_keys, DoorShuffle.py:1039-1050).
 * @param roomsOf - The room dungeons of the world built on the notes
 */
export function doorNotesOf(
  json: Json,
  meta: Log["meta"],
  data: DrData,
  roomsOf: (
    notes: ReturnType<typeof doorNotesFromSpoiler>,
    settings: DoorShuffleSettings,
  ) => ReadonlyMap<string, string> | undefined,
) {
  const settings = doorShuffleOf(meta);
  const notes = doorNotesFromSpoiler(json, settings, data);
  const rooms = roomsOf(notes, settings) ?? new Map<string, string>();
  const chests = Object.values(jsonLog(withoutDoors(json)).Locations);
  const forced = forcedDrops(meta, data);
  const regionOf = regionsOf(data);
  const keys: Record<string, number> = {};
  for (const [dungeon, word] of Object.entries(KEY_NAMES))
    keys[dungeon] =
      chests.filter((item) => item === `Small Key (${word})`).length +
      keyDropsOf(data).filter(
        (d) =>
          !d.big &&
          forced.has(d.location) &&
          rooms.get(regionOf.get(d.location) ?? "") === dungeon,
      ).length;
  return { notes: { ...notes, keys }, settings };
}

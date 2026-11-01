// A door-shuffled log's reading, shared by DR's door contract
// (dr-door-playthrough.spec.ts) and the Overworld Randomizer's
// (owr-door-playthrough.spec.ts), each on its own release's data: the log
// without its door sections and its rooms' dungeon tags, the vanilla drops
// whose keys are the world's facts, the shuffle its header names, and each
// dungeon's small keys as its counter shows them.
import fc from "fast-check";
import { DR_LOCATIONS } from "../src/door-rando/locations";
import type { DrData } from "../src/door-world/data";
import {
  type DoorKindNote,
  type DoorNotes,
  doorId,
  isShuffledDoor,
  kindShuffled,
  portalId,
  vanillaKind,
} from "../src/door-world/doors";
import {
  type DoorShuffleSettings,
  type DrWorld,
  doorNotesFromSpoiler,
} from "../src/door-world/index";
import { keyDropsOf, UGLY_SMALLS } from "../src/door-world/keys";
import { solveFacts } from "../src/facts";
import {
  EVERY_KEY,
  flag,
  jsonLog,
  type Log,
  type WalkEvents,
} from "./dr-playthrough";
import { collect } from "./dr-state";

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

/**
 * The key analysis held to the strict-safe world of the same notes: over
 * random draws of a log's items (any of its playthrough's, a key among
 * them or not), each location the analysed world says `yes` to, the
 * strict-safe one says `yes` to with every key held besides. The analysis
 * only counts a door's keys, so a `yes` past a way no key opens would be
 * a walk of its own gone wrong. `failure`: the first location it says
 * `yes` to where no key path is; `raised`: the answers where it said `yes`
 * and strict-safe on the same items did not (the property not vacuous).
 */
export function withinStrictSafe(
  log: Log,
  analysed: DrWorld,
  strict: DrWorld,
  options: { readonly events?: WalkEvents; readonly runs: number },
): { readonly failure: string | undefined; readonly raised: number } {
  const items = [
    ...((log.playthrough["0"] as readonly string[]) ?? []),
    ...Object.keys(log.playthrough)
      .filter((k) => k !== "0")
      .flatMap((k) =>
        Object.values(log.playthrough[k] as Readonly<Record<string, string>>),
      ),
  ].filter((item) => item !== "Never in logic" && item !== "Triforce");
  const ids = [...analysed.locationIds.values()];
  let raised = 0;
  let failure: string | undefined;
  const property = fc.property(
    fc.subarray(items),
    fc.subarray([...EVERY_KEY], { maxLength: 40 }),
    (drawn, keys) => {
      const held = [...drawn, ...keys];
      const analysedSays = solveFacts(analysed, collect(held, options.events));
      const strictSays = solveFacts(strict, collect(held, options.events));
      const keyed = solveFacts(
        strict,
        collect([...held, ...EVERY_KEY], options.events),
      );
      for (const id of ids) {
        if (analysedSays.location(id) !== "yes") continue;
        if (keyed.location(id) !== "yes") {
          failure = id;
          return false;
        }
        if (strictSays.location(id) !== "yes") raised++;
      }
      return true;
    },
  );
  const result = fc.check(property, {
    endOnFailure: true,
    numRuns: options.runs,
    seed: 7,
  });
  return {
    failure: result.failed ? (failure ?? "an error") : undefined,
    raised,
  };
}

/**
 * The notes of a player whose seed kept every door where the vanilla
 * world has it (a layout DR may make): each shuffled door's vanilla pair,
 * each kind its room's, each portal on its own door.
 */
export function vanillaDoorNotes(
  s: DoorShuffleSettings,
  data: DrData,
): DoorNotes {
  const links: Record<string, string> = {};
  for (const table of [
    "default_door_connections",
    "default_one_way_connections",
    "spiral_staircases",
    "open_edges",
    "straight_staircases",
    "ladders",
  ])
    for (const [a, b] of data.pairsOf("DoorShuffle.py", table)) {
      const one = data.doors.find((d) => d.name === a);
      if (one === undefined || !isShuffledDoor(one, s, data)) continue;
      links[doorId(a)] = doorId(b);
      links[doorId(b)] = doorId(a);
    }
  const kinds: Record<string, DoorKindNote> = {};
  for (const door of data.doors)
    if (kindShuffled(door, s)) kinds[doorId(door.name)] = vanillaKind(door);
  const lobbies = Object.fromEntries(
    data.portals.map((p) => [portalId(p.name), doorId(p.door)]),
  );
  return { kinds, links, lobbies };
}

/** vanillaDoorNotes, its key doors DR's own (no ugly small key door). */
export function vanillaLayoutNotes(
  s: DoorShuffleSettings,
  data: DrData,
): DoorNotes {
  const notes = vanillaDoorNotes(s, data);
  // unmark_ugly_smalls (DoorShuffle.py:476-480): no key doors in DR
  const kinds = { ...notes.kinds };
  for (const name of UGLY_SMALLS) kinds[doorId(name)] = "normal";
  return { ...notes, kinds };
}

// The Door Randomizer's playthrough contract, shared by the vanilla-entrance
// races (dr-playthrough.spec.ts) and the shuffled-entrance ones
// (dr-entrance-playthrough.spec.ts): a recorded log read as one shape, the
// world's settings for its header, and the two walks.
//
// DR builds the playthrough in create_playthrough (Main.py:677-778 at DR
// 1.5.8): the spheres of the items the seed needs, each location of sphere k
// reached by DR's own logic with the items of the spheres before it, the
// dungeons' keys in their dungeons collected as DR's sweep reaches them
// (sweep_for_events(key_only=True), BaseClasses.py:1051-1066).
import { readFileSync } from "node:fs";
import type { State } from "@alltp/engine";
import {
  type DrPoolSettings,
  type DrShuffle,
  drEntranceOf,
  drEntrancePool,
  drTargetOf,
} from "../src/door-rando/entrances";
import type { DrNotedEntrances } from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import type { Medallion } from "../src/medallions";
import { medallionFacts } from "../src/medallions";
import { settingsFromUpstream } from "../src/settings";
import { textDocument } from "../src/spoiler/dr";
import { collect, settingsOf } from "./dr-state";

/** One line of a log's `Entrances`, as DR's JSON writes it. */
export interface LogEntrance {
  readonly entrance: string;
  readonly exit: string;
  readonly direction: "both" | "entrance" | "exit";
}

/** A recorded log, text or JSON, as the walks read it. */
export interface Log {
  readonly meta: Readonly<Record<string, unknown>>;
  readonly Locations: Readonly<Record<string, string>>;
  readonly Special: Readonly<Record<string, string>>;
  readonly playthrough: Readonly<
    Record<string, readonly string[] | Readonly<Record<string, string>>>
  >;
  readonly Entrances: readonly LogEntrance[];
}

/** The world a walk asks: its location ids and a solve. */
export interface PlaythroughWorld {
  readonly locationIds: ReadonlyMap<string, string>;
}

const DIRECTIONS = { "<=": "exit", "<=>": "both", "=>": "entrance" } as const;

/**
 * DR's text log (`DR_<seed>_Spoiler.txt`): the parser's document, and its
 * Entrances section (to_file, BaseClasses.py:2877-2900 at 1.5.8: `entrance
 * <=> exit` both ways, `=>` one way in, `<=` one way out), which the review
 * does not read.
 */
export function textLog(text: string): Log {
  const doc = textDocument(text) as unknown as Omit<Log, "Entrances">;
  const entrances: LogEntrance[] = [];
  const lines = text.split(/\r?\n/);
  let inside = false;
  for (const [at, line] of lines.entries()) {
    if (/^[A-Z][^:]*:$/.test(line) && (lines[at - 1] ?? "") === "") {
      inside = line === "Entrances:";
      continue;
    }
    const link = inside ? /^(.+?) (<=>|=>|<=) (.+)$/.exec(line) : null;
    if (link !== null)
      entrances.push({
        direction: DIRECTIONS[link[2] as keyof typeof DIRECTIONS],
        entrance: link[1] as string,
        exit: link[3] as string,
      });
  }
  return { ...doc, Entrances: entrances };
}

/** Keys of DR's JSON spoiler that hold no locations (to_json). */
const NOT_LOCATIONS = new Set([
  "meta",
  "Entrances",
  "Starting Inventory",
  "Special",
  "Shops",
  "Bosses",
  "playthrough",
]);

/**
 * DR's JSON spoiler as avianart serves it (flat `meta`): its regions'
 * locations flattened, its playthrough's list keyed by sphere.
 */
export function jsonLog(json: Readonly<Record<string, unknown>>): Log {
  const locations: Record<string, string> = {};
  for (const [key, section] of Object.entries(json))
    if (!NOT_LOCATIONS.has(key))
      Object.assign(locations, section as Record<string, string>);
  const spheres = json.playthrough as readonly (
    | readonly string[]
    | Readonly<Record<string, string>>
  )[];
  return {
    Entrances: (json.Entrances ?? []) as readonly LogEntrance[],
    Locations: locations,
    meta: json.meta as Log["meta"],
    playthrough: Object.fromEntries(spheres.map((s, k) => [String(k), s])),
    Special: json.Special as Log["Special"],
  };
}

/** A flag of `meta`: a text log's Yes, a JSON's true or 1, a key's "wild". */
export const flag = (value: unknown): boolean =>
  value === true || value === 1 || value === "wild";

/** The world's settings for a log's header (DR's `meta`). */
export function settingsFor(meta: Log["meta"]) {
  // The release that built it, as its ROM title's digits ("1.5.7-u": 157)
  const release = /^(\d)\.(\d)\.(\d)\b/.exec(String(meta.version));
  if (release === null) throw new Error(`no version in "${meta.version}"`);
  return {
    ...settingsOf("open"),
    // DR's crystals goal is Fast Ganon: Ganon wants the crystals alone
    ...(meta.goal === "crystals"
      ? settingsFromUpstream("open", { goal: "fast_ganon" })
      : {}),
    crystalsGanon: Number(meta.ganon_crystals),
    crystalsTower: Number(meta.gt_crystals),
    drVersion: Number(release.slice(1).join("")),
    ...(meta.keyshuffle === "wild" ? { wildKeys: true } : {}),
    ...(meta.keyshuffle === "universal" ? { universalKeys: true } : {}),
    ...(flag(meta.bigkeyshuffle) ? { wildBigKeys: true } : {}),
    ...(meta.key_logic === "strict" ? { strictKeyLogic: true } : {}),
    ...(meta.key_logic === "dangerous" ? { dangerousKeyLogic: true } : {}),
    ...(meta.key_logic === "static" ? { staticKeyLogic: true } : {}),
    ...(meta.pottery === "keys" ? { potKeys: true } : {}),
    ...(meta.dropshuffle === "keys" ? { dropShuffle: true } : {}),
    ...(meta.accessibility === "locations"
      ? { locationsAccessibility: true }
      : {}),
  };
}

/** What of a log decides its entrance pool (`drShuffled`). */
export const poolOf = (meta: Log["meta"]): DrPoolSettings => ({
  dropShuffle: String(meta.dropshuffle ?? "none"),
  enemyShuffle: (meta.enemy_shuffle ?? "none") !== "none",
  mode: meta.mode === "inverted" ? "inverted" : "open",
  pottery: String(meta.pottery ?? "none"),
  shopsanity: flag(meta.shopsanity),
  shuffleLinks: flag(meta.shufflelinks),
  shuffleTavern: flag(meta.shuffletavern),
});

/**
 * A log's shuffled entrances, noted as its spoiler says: entrance id →
 * target id, each door its pool moves.
 */
export function entranceNotesOf(log: Log): DrNotedEntrances {
  const shuffle = log.meta.shuffle as DrShuffle;
  const pool = poolOf(log.meta);
  const noted: Record<string, string> = {};
  const moved = new Set(
    drEntrancePool(shuffle, pool).entrances.map((entrance) => entrance.id),
  );
  for (const link of log.Entrances) {
    if (link.direction === "exit") continue;
    const id = drEntranceOf(link.entrance).id;
    if (moved.has(id)) noted[id] = drTargetOf(link.exit).id;
  }
  return { noted, pool, shuffle };
}

/**
 * The events a world names by the item its playthrough holds (dr-state's
 * `eventsOf`): DR's own, or a release's of its own (the Overworld
 * Randomizer's, with its dynamic events' facts).
 */
export type WalkEvents = ReadonlyMap<string, string> | undefined;

/** What a player holds of `items`, with the seed's medallions. */
function stateOf(
  items: readonly string[],
  special: Log["Special"],
  events: WalkEvents,
): State {
  const {
    mireIsEther: _mire,
    turtleRockIsQuake: _turtleRock,
    ...held
  } = collect(items, events);
  const pad = (dungeon: string) => special[dungeon]?.toLowerCase() as Medallion;
  return {
    ...held,
    ...medallionFacts({
      mire: pad("Misery Mire"),
      turtleRock: pad("Turtle Rock"),
    }),
  };
}

/** The keys a log keeps in their dungeons, which DR's sweep collects. */
const sweptKeys = (log: Log) => {
  const kinds = [
    ...(log.meta.keyshuffle === "none" ? ["Small Key ("] : []),
    ...(!flag(log.meta.bigkeyshuffle) ? ["Big Key ("] : []),
  ];
  return Object.entries(log.Locations).filter(([, item]) =>
    kinds.some((kind) => item.startsWith(kind)),
  );
};

const idIn = (world: PlaythroughWorld) => (location: string) => {
  const found = world.locationIds.get(location);
  if (found === undefined) throw new Error(`no location "${location}"`);
  return found;
};

const spheresOf = (log: Log) => {
  const spheres: Readonly<Record<string, string>>[] = [];
  for (let k = 1; log.playthrough[k] !== undefined; k++)
    spheres.push(log.playthrough[k] as Readonly<Record<string, string>>);
  return spheres;
};

/**
 * The locations of a log's playthrough the world does not say `yes` to,
 * each `sphere:location` → the answer: a location of sphere k is asked
 * with the items of the spheres before it held, the keys a seed keeps in
 * their dungeons found as a player finds them, at every place of their
 * dungeon the world does not refuse.
 */
export function walk(
  log: Log,
  world: Parameters<typeof solveFacts>[0] & PlaythroughWorld,
  events?: WalkEvents,
): {
  readonly checked: number;
  readonly notYes: Readonly<Record<string, string>>;
} {
  const id = idIn(world);
  const keys = sweptKeys(log);
  const held = [...((log.playthrough["0"] as readonly string[]) ?? [])];
  const found = new Set<string>();
  const notYes: Record<string, string> = {};
  let checked = 0;
  for (const [i, sphere] of spheresOf(log).entries()) {
    let solution = solveFacts(world, stateOf(held, log.Special, events));
    for (;;) {
      const more = keys.filter(
        ([at]) => !found.has(at) && solution.location(id(at)) !== "no",
      );
      if (more.length === 0) break;
      for (const [at, item] of more) {
        found.add(at);
        held.push(item);
      }
      solution = solveFacts(world, stateOf(held, log.Special, events));
    }
    for (const location of Object.keys(sphere)) {
      checked++;
      const got = solution.location(id(location));
      if (got !== "yes") notYes[`${i + 1}:${location}`] = got;
    }
    held.push(...Object.values(sphere));
  }
  return { checked, notYes };
}

/**
 * The locations of a later sphere a log's playthrough says yes to too
 * early, each `sphere:location as of sphere`. create_playthrough's final
 * spheres (Main.py:751-768) are first-reachable sets: sphere k holds the
 * required locations that DR's state reaches after the spheres before it,
 * where that state is their items and, swept at each step, the keys at
 * reachable event locations, only those kept in their dungeons
 * (sweep_for_events(key_only=True), BaseClasses.py:1051-1066: small keys
 * under keyshuffle none, big keys without bigkeyshuffle; a vanilla drop's
 * key is such an event, Location's forced_item, BaseClasses.py:2272-2278).
 * No other event is swept: an event, a forced key of a keysanity seed, is
 * held once a sphere collects it. A location of a later sphere was out of
 * DR's reach in that state, so the world must not say yes to it there.
 *
 * The world's own sweep is not that state: it collects every event and
 * vanilla drop's key once reached, as a player does, which a sphere holds
 * only from the next (a keysanity seed's pot key one sphere, the room it
 * opens the next). So the world is asked without its sweep
 * (`sweepEvents: false`), on a state never more than DR's: the earlier
 * spheres' items, and the keys DR sweeps found only where the world says
 * yes (its yes being what is held to DR's reach).
 */
export function early(
  log: Log,
  world: Parameters<typeof solveFacts>[0] & PlaythroughWorld,
  events?: WalkEvents,
): string[] {
  const id = idIn(world);
  const keys = sweptKeys(log);
  const spheres = spheresOf(log);
  const held = [...((log.playthrough["0"] as readonly string[]) ?? [])];
  const found = new Set<string>();
  const out: string[] = [];
  spheres.forEach((sphere, i) => {
    let solution = solveFacts(world, stateOf(held, log.Special, events));
    for (;;) {
      const more = keys.filter(
        ([at]) => !found.has(at) && solution.location(id(at)) === "yes",
      );
      if (more.length === 0) break;
      for (const [at, item] of more) {
        found.add(at);
        held.push(item);
      }
      solution = solveFacts(world, stateOf(held, log.Special, events));
    }
    spheres.slice(i + 1).forEach((later, j) => {
      for (const location of Object.keys(later))
        if (solution.location(id(location)) === "yes")
          out.push(`${i + j + 2}:${location} as of ${i + 1}`);
    });
    for (const [at, item] of Object.entries(sphere))
      if (!found.has(at)) held.push(item);
  });
  return out;
}

/** A recorded file of a fixtures folder. */
export const readFixture = (folder: string, name: string) =>
  readFileSync(new URL(`${folder}/${name}`, import.meta.url), "utf8");

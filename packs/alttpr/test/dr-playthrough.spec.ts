// The Door Randomizer's world held to real seeds: the playthrough of each
// spoiler race DR wrote (test/dr-spoilers/, recorded by
// scripts/record-dr-spoilers.mjs; DR 1.5.7-u for ten, 1.5.8-u and 1.5.6-u
// for one each, whose playthrough code is 1.5.6's). DR builds it in
// create_playthrough (Main.py:673-774 at DR 1.5.6): the spheres of the
// items the seed needs, each location of sphere k reached by DR's own logic
// with the items of the spheres before it, the dungeons' keys in their
// dungeons collected as DR's sweep reaches them (sweep_for_events(key_only=
// True), BaseClasses.py:1051-1066). So a location of sphere k is `yes` here with the items of the
// spheres before it held, unless the reviewed list below says why not; the
// keys a seed keeps in their dungeons are found as a player finds them, at
// every place of their dungeon the world does not refuse. The other way,
// no location of a later sphere is yes too early (`early`).
import { readFileSync } from "node:fs";
import type { State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { drWorld } from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import type { Medallion } from "../src/medallions";
import { medallionFacts } from "../src/medallions";
import { textDocument } from "../src/spoiler/dr";
import { collect, settingsOf } from "./dr-state";

const read = (name: string) =>
  readFileSync(new URL(`dr-spoilers/${name}`, import.meta.url), "utf8");

const INDEX = JSON.parse(read("index.json")) as {
  logs: Readonly<Record<string, unknown>>;
};

interface Log {
  readonly meta: Readonly<Record<string, string | boolean>>;
  readonly Locations: Readonly<Record<string, string>>;
  readonly Special: Readonly<Record<string, string>>;
  readonly playthrough: Readonly<
    Record<string, readonly string[] | Readonly<Record<string, string>>>
  >;
}

/**
 * Where the world's answer is not `yes`, by log: `sphere:location` → the
 * answer, each reviewed.
 */
const REVIEWED: Readonly<
  Record<string, { readonly why: string; readonly at: Record<string, string> }>
> = {
  // Misery Mire's blue barriers open to two keys only where DR knows which
  // keys lie behind them (DoorShuffle.py:294-303, Rules.py:2352-2354): the
  // world says maybe (keys.ts). Thieves' Town's big chest: its key door's
  // rule rests on where a key lies (AllowSmall, Rules.py:2425-2440)
  "DR_278438665_Spoiler.txt": {
    at: {
      "7:Misery Mire - Map Chest": "maybe",
      "8:Thieves' Town - Big Chest": "maybe",
    },
    why: "Mire's crystal alternative; a placement-dependent key rule",
  },
  // Built by a DR unstable whose `static` key logic DR 1.5.6 does not have
  // (its key_logic_algorithm choices are dangerous, partial and strict,
  // resources/app/cli/args.json:209-215): it opens Ice Palace's way to the
  // boss with fewer keys than partial logic counts. The app names it a
  // logic it does not model.
  "DR_660701088_Spoiler.txt": {
    at: {
      "12:Ice Palace - Boss": "no",
      "12:Ice Palace - Prize": "no",
      "12:Misery Mire - Map Chest": "maybe",
    },
    why: "static key logic; Mire's crystal alternative",
  },
};

/** The world's settings for a log's header (DR's `meta`). */
function settingsFor(meta: Log["meta"]) {
  return {
    ...settingsOf("open"),
    crystalsGanon: Number(meta.ganon_crystals),
    crystalsTower: Number(meta.gt_crystals),
    ...(meta.keyshuffle === "wild" ? { wildKeys: true } : {}),
    ...(meta.keyshuffle === "universal" ? { universalKeys: true } : {}),
    ...(meta.bigkeyshuffle === true ? { wildBigKeys: true } : {}),
    ...(meta.key_logic === "strict" ? { strictKeyLogic: true } : {}),
    ...(meta.key_logic === "dangerous" ? { dangerousKeyLogic: true } : {}),
    ...(meta.pottery === "keys" ? { potKeys: true } : {}),
    ...(meta.dropshuffle === "keys" ? { dropShuffle: true } : {}),
    ...(meta.accessibility === "locations"
      ? { locationsAccessibility: true }
      : {}),
  };
}

/** What a player holds of `items`, with the seed's medallions. */
function stateOf(items: readonly string[], special: Log["Special"]): State {
  const {
    mireIsEther: _mire,
    turtleRockIsQuake: _turtleRock,
    ...held
  } = collect(items);
  const pad = (dungeon: string) => special[dungeon]?.toLowerCase() as Medallion;
  return {
    ...held,
    ...medallionFacts({
      mire: pad("Misery Mire"),
      turtleRock: pad("Turtle Rock"),
    }),
  };
}

/** The locations of a log's playthrough the world does not say `yes` to. */
function walk(name: string): {
  readonly checked: number;
  readonly notYes: Readonly<Record<string, string>>;
} {
  const log = textDocument(read(name)) as unknown as Log;
  const { meta } = log;
  // Settings the step-4 world holds, which each recorded race keeps
  expect([meta.mode, meta.door_shuffle, meta.shuffle, meta.logic]).toEqual([
    "open",
    "vanilla",
    "vanilla",
    "noglitches",
  ]);
  const world = drWorld(settingsFor(meta));
  const id = (location: string) => {
    const found = world.locationIds.get(location);
    if (found === undefined) throw new Error(`no location "${location}"`);
    return found;
  };
  const inDungeon = [
    ...(meta.keyshuffle === "none" ? ["Small Key ("] : []),
    ...(meta.bigkeyshuffle === false ? ["Big Key ("] : []),
  ];
  const keys = Object.entries(log.Locations).filter(([, item]) =>
    inDungeon.some((kind) => item.startsWith(kind)),
  );
  const held = [...((log.playthrough["0"] as readonly string[]) ?? [])];
  const found = new Set<string>();
  const notYes: Record<string, string> = {};
  let checked = 0;
  for (let k = 1; log.playthrough[k] !== undefined; k++) {
    let solution = solveFacts(world, stateOf(held, log.Special));
    for (;;) {
      const more = keys.filter(
        ([at]) => !found.has(at) && solution.location(id(at)) !== "no",
      );
      if (more.length === 0) break;
      for (const [at, item] of more) {
        found.add(at);
        held.push(item);
      }
      solution = solveFacts(world, stateOf(held, log.Special));
    }
    const sphere = log.playthrough[k] as Readonly<Record<string, string>>;
    for (const location of Object.keys(sphere)) {
      checked++;
      const got = solution.location(id(location));
      if (got !== "yes") notYes[`${k}:${location}`] = got;
    }
    held.push(...Object.values(sphere));
  }
  return { checked, notYes };
}

/**
 * The locations of a later sphere a log's playthrough says yes to too
 * early, each `sphere:location as of sphere`. create_playthrough's final
 * spheres (Main.py:747-764) are first-reachable sets: sphere k holds the
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
function early(name: string): string[] {
  const log = textDocument(read(name)) as unknown as Log;
  const world = drWorld(settingsFor(log.meta), { sweepEvents: false });
  const id = (location: string) => {
    const found = world.locationIds.get(location);
    if (found === undefined) throw new Error(`no location "${location}"`);
    return found;
  };
  const swept = [
    ...(log.meta.keyshuffle === "none" ? ["Small Key ("] : []),
    ...(log.meta.bigkeyshuffle === false ? ["Big Key ("] : []),
  ];
  const keys = Object.entries(log.Locations).filter(([, item]) =>
    swept.some((kind) => item.startsWith(kind)),
  );
  const spheres: Readonly<Record<string, string>>[] = [];
  for (let k = 1; log.playthrough[k] !== undefined; k++)
    spheres.push(log.playthrough[k] as Readonly<Record<string, string>>);
  const held = [...((log.playthrough["0"] as readonly string[]) ?? [])];
  const found = new Set<string>();
  const out: string[] = [];
  spheres.forEach((sphere, i) => {
    let solution = solveFacts(world, stateOf(held, log.Special));
    for (;;) {
      const more = keys.filter(
        ([at]) => !found.has(at) && solution.location(id(at)) === "yes",
      );
      if (more.length === 0) break;
      for (const [at, item] of more) {
        found.add(at);
        held.push(item);
      }
      solution = solveFacts(world, stateOf(held, log.Special));
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

describe("DR's world against real seeds' playthroughs", () => {
  const logs = Object.keys(INDEX.logs);

  it("reads at least ten seeds", () => {
    expect(logs.length).toBeGreaterThanOrEqual(10);
  });

  for (const name of logs)
    it(`reaches each sphere with the spheres before it (${name})`, () => {
      const { checked, notYes } = walk(name);
      expect(checked).toBeGreaterThan(20);
      expect(notYes).toEqual(REVIEWED[name]?.at ?? {});
    });

  for (const name of logs)
    it(`says yes to no location of a later sphere (${name})`, () => {
      expect(early(name)).toEqual([]);
    });
});

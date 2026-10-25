// Map Rando's spoiler log (maprando.com/seed/<name>/data/spoiler.json), read
// into the one shape `@alltp/spoiler` defines.
//
// The file is the serialized `SpoilerLog` of rust/maprando/src/spoiler_log.rs
// (:197-215 at the commit upstream.json pins) and is 21 MB, of which the
// tracker reads about 39 KB: `details`, `game_data` and the traversals are the
// other 99.8 %. `sliceTopLevel` takes the keys below without building the rest,
// and zod checks what it took.
//
// What the file holds, and what it does not:
// - `all_items` is every item location of the seed (SpoilerItemLoc, :110),
//   a location being the sm-json-data ids `room_id` and `node_id` (:255-262),
//   which are the key here: node names repeat inside a room.
// - `summary` is the playthrough by `step` (:144-149): the step an item's
//   location first becomes reachable under the seed's logic, which is what a
//   sphere is elsewhere. An item can be in no step (a Missile that logic never
//   collects, patch.rs "Placed but logically uncollectable item"): it keeps
//   `sphere: null`.
// - Items are the Rust `enum Item`'s variant names (`Item::VARIANTS[..]`,
//   spoiler_log.rs:1236), read through `SM_ITEMS`' `variant`. "Nothing" is a
//   location that holds no item: it is no placement and is listed as skipped.
// - Objectives are flag names (`Objective::get_flag_name`, settings.rs:521).
// - The file names no seed, no version and no date: nothing in it binds it to
//   a run, so `seed` is empty and a log is never verified (`mapRandoEvidence`).

import {
  accept,
  type Evidence,
  type Fact,
  type Placement,
  refuse,
  type SpoilerLog,
  type SpoilerResult,
  sliceTopLevel,
} from "@alltp/spoiler";
import * as z from "zod/mini";
import { SM_ITEMS, type SmItemId } from "./items";
import { OBJECTIVES } from "./objectives";

/** The top-level keys read; every other value of the file is skipped. */
export const SPOILER_KEYS = [
  "all_items",
  "objectives",
  "powerbomb_size",
  "start_location",
  "summary",
  "super_size",
  "missile_size",
] as const;

// Bounds a real file stays far inside (100 locations, 12 steps, 4 objectives,
// names under 40 characters): a file past them is not one Map Rando wrote.
const MAX_LOCATIONS = 500;
const MAX_STEPS = 200;
const MAX_NAME = 200;

const name = z.string().check(z.maxLength(MAX_NAME));
const id = z.int().check(z.gte(0), z.lte(0xffff));
const step = z.int().check(z.gte(1), z.lte(MAX_STEPS));
const size = z.int().check(z.gte(1), z.lte(1000));

const LOCATION = z.object({
  area: name,
  node: name,
  node_id: id,
  room: name,
  room_id: id,
});

const ITEM_AT = z.object({ item: name, location: LOCATION });

const SPOILER = z.object({
  all_items: z.array(ITEM_AT).check(z.minLength(1), z.maxLength(MAX_LOCATIONS)),
  missile_size: size,
  objectives: z.array(name).check(z.maxLength(OBJECTIVES.length)),
  powerbomb_size: size,
  start_location: z.object({ name, node_id: id, room_id: id }),
  summary: z
    .array(z.object({ items: z.array(ITEM_AT), step }))
    .check(z.maxLength(MAX_STEPS)),
  super_size: size,
});

const BY_VARIANT = new Map(SM_ITEMS.map((i) => [i.variant, i]));
const BY_FLAG = new Map(OBJECTIVES.map((o) => [o.upstream, o]));

/** A location with no item (Map Rando's "Nothing"): no placement. */
const NOTHING = "Nothing";

/** What a Map Rando log states beside its placements. */
export interface MapRandoExtra {
  /** The seed's objectives, as the pack's objective ids, in the file's order. */
  readonly objectives: readonly string[];
  /** Where Samus starts, by the sm-json-data ids of its node. */
  readonly startLocation: {
    readonly name: string;
    readonly roomId: number;
    readonly nodeId: number;
  };
  /** How much each pack gives, which the ROM holds too (`decodeItems`). */
  readonly ammo: {
    readonly missile: number;
    readonly superMissile: number;
    readonly powerBomb: number;
  };
  /**
   * How many of each item the seed placed, by the pack's item id (absent: none).
   * Starting items are not in the log's placements, so a run may hold more.
   */
  readonly placed: Readonly<Partial<Record<SmItemId, number>>>;
}

export type MapRandoLog = SpoilerLog<MapRandoExtra>;

/** A location's key: the sm-json-data ids, which names do not give uniquely. */
const keyOf = (l: { room_id: number; node_id: number }) =>
  `${l.room_id}:${l.node_id}`;

/**
 * Reads a Map Rando `spoiler.json`. Never throws on its input: random text,
 * another file, a truncated one and an unknown item all answer a refusal
 * (`not-a-spoiler`; `newer-version` for an item or objective this pack does
 * not know, named in the detail). Its size is the caller's to bound first
 * (`checkSize("sm", file.size)`), before the file is read.
 */
export function parseSpoiler(text: string): SpoilerResult<MapRandoLog> {
  const sliced = sliceTopLevel(text, SPOILER_KEYS);
  if (!sliced.ok) return sliced;
  const checked = SPOILER.safeParse(sliced.value);
  if (!checked.success) {
    // The path names a key or an index of the schema, never the file's text.
    const path = checked.error.issues[0]?.path.join(".") ?? "";
    return refuse("not-a-spoiler", path === "" ? "shape" : path);
  }
  const file = checked.data;

  // The playthrough: the step of every location, each one holding what
  // `all_items` says it does.
  const held = new Map<string, string>();
  for (const { item, location } of file.all_items) {
    const key = keyOf(location);
    if (held.has(key)) return refuse("not-a-spoiler", `twice: ${key}`);
    held.set(key, item);
  }
  const steps = new Map<string, number>();
  let spheres = 0;
  for (const { items, step } of file.summary) {
    for (const { item, location } of items) {
      const key = keyOf(location);
      if (held.get(key) !== item)
        return refuse("not-a-spoiler", `step: ${key}`);
      if (steps.has(key)) return refuse("not-a-spoiler", `twice: ${key}`);
      steps.set(key, step);
      spheres = Math.max(spheres, step);
    }
  }

  const placements: Placement[] = [];
  const skipped: string[] = [];
  const placed: Partial<Record<SmItemId, number>> = {};
  for (const { item, location } of file.all_items) {
    if (item === NOTHING) {
      if (!skipped.includes(NOTHING)) skipped.push(NOTHING);
      continue;
    }
    const known = BY_VARIANT.get(item);
    if (known === undefined) return refuse("newer-version", item);
    placed[known.id] = (placed[known.id] ?? 0) + 1;
    const key = keyOf(location);
    placements.push({
      area: location.area,
      item: known.id,
      itemName: item,
      location: key,
      locationName: `${location.room}: ${location.node}`,
      sphere: steps.get(key) ?? null,
    });
  }

  const objectives: string[] = [];
  for (const flag of file.objectives) {
    const known = BY_FLAG.get(flag);
    if (known === undefined) return refuse("newer-version", flag);
    if (!objectives.includes(known.id)) objectives.push(known.id);
  }

  return accept({
    extra: {
      ammo: {
        missile: file.missile_size,
        powerBomb: file.powerbomb_size,
        superMissile: file.super_size,
      },
      objectives,
      placed,
      startLocation: {
        name: file.start_location.name,
        nodeId: file.start_location.node_id,
        roomId: file.start_location.room_id,
      },
    },
    format: "map-rando",
    game: "sm",
    placements,
    seed: { from: null, id: null },
    skipped,
    spheres,
    start: [],
  });
}

/** What the run says of its seed, where the tracker knows it. */
export interface MapRandoRun {
  /** The seed's objectives as pack ids (`decodeObjectives`), or null if unread. */
  readonly objectives: readonly string[] | null;
  /** Wall jumps need the Wall Jump Boots (`decodeSeed`), or null if unread. */
  readonly wallJump: boolean | null;
  /** The Speed Booster comes as two (`decodeSeed`), or null if unread. */
  readonly splitSpeed: boolean | null;
}

const asSet = (ids: readonly string[]) => [...new Set(ids)].sort().join(",");

/**
 * What `bindSeed` weighs for a Map Rando log: no seed id on either side (the
 * log names none, so it is never verified), and the facts a log and a run both
 * state. A log that contradicts one is another seed's.
 *
 * - The objectives: the same set.
 * - The Wall Jump Boots and the split Speed Booster, as items the seed placed.
 *   A log that places one the run's ROM does not have is contradicted; a log
 *   that places none says nothing, as the item may be a starting one, which the
 *   log's placements leave out.
 */
export function mapRandoEvidence(
  extra: MapRandoExtra,
  run: MapRandoRun,
): Evidence {
  const placed = (...ids: SmItemId[]) =>
    ids.some((id) => (extra.placed[id] ?? 0) > 0) ? true : null;
  const facts: Fact[] = [
    {
      file: asSet(extra.objectives),
      name: "objectives",
      run: run.objectives === null ? null : asSet(run.objectives),
    },
    {
      file: placed("wallJump"),
      name: "Wall Jump Boots",
      run: run.wallJump,
    },
    {
      file: placed("sparkBooster", "blueBooster"),
      name: "split Speed Booster",
      run: run.splitSpeed,
    },
  ];
  return { facts, seed: { file: null, run: null } };
}

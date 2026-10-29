// Where the dungeons' items can sit, and the key model: what the tracker
// shows for a location while the player does not track the keys.
//
// Read from sporchia/alttp_vt_randomizer at 219fcafd (LOGIC 31),
// app/Support/LocationCollection.php:126-142. A rule that asks where an
// item sits (`itemInLocations`, `hasItem`) gets `maybe` from the pack, since
// a tracker does not know the placement. What it can know is where an item
// may sit at all. The randomizer places the dungeon items first, each where
// Location::canFill holds with every item not placed yet assumed held
// (app/Filler/RandomAssumed.php:25-34, 59-135), and canFill only grows with
// the items held. So an item never sits where canFill is `no` with every
// other item held: `possibleLocations` lists the others.
//
// The key model (solveWithKeys) builds on it; README.md, "The key model",
// says why it is sound.
import {
  type CompiledWorld,
  type Expr,
  itemValue,
  loadRules,
  parse,
  rank,
  type Solution,
  type State,
  solve,
  type Tri,
} from "@alltp/engine";
import { bossFacts } from "./bosses";
import { derivedFacts } from "./derived";
import { DUNGEONS, type DungeonId, dungeonPool } from "./dungeons";
import type { Filler } from "./fill";
import { fromUpstream, STATE_MAX } from "./items";
import { medallionFacts } from "./medallions";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";
import type { RegionDef } from "./world";

/** Every item at its count in the pool, as the derived facts read them. */
function withFacts(
  items: Readonly<Record<string, number>>,
  settings: AlttprSettings,
): State {
  return {
    ...items,
    // Either pad may want any medallion: with all three, both open
    ...medallionFacts({ mire: "unknown", turtleRock: "unknown" }),
    // Any slot may hold any boss it takes: with everything, each is beaten
    ...bossFacts({}),
    ...derivedFacts(items, settings),
  };
}

/** The pool and what every world is given beside it (RandomAssumed.php:86). */
const POOL: Readonly<Record<string, number>> = Object.fromEntries(STATE_MAX);

/**
 * A world's pool: the shops sell an arrow and a key in the retro world
 * alone (Randomizer.php:740-750), so no other world holds them.
 */
const poolOf = (
  settings: AlttprSettings,
): Readonly<Record<string, number>> => ({
  ...POOL,
  shopArrow: settings.rupeeBow ? 1 : 0,
  shopKey: settings.genericKeys ? 1 : 0,
});

/**
 * Everything a world holds: every item at its count in its pool and its
 * pre-collected items, every prize and event, both medallion pads open,
 * every boss slot unknown (each boss it may hold beaten).
 * What the randomizer assumes held before it places the first item.
 */
export function everything(settings: AlttprSettings): State {
  return withFacts(poolOf(settings), settings);
}

/**
 * Everything but one of `item` (an upstream name): what the randomizer
 * assumes held at most while it places that item.
 */
export function everythingBut(item: string, settings: AlttprSettings): State {
  const contribution = fromUpstream(item);
  if (contribution === null) return everything(settings);
  const { atLeast, count, item: id } = contribution;
  const pool = poolOf(settings);
  const held = itemValue(pool, id);
  return withFacts(
    {
      ...pool,
      // A level (TitansMitt) goes below itself; a count loses its share
      [id]: atLeast ? Math.min(held, count - 1) : Math.max(0, held - count),
    },
    settings,
  );
}

/**
 * The locations where the randomizer may place `item` (an upstream name,
 * `KeyD1`), in world order: those where Location::canFill is not `no` with
 * everything else held. Where the answer hangs on another placement it is
 * `maybe`, and the location stays in.
 */
export function possibleLocations(filler: Filler, item: string): string[] {
  const state = everythingBut(item, filler.settings);
  const solution = solve(filler.world, state);
  return filler.locations.filter(
    (location) => filler.canFill(location, item, state, solution) !== "no",
  );
}

/**
 * A dungeon item the player does not track: a dungeon's small keys while
 * keys are not wild, its big key while big keys are not. They stay in their
 * dungeon, and the tracker does not ask for them. The retro world's generic
 * keys go untracked too, wild as they are: any dungeon's door takes one, so
 * the player cannot tell whose a key is.
 */
export interface UntrackedItem {
  readonly dungeon: DungeonId;
  /** Its state id: `keyD1`, `bigKeyD1`. */
  readonly item: string;
  /** How many the pool holds. */
  readonly count: number;
  /** Where the randomizer may have placed them: possibleLocations. */
  readonly locations: readonly string[];
  /**
   * A generic key (rom.genericKeys): never surely in hand, nor its dungeon
   * safe for keys, since a key found may open another dungeon's door.
   */
  readonly generic: boolean;
}

/** The items a run's player does not track, with where each may sit. */
export function untrackedItems(filler: Filler): readonly UntrackedItem[] {
  const { settings } = filler;
  return DUNGEONS.flatMap((d) => {
    const pool = dungeonPool(d);
    const kinds = [
      {
        count: settings.wildKeys && !settings.genericKeys ? 0 : pool.smallKeys,
        generic: settings.genericKeys,
        kind: "Key",
      },
      {
        count: settings.wildBigKeys ? 0 : pool.bigKey,
        generic: false,
        kind: "BigKey",
      },
    ];
    return kinds
      .filter(({ count }) => count > 0)
      .map(({ count, generic, kind }) => ({
        count,
        dungeon: d.id,
        generic,
        item: `${kind.charAt(0).toLowerCase()}${kind.slice(1)}${d.code}`,
        locations: possibleLocations(filler, `${kind}${d.code}`),
      }));
  });
}

/** What a filler's key model computes once: everything but the state. */
interface Model {
  readonly untracked: readonly UntrackedItem[];
  /** The dungeons whose untracked items each location's rule reads. */
  readonly dungeonsOf: ReadonlyMap<string, readonly DungeonId[]>;
  /**
   * Per such dungeon: how many small keys and big keys go untracked, and
   * every location they may sit at.
   */
  readonly dungeons: ReadonlyMap<
    DungeonId,
    {
      readonly keys: number;
      readonly bigKey: number;
      readonly at: string[];
      /** Its small keys are generic keys: never safe. */
      readonly generic: boolean;
    }
  >;
  /** The most small keys a dungeon holds untracked; 1 if a big key is. */
  readonly keys: number;
  readonly bigKeys: number;
  /**
   * The world with everything held, but one dungeon's untracked items at a
   * level: what the randomizer holds while it places that dungeon's items
   * (every other dungeon's are unplaced, so assumed held, or placed where
   * that state reaches them; RandomAssumed.php:59-135).
   */
  everything(dungeon: DungeonId, keys: number, bigKeys: number): Solution;
  /**
   * The dungeons whose untracked items a way in reads, each way behind the
   * one-frame clip underworld (canOneFrameClipUW) of Hybrid Major Glitches
   * and Major Glitches: from Misery Mire into Tower of Hera (keyD6) and
   * into Swamp Palace (keyD6, bigKeyD6, and Tower of Hera's bigKeyP3, which
   * makes Tower of Hera one too), and in Inverted from Thieves' Town into
   * Desert Palace (keyD4, bigKeyD4). None under NoGlitches or Overworld
   * Glitches, where no way in reads a key.
   * The model never raises their items past what is surely in hand
   * (`solveWithKeys`: each in logic wherever it sits, or all of a gating
   * dungeon proven safe), so what those ways open is what the player has.
   */
  readonly gating: ReadonlySet<DungeonId>;
}

/**
 * The dungeons whose untracked items (`owner`: by item, its dungeon) a way
 * in reads. A branch the settings switch off, or through a region no state
 * reaches, is left out (`readsOf`).
 */
function gatingDungeons(
  regions: readonly RegionDef[],
  owner: ReadonlyMap<string, DungeonId>,
  settings: AlttprSettings,
  closed: (region: string) => boolean,
): Set<DungeonId> {
  const found = new Set<DungeonId>();
  for (const region of regions) {
    for (const { req } of region.entrances) {
      for (const name of readsOf(req, settings, closed) ?? []) {
        const id = owner.get(name);
        if (id !== undefined) found.add(id);
      }
    }
  }
  return found;
}

/**
 * `state` with every untracked item raised to a level: each dungeon's small
 * keys to `keys` (at most its count), its big key if `bigKeys` is 1, but a
 * dungeon's `kept` at what `state` holds. A count already held is kept. No
 * derived fact reads a key, so they stand.
 */
function raise(
  state: State,
  untracked: readonly UntrackedItem[],
  keys: number,
  bigKeys: number,
  kept: (dungeon: DungeonId) => boolean = () => false,
): State {
  const raised: Record<string, number> = {};
  for (const { count, dungeon, item } of untracked) {
    if (kept(dungeon)) continue;
    const level = item.startsWith("bigKey") ? bigKeys * count : keys;
    raised[item] = Math.max(itemValue(state, item), Math.min(level, count));
  }
  return { ...state, ...raised };
}

/** Memoized solves of one world, by level. */
function levels(
  world: CompiledWorld,
  at: (keys: number, big: number) => State,
) {
  const solved = new Map<number, Solution>();
  return (keys: number, big: number): Solution => {
    const key = keys * 2 + big;
    let found = solved.get(key);
    if (found === undefined) {
      found = solve(world, at(keys, big));
      solved.set(key, found);
    }
    return found;
  };
}

const rules = loadRules(RULES);

/**
 * The state names a rule reads under the settings, its helpers included,
 * leaving out a branch the settings switch off or that needs a region no
 * state reaches (`closed`): Tower of Hera's glitched way in from Misery
 * Mire, which NoGlitches never opens, reads that palace's big key. `null`
 * when the whole rule is such a branch.
 */
export function readsOf(
  req: string,
  settings: AlttprSettings,
  closed: (region: string) => boolean = () => false,
): readonly string[] | null {
  const flags = settings as Readonly<Record<string, boolean | number>>;
  const visit = (e: Expr): readonly string[] | null => {
    switch (e.type) {
      case "const":
        return e.value === "no" ? null : [];
      case "item":
        return [e.name];
      case "count":
        return e.names;
      case "setting":
        return (flags[e.name] === true) !== e.negated ? [] : null;
      case "reach":
        return closed(e.region) ? null : [];
      case "helper": {
        const body = rules.helpers.get(e.name);
        if (body === undefined) throw new RangeError(`No helper @${e.name}`);
        return visit(body);
      }
      case "maybe":
        return visit(e.expr) ?? [];
      case "and": {
        const parts = e.args.map(visit);
        return parts.some((p) => p === null)
          ? null
          : (parts.flat() as string[]);
      }
      case "or": {
        const parts = e.args.map(visit).filter((p) => p !== null);
        return parts.length === 0 ? null : parts.flat();
      }
    }
  };
  return visit(parse(req));
}

const models = new WeakMap<Filler, Model>();

function modelOf(filler: Filler): Model {
  const cached = models.get(filler);
  if (cached !== undefined) return cached;
  const { settings } = filler;
  const untracked = untrackedItems(filler);
  const dungeons = new Map<
    DungeonId,
    { keys: number; bigKey: number; at: string[]; generic: boolean }
  >();
  for (const u of untracked) {
    const entry = dungeons.get(u.dungeon) ?? {
      at: [],
      bigKey: 0,
      generic: false,
      keys: 0,
    };
    if (u.item.startsWith("bigKey")) entry.bigKey = 1;
    else entry.keys = u.count;
    entry.generic ||= u.generic;
    entry.at = [...new Set([...entry.at, ...u.locations])];
    dungeons.set(u.dungeon, entry);
  }
  const keys = Math.max(0, ...[...dungeons.values()].map((d) => d.keys));
  const bigKeys = Math.max(0, ...[...dungeons.values()].map((d) => d.bigKey));
  // Everything held, but the untracked items, which the levels set
  const none = Object.fromEntries(untracked.map((u) => [u.item, 0]));
  const lowered = { ...everything(settings), ...none };
  const top = raise(lowered, untracked, keys, bigKeys);
  const solved = new Map<string, Solution>();
  const all = (dungeon: DungeonId, k: number, big: number): Solution => {
    const key = `${dungeon}/${k}/${big}`;
    let found = solved.get(key);
    if (found === undefined) {
      const own = Object.fromEntries(
        untracked.filter((u) => u.dungeon === dungeon).map((u) => [u.item, 0]),
      );
      found = solve(
        filler.world,
        raise({ ...top, ...own }, untracked, k, big, (d) => d !== dungeon),
      );
      solved.set(key, found);
    }
    return found;
  };
  // A location belongs to the dungeons whose untracked items its rule
  // reads: its own, or Turtle Rock's for Mimic Cave, whose door is inside
  const owner = new Map(untracked.map((u) => [u.item, u.dungeon]));
  const everyItem = solve(filler.world, top);
  const closed = (region: string) => everyItem.region(region) === "no";
  const dungeonsOf = new Map<string, readonly DungeonId[]>();
  // The filler's own modules: a tricks world's rules read more than the run's
  const regions = filler.modules.flatMap((m) => m.regions);
  for (const region of regions) {
    for (const location of region.locations) {
      const read = readsOf(location.req, settings, closed) ?? [];
      const ids = [...new Set(read.flatMap((n) => owner.get(n) ?? []))];
      if (ids.length > 0) dungeonsOf.set(location.id, ids);
    }
  }
  // A way in that reads a key breaks what safety rests on (README.md, "The
  // key model"): its dungeon's items are never raised past what is surely
  // in hand. No rule where a dungeon's items may sit reads another's, but a
  // gating one's (key-model.spec.ts), so the others' levels change nothing
  const gating = gatingDungeons(regions, owner, settings, closed);
  const model: Model = {
    bigKeys,
    dungeons,
    dungeonsOf,
    everything: all,
    gating,
    keys,
    untracked,
  };
  models.set(filler, model);
  return model;
}

/**
 * `state` with every item the player does not track at its full count:
 * what the rules want beyond the keys, as asking for blockers needs it
 * (a key the player cannot mark is never one to collect). The key model
 * reads a location there to tell `yes` from `maybe`.
 */
export function withUntracked(filler: Filler, state: State): State {
  const model = modelOf(filler);
  return raise(state, model.untracked, model.keys, model.bigKeys);
}

/** The tracker's view of one state, keys read by the key model. */
export interface KeyedSolution {
  /**
   * The location as the tracker shows it. In a dungeon whose keys the
   * player does not track: `yes` if it is with the keys surely in hand, or
   * with all of them in a dungeon safe for keys; else `maybe` if it is
   * possible with all of them, `no` if not even then. Anywhere else, the
   * solver's answer. Throws a RangeError for an id the world lacks.
   */
  location(id: string): Tri;
  /** Every location of the world, as `location` reads it. */
  locations(): Record<string, Tri>;
  /**
   * The dungeons whose untracked items a location's rule reads: its own,
   * and Turtle Rock's for Mimic Cave, whose door is inside. None outside.
   */
  dungeons(location: string): readonly DungeonId[];
  /**
   * Whether no untracked item of the dungeon can hide where the player
   * cannot follow: at every count of them, each place they may sit is as
   * available as with every item held. True of a dungeon with none.
   */
  safe(dungeon: DungeonId): boolean;
  /** The state with the untracked items surely in hand added. */
  readonly state: State;
  /** That state's solution: regions, and what `explain` reads. */
  readonly solution: Solution;
}

/** What reads a state the player surely has: the levels, and safety. */
interface Reading {
  /** The world with every untracked item raised to a level. */
  at(keys: number, bigKeys: number): Solution;
  /**
   * Whether no untracked item of the dungeon can hide where the player
   * cannot follow (KeyedSolution.safe).
   */
  safe(dungeon: DungeonId): boolean;
}

/** The levels and the safety of the dungeons over `sure`. */
function readingOf(filler: Filler, model: Model, sure: State): Reading {
  const { world } = filler;
  const { gating } = model;
  const at = levels(world, (keys, big) =>
    raise(sure, model.untracked, keys, big),
  );
  // The player's side of a dungeon's safety: its items at a level, the
  // other gating dungeons' held at what is surely in hand, so a way in that
  // reads them opens only as it does for the player. Where no way in reads
  // a key, the same solves
  const sides = new Map<string, ReturnType<typeof levels>>();
  const sideOf = (id: DungeonId) => {
    if (gating.size === 0) return at;
    const key = gating.has(id) ? id : "";
    let found = sides.get(key);
    if (found === undefined) {
      found = levels(world, (keys, big) =>
        raise(
          sure,
          model.untracked,
          keys,
          big,
          (d) => d !== id && gating.has(d),
        ),
      );
      sides.set(key, found);
    }
    return found;
  };
  const safety = new Map<DungeonId, boolean>();
  const safe = (id: DungeonId): boolean => {
    const entry = model.dungeons.get(id);
    if (entry === undefined) return true;
    // A generic key found may open another dungeon's door; under No Logic
    // the randomizer placed no item where Link could reach it, so a key may
    // sit behind its own door
    if (entry.generic || filler.settings.noLogic) return false;
    let found = safety.get(id);
    if (found === undefined) {
      found = true;
      const side = sideOf(id);
      check: for (let keys = entry.keys; keys >= 0; keys--) {
        for (let big = entry.bigKey; big >= 0; big--) {
          const mine = side(keys, big);
          // Only this dungeon's items at the level: a way in that reads
          // another's opens with all of them, as the fill held them
          const theirs = model.everything(id, keys, big);
          for (const l of entry.at) {
            if (rank(mine.location(l)) < rank(theirs.location(l))) {
              found = false;
              break check;
            }
          }
        }
      }
      safety.set(id, found);
    }
    return found;
  };
  return { at, safe };
}

/**
 * The key model over a state: what the tracker shows when the player does
 * not track the dungeons' small keys and big keys (keysanity tracks them,
 * and then this is the solver's answer). Pure: the same world and state
 * always give the same answers; what it caches depends on the world only.
 */
export function solveWithKeys(filler: Filler, state: State): KeyedSolution {
  const model = modelOf(filler);
  const { world } = filler;
  const { gating } = model;
  // Keys join the state as the player surely gets them, until none more do:
  // an untracked item every place of which is in logic (wherever it is,
  // Link gets there), its count, which may let another follow; then every
  // item of a gating dungeon proven safe, which the player collects all of,
  // so a way in that reads them opens for the player too. Where no way in
  // reads a key, the first alone
  let sure = state;
  let solution = solve(world, sure);
  let reading = readingOf(filler, model, sure);
  const proven = new Set<DungeonId>();
  for (;;) {
    let found = model.untracked.filter(
      (u) =>
        !u.generic &&
        itemValue(sure, u.item) < u.count &&
        u.locations.every((l) => solution.location(l) === "yes"),
    );
    if (found.length === 0) {
      const next = [...gating].find((d) => !proven.has(d) && reading.safe(d));
      if (next === undefined) break;
      proven.add(next);
      found = model.untracked.filter(
        (u) => u.dungeon === next && itemValue(sure, u.item) < u.count,
      );
      if (found.length === 0) continue;
    }
    sure = {
      ...sure,
      ...Object.fromEntries(found.map((u) => [u.item, u.count])),
    };
    solution = solve(world, sure);
    reading = readingOf(filler, model, sure);
  }
  const { at } = reading;
  // A dungeon proven safe stays so with more in hand
  const safe = (id: DungeonId) => proven.has(id) || reading.safe(id);
  const kept = (d: DungeonId) => gating.has(d);
  // A yes read with the items of the location's own dungeons raised, safe
  // as they must be: the player collects them all. A gating dungeon's
  // otherwise stay at what is surely in hand, so a way in that reads them
  // opens only as it does for the player. Where no way in reads a key, no
  // other dungeon's items change the answer, and all are raised at once
  const raisedFor = new Map<string, Solution>();
  const withOwn = (ds: readonly DungeonId[]): Solution => {
    if (gating.size === 0) return at(model.keys, model.bigKeys);
    const key = ds.join(",");
    let found = raisedFor.get(key);
    if (found === undefined) {
      const own = new Set(ds);
      found = solve(
        world,
        raise(
          sure,
          model.untracked,
          model.keys,
          model.bigKeys,
          (d) => kept(d) && !own.has(d),
        ),
      );
      raisedFor.set(key, found);
    }
    return found;
  };
  const location = (id: string): Tri => {
    const now = solution.location(id);
    const ds = model.dungeonsOf.get(id);
    if (now === "yes" || ds === undefined) return now;
    const yes = withOwn(ds).location(id) === "yes";
    if (yes && ds.every(safe)) return "yes";
    return at(model.keys, model.bigKeys).location(id) === "no" ? "no" : "maybe";
  };
  return {
    dungeons: (id) => model.dungeonsOf.get(id) ?? [],
    location,
    locations: () =>
      Object.fromEntries(filler.locations.map((id) => [id, location(id)])),
    safe,
    solution,
    state: sure,
  };
}

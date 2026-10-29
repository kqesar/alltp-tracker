// The key model on the entrance randomizer's world: what the tracker shows
// while the player does not track the dungeons' keys and the randomizer kept
// them in their dungeons, which it does for every seed vt sends it without
// --keysanity (app/EntranceRandomizer.php:69-71: all but `full` dungeon
// items). README.md, "Its key model" (under "The entrance randomizer's
// tables"), says why it is sound.
//
// Read from cassidoxa/ALttPEntranceRandomizer at the commit upstream.json
// pins (entranceRandomizer): the dungeons and their keys (Dungeons.py
// create_dungeons), the key placed first (fill_dungeons_restrictive), the
// spots filled before them (ItemList.py generate_itempool, fill_prizes) and
// where an item may go (Rules.py forbid_item, set_always_allow), which
// scripts/er-rules.mjs imports into rules.json.
import {
  and,
  type Expr,
  evaluate,
  itemValue,
  NO_RULES,
  or,
  parse,
  rank,
  type Solution,
  type State,
  type Tri,
} from "@alltp/engine";
import { DUNGEONS, type DungeonId } from "./dungeons";
import { erLocationId } from "./entrances";
import er from "./entrances/er.json" with { type: "json" };
import ruleTables from "./entrances/rules.json" with { type: "json" };
import { type ErWorld, erWorld, solveFactsState } from "./er-world";
import { everything, type KeyedSolution, type UntrackedItem } from "./keys";
import type { AlttprSettings } from "./settings";

/** What rules.json says of the dungeons and of where an item may go. */
const TABLES = ruleTables as unknown as {
  readonly dungeons: {
    readonly byName: Readonly<
      Record<
        string,
        {
          readonly code: string;
          readonly regions: readonly string[];
          readonly smallKeys: number;
          readonly bigKey: boolean;
          readonly source: string;
        }
      >
    >;
    readonly prefilled: readonly { readonly location: string }[];
    readonly preplaced: readonly {
      readonly id?: string;
      readonly location: string;
    }[];
  };
  readonly fill: {
    readonly forbid: readonly {
      readonly id?: string;
      readonly location: string;
      readonly when: string;
    }[];
    readonly always: readonly {
      readonly id?: string;
      readonly location: string;
      readonly req: string;
      readonly when: string;
    }[];
  };
};

/** A dungeon of the entrance randomizer, its keys kept in it. */
export interface ErDungeon {
  readonly id: DungeonId;
  /** The code of its keys: keyD1, bigKeyD1. */
  readonly code: string;
  /**
   * Its small keys, the one placed before the others included (Skull
   * Woods' Pinball Room): none in the retro world, whose keys are universal
   * (Dungeons.py:11).
   */
  readonly smallKeys: number;
  readonly bigKey: boolean;
  /**
   * Its spots, by the pack's ids: its regions' locations but those filled
   * before its items (the prizes, the events) and the key placed first.
   */
  readonly spots: readonly string[];
}

const REGION_LOCATIONS = new Map(
  (er.regions as readonly { name: string; locations: readonly string[] }[]).map(
    (r) => [r.name, r.locations],
  ),
);
const FILLED = new Set([
  ...TABLES.dungeons.prefilled.map((p) => p.location),
  ...TABLES.dungeons.preplaced.map((p) => p.location),
]);
/** The keys placed before the others, by item: the spot each holds. */
const PREPLACED = TABLES.dungeons.preplaced.map((p) => ({
  item: p.id ?? "",
  spot: erLocationId(p.location),
}));

/** The entrance randomizer's dungeons (Dungeons.py:18-32), Open and Standard. */
export function erDungeons(retro: boolean): readonly ErDungeon[] {
  return Object.values(TABLES.dungeons.byName).map((d) => {
    const found = DUNGEONS.find((x) => x.code === d.code);
    if (found === undefined) throw new RangeError(`No dungeon ${d.code}`);
    const key = `key${d.code}`;
    return {
      bigKey: d.bigKey,
      code: d.code,
      id: found.id,
      smallKeys: retro
        ? 0
        : d.smallKeys + PREPLACED.filter((p) => p.item === key).length,
      spots: d.regions
        .flatMap((r) => REGION_LOCATIONS.get(r) ?? [])
        .filter((name) => !FILLED.has(name))
        .map(erLocationId),
    };
  });
}

const parsed = new Map<string, Expr>();
const expr = (req: string): Expr => {
  let found = parsed.get(req);
  if (found === undefined) {
    found = parse(req);
    parsed.set(req, found);
  }
  return found;
};

/** A fill rule by the pack's location id. */
const bySpot = <T extends { location: string }>(rules: readonly T[]) => {
  const found = new Map<string, T[]>();
  for (const rule of rules) {
    const spot = erLocationId(rule.location);
    found.set(spot, [...(found.get(spot) ?? []), rule]);
  }
  return found;
};
const FORBID = bySpot(TABLES.fill.forbid);
const ALWAYS = bySpot(TABLES.fill.always);

/** The flags of a world's settings the key model reads. */
const flag = (world: ErWorld, name: keyof AlttprSettings) =>
  world.settings[name];

/**
 * Whether the randomizer may place `item` (a state id, `keyD1`) at `spot`
 * with `state` held (Location.can_fill, BaseClasses.py:806-807): its
 * always-allow lets it in whatever reaches it, or its region keeps it (a
 * dungeon's spot, which `spot` is), its item rules do not refuse it and
 * Link reaches it. `maybe` where the answer hangs on a placement, or on a
 * setting not known. Beatable only, the access is not checked once
 * everything beats the game (Fill.py:186-188), which a tracker cannot tell:
 * any spot its item rules take.
 *
 * set_always_allow replaces a spot's always-allow, but each branch of
 * set_trock_key_rules sets its own: any of them that may hold lets the item
 * in, which is never less than the one that does.
 */
function canFill(
  world: ErWorld,
  spot: string,
  item: string,
  state: State,
  solution: Solution,
): Tri {
  const { settings } = world;
  const when = (req: string) => evaluate(expr(req), {}, NO_RULES, { settings });
  const options = { regions: solution.regions(), settings };
  const always = (ALWAYS.get(spot) ?? [])
    .filter((rule) => rule.id === item)
    .reduce<Tri>(
      (found, rule) =>
        or(
          found,
          and(
            when(rule.when),
            evaluate(expr(rule.req), state, world.compiled.rules, options),
          ),
        ),
      "no",
    );
  if (always === "yes") return always;
  // forbid_item ands its refusal to the spot's item rule: refused where its
  // branch surely holds
  const refused = (FORBID.get(spot) ?? []).some(
    (rule) => rule.id === item && when(rule.when) === "yes",
  );
  if (refused) return always;
  const access =
    flag(world, "beatableOnly") === false ? solution.location(spot) : "yes";
  return or(always, access);
}

/** A dungeon whose items go untracked: their counts and every spot. */
interface KeptDungeon {
  readonly id: DungeonId;
  readonly keys: number;
  readonly bigKey: number;
  readonly keyItem: string;
  readonly bigKeyItem: string;
  readonly at: readonly string[];
}

/** What the key model of one world computes once: everything but the state. */
interface Model {
  readonly untracked: readonly UntrackedItem[];
  readonly dungeons: readonly KeptDungeon[];
  /**
   * Whether a dungeon can be proven safe: not when the seed is beatable
   * only, nor Turtle Rock while the world its fill saw is not known (below).
   */
  vouches(dungeon: DungeonId): boolean;
  /** The world with everything held, but one dungeon's items at a level. */
  everything(dungeon: DungeonId, keys: number, bigKeys: number): Solution;
  /** The world with everything held. */
  readonly all: Solution;
  /**
   * The states a dungeon was proven safe in: safety only grows with the
   * state, so it holds in any state that holds as much of everything.
   */
  readonly proofs: Map<DungeonId, State[]>;
  /** The level a dungeon was last found unsafe at: tried first next time. */
  readonly failed: Map<DungeonId, readonly [number, number]>;
}

const models = new WeakMap<ErWorld, Model>();

/**
 * Where each of a world's untracked items may sit: the spots of its dungeon
 * where Location.can_fill is not `no` with everything held. The randomizer
 * places them with everything else held but them (Fill.py:164-207, below):
 * with more held, can_fill only grows, so this holds every spot it may
 * choose.
 */
function modelOf(world: ErWorld): Model {
  const cached = models.get(world);
  if (cached !== undefined) return cached;
  const settings = world.settings as unknown as AlttprSettings;
  // The world the randomizer filled holds the doors noted and those not
  // noted yet, which may lead anywhere the shuffle leaves room for: it
  // reaches at most what that world does
  const upper = erWorld(settings, world.connections, {
    ...world.options,
    anywhere: true,
  });
  // Turtle Rock's key doors hang on what everything held reaches in it
  // (set_trock_key_rules): known only when the doors noted reach as much
  // as the doors not noted may
  const trockKnown = Object.keys(world.settings)
    .filter((name) => name.startsWith("allItemsReach_"))
    .every((name) => world.settings[name] === upper.settings[name]);
  const all = everything(settings);
  const allSolved = solveFactsState(upper, all).solution;
  // vt sends --keysanity for `full` dungeon items alone, which set
  // wildBigKeys: then every key is the player's to track
  const kept = flag(world, "wildBigKeys") === false;
  const dungeons = kept ? erDungeons(flag(world, "genericKeys") === true) : [];
  const untracked: UntrackedItem[] = [];
  const entries: KeptDungeon[] = [];
  for (const d of dungeons) {
    const kinds = [
      { count: d.smallKeys, item: `key${d.code}` },
      { count: d.bigKey ? 1 : 0, item: `bigKey${d.code}` },
    ].filter(({ count }) => count > 0);
    if (kinds.length === 0) continue;
    for (const { count, item } of kinds) {
      const spots = d.spots.filter(
        (spot) => canFill(upper, spot, item, all, allSolved) !== "no",
      );
      const first = PREPLACED.filter((p) => p.item === item).map((p) => p.spot);
      untracked.push({
        count,
        dungeon: d.id,
        generic: false,
        item,
        locations: [...first, ...spots],
      });
    }
    entries.push({
      at: [
        ...new Set(
          untracked
            .filter((u) => u.dungeon === d.id)
            .flatMap((u) => u.locations),
        ),
      ],
      bigKey: d.bigKey ? 1 : 0,
      bigKeyItem: `bigKey${d.code}`,
      id: d.id,
      keyItem: `key${d.code}`,
      keys: d.smallKeys,
    });
  }
  const levels = new Map<string, Solution>();
  const model: Model = {
    all: allSolved,
    dungeons: entries,
    everything: (dungeon, keys, bigKeys) => {
      const key = `${dungeon}/${keys}/${bigKeys}`;
      let found = levels.get(key);
      if (found === undefined) {
        const entry = entries.find((e) => e.id === dungeon);
        found = solveFactsState(upper, {
          ...all,
          ...(entry === undefined
            ? {}
            : { [entry.bigKeyItem]: bigKeys, [entry.keyItem]: keys }),
        }).solution;
        levels.set(key, found);
      }
      return found;
    },
    failed: new Map(),
    proofs: new Map(),
    untracked,
    vouches: (dungeon) =>
      flag(world, "beatableOnly") === false &&
      (dungeon !== "turtle-rock" || trockKnown),
  };
  models.set(world, model);
  return model;
}

/**
 * The items a world's player does not track, with where each may sit: a
 * dungeon's small keys and its big key, unless the seed is keysanity.
 */
export const erUntracked = (world: ErWorld): readonly UntrackedItem[] =>
  modelOf(world).untracked;

/**
 * `state` with some of the untracked items raised: each listed dungeon's
 * small keys to `keys` (at most its count) and its big key if `bigKeys` is
 * 1. A count already held is kept.
 */
function raise(
  state: State,
  dungeons: readonly KeptDungeon[],
  keys: number,
  bigKeys: number,
): State {
  const raised: Record<string, number> = {};
  for (const d of dungeons) {
    raised[d.keyItem] = Math.max(
      itemValue(state, d.keyItem),
      Math.min(keys, d.keys),
    );
    raised[d.bigKeyItem] = Math.max(
      itemValue(state, d.bigKeyItem),
      Math.min(bigKeys, d.bigKey),
    );
  }
  return { ...state, ...raised };
}

/** Whether `state` holds at least as much of everything as `than`. */
const covers = (state: State, than: State): boolean =>
  Object.keys(than).every((id) => itemValue(state, id) >= itemValue(than, id));

/**
 * `state` with every item the player does not track at its full count:
 * what the rules want beyond the keys, as asking for blockers needs it.
 */
export function withErUntracked(world: ErWorld, state: State): State {
  const { dungeons } = modelOf(world);
  return raise(state, dungeons, Infinity, 1);
}

/**
 * The key model over a state of the entrance randomizer's world, its facts
 * gained as solveFactsState gains them: what the tracker shows while the
 * player does not track the keys the randomizer kept in their dungeons.
 * Keysanity tracks them, and then this is solveFactsState's answer.
 *
 * Keys join the state as the player surely gets them, until none more do:
 * an item every spot of which is `yes`, and every item of a dungeon proven
 * safe (README.md). A location is then `yes` if it is with them, else
 * `maybe` if it is possible with every untracked item, `no` if not even
 * then.
 */
export function solveErWithKeys(world: ErWorld, state: State): KeyedSolution {
  const model = modelOf(world);
  const { untracked } = model;
  // Every untracked item held: what is `no` then is `no`
  const raisedAll = solveFactsState(
    world,
    raise(state, model.dungeons, Infinity, 1),
  ).solution;
  let { solution, state: sure } = solveFactsState(world, state);
  const held = (d: KeptDungeon) =>
    itemValue(sure, d.keyItem) >= d.keys &&
    itemValue(sure, d.bigKeyItem) >= d.bigKey;
  const proven = new Set<DungeonId>();
  const safe = (d: KeptDungeon): boolean => {
    if (!model.vouches(d.id)) return false;
    if (model.proofs.get(d.id)?.some((s) => covers(sure, s))) return true;
    // Cheap first: the player with every untracked item raised is at least
    // the player with this dungeon's alone
    const { all } = model;
    if (d.at.some((l) => rank(raisedAll.location(l)) < rank(all.location(l))))
      return false;
    const at = ([keys, big]: readonly [number, number]): boolean => {
      const mine = solveFactsState(world, raise(sure, [d], keys, big)).solution;
      const theirs = model.everything(d.id, keys, big);
      return d.at.every(
        (l) => rank(mine.location(l)) >= rank(theirs.location(l)),
      );
    };
    // Every count the player may have collected, from what is surely in
    // hand up; the level that failed last first
    const levels: (readonly [number, number])[] = [];
    const fromKeys = Math.min(itemValue(sure, d.keyItem), d.keys);
    const fromBig = Math.min(itemValue(sure, d.bigKeyItem), d.bigKey);
    for (let keys = d.keys; keys >= fromKeys; keys--)
      for (let big = d.bigKey; big >= fromBig; big--) levels.push([keys, big]);
    const last = model.failed.get(d.id);
    const first = levels.findIndex(
      ([keys, big]) => keys === last?.[0] && big === last?.[1],
    );
    if (first > 0) levels.unshift(...levels.splice(first, 1));
    const failing = levels.find((level) => !at(level));
    if (failing !== undefined) {
      model.failed.set(d.id, failing);
      return false;
    }
    model.proofs.set(d.id, [...(model.proofs.get(d.id) ?? []), sure]);
    return true;
  };
  for (;;) {
    const found = untracked.filter(
      (u) =>
        itemValue(sure, u.item) < u.count &&
        u.locations.every((l) => solution.location(l) === "yes"),
    );
    let added: Record<string, number> = Object.fromEntries(
      found.map((u) => [u.item, u.count]),
    );
    if (found.length === 0) {
      const next = model.dungeons.find(
        (d) => !proven.has(d.id) && !held(d) && safe(d),
      );
      if (next === undefined) break;
      proven.add(next.id);
      added = { [next.bigKeyItem]: next.bigKey, [next.keyItem]: next.keys };
    }
    ({ solution, state: sure } = solveFactsState(world, {
      ...sure,
      ...added,
    }));
  }
  const location = (id: string): Tri => {
    const now = solution.location(id);
    if (now === "yes") return now;
    return raisedAll.location(id) === "no" ? "no" : "maybe";
  };
  // The dungeons whose items a location waits on: those not in hand
  // without which it stays out of logic, each item else raised; all of
  // those not in hand when no one alone holds it back
  const pending = model.dungeons.filter((d) => !held(d));
  const without = new Map<DungeonId, Solution>();
  const withoutOne = (d: KeptDungeon): Solution => {
    let found = without.get(d.id);
    if (found === undefined) {
      found = solveFactsState(
        world,
        raise(
          sure,
          pending.filter((other) => other !== d),
          Infinity,
          1,
        ),
      ).solution;
      without.set(d.id, found);
    }
    return found;
  };
  const dungeonsOf = (id: string): readonly DungeonId[] => {
    if (location(id) !== "maybe" || raisedAll.location(id) !== "yes") return [];
    const alone = pending.filter((d) => withoutOne(d).location(id) !== "yes");
    return (alone.length > 0 ? alone : pending).map((d) => d.id);
  };
  return {
    dungeons: dungeonsOf,
    location,
    locations: () =>
      Object.fromEntries(
        world.compiled.locationIds.map((id) => [id, location(id)]),
      ),
    safe: (dungeon) => {
      const d = model.dungeons.find((x) => x.id === dungeon);
      return d === undefined || held(d);
    },
    solution,
    state: sure,
  };
}

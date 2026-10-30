// The keys of DR's world (keys.ts over key-analysis/) held to what DR's
// fill guarantees: wherever the model says yes, every placement of the
// dungeons' keys the fill may make lets the player in, playing it out with
// DR's own rule for that placement (its alternatives decided: the key in
// the one location behind a door, the big key behind it). A key a player
// records is one the play found. The property is shown to fail on a
// model that asks one key fewer than DR (not vacuous).
import { rank, type Settings, type State } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { solveFacts, solveFactsState } from "../facts";
import { ITEMS } from "../items";
import { medallionFacts } from "../medallions";
import { settingsFromUpstream } from "../settings";
import { DR_DATA } from "./data";
import { DR_DEFAULTS, type DrWorld, drKeyLogic, drWorld } from "./index";
import type { DoorRule } from "./key-analysis/analysis";
import { DUNGEON_EVENTS } from "./key-analysis/dungeon";
import { DR_KEY_CODES, keyDropsOf, type WorldKeys } from "./keys";
import { and, or } from "./text";

const OPEN: Settings = { ...DR_DEFAULTS, ...settingsFromUpstream("open") };
const WILD: Settings = { ...OPEN, wildBigKeys: true, wildKeys: true };
const STANDARD: Settings = {
  ...DR_DEFAULTS,
  ...settingsFromUpstream("standard"),
};
const INVERTED: Settings = {
  ...DR_DEFAULTS,
  ...settingsFromUpstream("inverted"),
  wildBigKeys: true,
  wildKeys: true,
};

/** The pack's items a player may hold, the keys aside. */
const TRACKED = ITEMS.filter((item) => !/^(key|bigKey)/.test(item.id));
const BASE: State = {
  heartContainer: 3,
  ...medallionFacts({ mire: "ether", turtleRock: "quake" }),
};
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

/** Where each key sits: a DR location to its item (`keyP2`). */
type Placement = ReadonlyMap<string, string>;

/**
 * The placement atoms DR's rule reads, for a world's analysis: the small
 * key in a door's one location behind (AllowSmall), the big key in a
 * door's locations behind (Lock).
 */
function atomsOf(settings: Settings) {
  const logic = drKeyLogic(DR_DATA, settings);
  const allow = new Map<DoorRule, string>();
  const lock = new Map<DoorRule, string>();
  for (const [dungeon, dungeonLogic] of logic)
    for (const [door, rule] of dungeonLogic.doorRules) {
      if (rule.allowSmall && rule.smallLocation !== null)
        allow.set(
          rule,
          `keyAt_${slug(rule.smallLocation.name)}_${slug(dungeon)}`,
        );
      if (rule.lockNum !== undefined)
        lock.set(rule, `bigKeyBehind_${slug(door)}`);
    }
  /** The atoms a placement makes true. */
  const of = (placement: Placement): State => {
    const state: Record<string, number> = {};
    for (const [rule, atom] of allow) {
      const at = placement.get(rule.smallLocation?.name ?? "");
      const dungeon = rule.smallLocation?.dungeon ?? "";
      if (at === `key${DR_KEY_CODES[dungeon]}`) state[atom] = 1;
    }
    for (const [rule, atom] of lock)
      for (const loc of rule.alternateBigKeyLoc)
        if (
          placement.get(loc.name) === `bigKey${DR_KEY_CODES[loc.dungeon ?? ""]}`
        )
          state[atom] = 1;
    return state;
  };
  // The big keys' forbidden spots (bk_restricted, forbid_item,
  // Rules.py:2366-2368)
  const forbidden = new Set(
    [...logic.values()].flatMap((l) =>
      [...l.bkRestricted].map((loc) => `${loc.name}/${l.dungeon}`),
    ),
  );
  return {
    allow,
    forbidden,
    items: [...allow.values(), ...lock.values()],
    lock,
    of,
  };
}

/**
 * DR's partial rule for a known placement (eval_small_key_door_partial_main,
 * Rules.py:2416-2447): the worst case capped, or an alternative its
 * placement grants; never `maybe`.
 */
const truthOf =
  (atoms: ReturnType<typeof atomsOf>) =>
  (dungeon: string, rule: DoorRule, _: unknown, keys: WorldKeys): string => {
    const alternatives: string[] = [];
    const allow = atoms.allow.get(rule);
    if (allow !== undefined && rule.allowSmallNum !== undefined)
      alternatives.push(and(allow, keys.atLeast(dungeon, rule.allowSmallNum)));
    const lock = atoms.lock.get(rule);
    if (lock !== undefined && rule.lockNum !== undefined)
      alternatives.push(
        and(
          lock,
          keys.atLeast(
            dungeon,
            Math.min(rule.lockNum, rule.alternateSmallKey ?? 0),
          ),
        ),
      );
    return or(
      keys.atLeast(dungeon, Math.min(rule.worstCase ?? 0, rule.smallKeyNum)),
      ...alternatives,
    );
  };

/** The dungeon items the fill places: each big key, each chest's small key. */
const DUNGEON_ITEMS = DR_DATA.dungeons.flatMap((d) => {
  const code = DR_KEY_CODES[d.name];
  return [
    ...(d.bigKey === null ? [] : [{ dungeon: d.name, item: `bigKey${code}` }]),
    ...d.smallKeys.map(() => ({ dungeon: d.name, item: `key${code}` })),
  ];
});

/** Each dungeon's locations a key may lie at: no event, prize or drop. */
const SPOTS = new Map(
  DR_DATA.dungeons.map((d) => [
    d.name,
    DR_DATA.regions
      .filter((r) => r.dungeon === d.name)
      .flatMap((r) =>
        r.locations.filter((l) => !(r.locationModes?.[l]?.length === 1)),
      )
      .filter(
        (l) =>
          !DUNGEON_EVENTS.has(l) &&
          !l.includes("- Prize") &&
          l !== "Agahnim 1" &&
          l !== "Agahnim 2" &&
          !keyDropsOf(DR_DATA).some((k) => k.location === l),
      ),
  ]),
);

/**
 * `state` with each placed item collected once its location is surely
 * reached, until no more is; the final state holds the keys found.
 */
function sweep(world: DrWorld, state: State, placement: Placement) {
  const taken = new Set<string>();
  let current = state;
  for (;;) {
    const { solution, state: next } = solveFactsState(world, current);
    const found = [...placement].filter(
      ([spot]) =>
        !taken.has(spot) &&
        solution.location(world.locationIds.get(spot) ?? spot) === "yes",
    );
    if (found.length === 0) return { solution, state: next };
    const raised: Record<string, number> = {};
    for (const [spot, item] of found) {
      taken.add(spot);
      raised[item] = (raised[item] ?? Number(next[item] ?? 0)) + 1;
    }
    current = { ...next, ...raised };
  }
}

/**
 * A placement DR's fill may make (fill_dungeons_restrictive): the big
 * keys, then the small keys, each in its dungeon where the truth reaches
 * it with every item but those placed held, those placed found where
 * reached, a big key never where the analysis forbids it (bk_restricted);
 * `pick` chooses the spot, `next` the item. The fill's placement rules
 * (sm_restricted, KeyDoorShuffle.py) are not ported: a draw they would
 * refuse may find no spot later. `forward`: the small keys first, those not
 * placed yet not held, so each lies where the keys before it reach.
 */
function fill(
  truth: DrWorld,
  atoms: ReturnType<typeof atomsOf>,
  pick: (spots: readonly string[]) => string,
  next: (count: number) => number,
  forward = false,
): Placement | undefined {
  const all: State = {
    ...BASE,
    ...Object.fromEntries(TRACKED.map(({ id, max }) => [id, max])),
  };
  const items = [
    ...DUNGEON_ITEMS.filter((d) => d.item.startsWith("bigKey")),
    ...DUNGEON_ITEMS.filter((d) => d.item.startsWith("key")),
  ];
  const order: typeof items = [];
  for (const kind of forward ? ["key", "bigKey"] : ["bigKey", "key"]) {
    const left = items.filter((d) => d.item.startsWith(kind));
    while (left.length > 0) order.push(...left.splice(next(left.length), 1));
  }
  const placed = new Map<string, string>();
  for (let i = 0; i < order.length; i++) {
    const current = order[i];
    if (current === undefined) break;
    const unplaced: Record<string, number> = {};
    for (const later of order.slice(i + 1))
      if (!(forward && later.item.startsWith("key")))
        unplaced[later.item] = (unplaced[later.item] ?? 0) + 1;
    const { solution } = sweep(
      truth,
      { ...all, ...unplaced, ...atoms.of(placed) },
      placed,
    );
    const spots = (SPOTS.get(current.dungeon) ?? []).filter(
      (spot) =>
        !placed.has(spot) &&
        !(
          current.item.startsWith("bigKey") &&
          atoms.forbidden.has(`${spot}/${current.dungeon}`)
        ) &&
        solution.location(truth.locationIds.get(spot) ?? spot) === "yes",
    );
    if (spots.length === 0) return undefined;
    placed.set(pick(spots), current.item);
  }
  return placed;
}

const odds = fc.double({ max: 1, min: 0, noNaN: true });
/** A player's state: each item held with a probability drawn per state. */
const states = fc
  .record({
    held: fc.array(fc.tuple(fc.nat(24), odds), {
      maxLength: TRACKED.length,
      minLength: TRACKED.length,
    }),
    stage: odds,
  })
  .map(({ held, stage }) => ({
    ...BASE,
    ...Object.fromEntries(
      TRACKED.map(({ id, max }, i) => {
        const [n, p] = held[i] ?? [0, 1];
        return [id, p < stage ? Math.min(max, n) : 0];
      }),
    ),
  }));

/**
 * Whether `model` says yes only where the play of a drawn placement
 * reaches, over random states and fills; `seen` records a yes the
 * player's keys raised.
 */
function soundness(model: DrWorld, settings: Settings) {
  const atoms = atomsOf(settings);
  const truth = drWorld(settings, {
    doorRule: truthOf(atoms),
    items: atoms.items,
  });
  const seen = new Set<string>();
  const property = fc.property(
    states,
    fc.array(odds, { maxLength: 60, minLength: 60 }),
    fc.boolean(),
    (state, draws, adversarial) => {
      let n = 0;
      const odd = () => draws[n++ % draws.length] ?? 0;
      const draw = (count: number) =>
        Math.min(count - 1, Math.floor(odd() * count));
      // The adversary draws among the spots the player reaches least
      const alone = solveFacts(truth, state);
      const score = (spot: string) =>
        rank(alone.location(truth.locationIds.get(spot) ?? spot));
      const pick = (spots: readonly string[]) => {
        const low = Math.min(...spots.map(score));
        const drawn = adversarial
          ? spots.filter((spot) => score(spot) === low)
          : spots;
        return drawn[draw(drawn.length)] as string;
      };
      // An assumed fill that finds no spot for a key, as DR's may without
      // its placement rules, is drawn again with the small keys each where
      // the keys before it reach
      const placement =
        fill(truth, atoms, pick, draw) ?? fill(truth, atoms, pick, draw, true);
      if (placement === undefined) return true;
      const played = sweep(
        truth,
        { ...state, ...atoms.of(placement) },
        placement,
      );
      // The keys the player found, as recorded
      const keys = Object.fromEntries(
        Object.entries(played.state).filter(([id]) =>
          /^(key|bigKey)[A-Z]\d$/.test(id),
        ),
      );
      const keyed = solveFacts(model, { ...state, ...keys });
      const bare = solveFacts(model, state);
      for (const id of model.compiled.locationIds) {
        if (keyed.location(id) !== "yes") continue;
        if (played.solution.location(id) !== "yes") return false;
        if (bare.location(id) !== "yes") seen.add("raised");
      }
      return true;
    },
  );
  return { property, seen };
}

describe("the key model's soundness", () => {
  // Open the most runs, the other modes fewer: CI time
  for (const [name, settings, runs] of [
    ["keys in their dungeons", OPEN, 25],
    ["wild keys", WILD, 25],
    ["Standard, keys in their dungeons", STANDARD, 12],
    ["Inverted, wild keys", INVERTED, 12],
  ] as const)
    it(`says yes only where every placement the fill may make lets the player in (${name})`, () => {
      const { property, seen } = soundness(drWorld(settings), settings);
      fc.assert(property, { numRuns: runs, seed: 7 });
      // Not vacuous: the model said yes where only its keys could
      expect([...seen]).toEqual(["raised"]);
      // A property run takes ~5 s alone and 4x that under coverage on a busy
      // machine: past the pack's hung-test timeout, not hung
    }, 90_000);

  it("finds a model that takes a placement's alternative for granted unsound", () => {
    // AllowSmall and the big key's Lock read as sure: a key the tracker
    // does not know the place of
    const broken = drWorld(WILD, {
      doorRule: (dungeon, rule, _, keys) =>
        or(
          keys.atLeast(
            dungeon,
            Math.min(rule.worstCase ?? 0, rule.smallKeyNum),
          ),
          ...(rule.allowSmallNum === undefined
            ? []
            : [keys.atLeast(dungeon, rule.allowSmallNum)]),
          ...(rule.lockNum === undefined
            ? []
            : [
                keys.atLeast(
                  dungeon,
                  Math.min(rule.lockNum, rule.alternateSmallKey ?? 0),
                ),
              ]),
        ),
    });
    const { property } = soundness(broken, WILD);
    expect(
      fc.check(property, { endOnFailure: true, numRuns: 150, seed: 7 }).failed,
    ).toBe(true);
  });

  it("finds a model asking one key fewer than DR unsound", () => {
    const broken = drWorld(WILD, {
      doorRule: (dungeon, rule, _, keys) =>
        keys.atLeast(
          dungeon,
          Math.min(rule.worstCase ?? 0, rule.smallKeyNum) - 1,
        ),
    });
    const { property } = soundness(broken, WILD);
    expect(
      fc.check(property, { endOnFailure: true, numRuns: 60, seed: 7 }).failed,
    ).toBe(true);
  });
});

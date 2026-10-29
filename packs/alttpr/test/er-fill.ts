// The entrance randomizer's fill of a dungeon's keys, played out on the
// pack's port of its world: what the key model's tests hold it to.
//
// Fill.py fill_restrictive places each dungeon item where Location.can_fill
// holds with everything else held: the items not placed yet, and those
// placed where the state so far reaches (sweep_for_events), the Pinball
// Room's key among them (Dungeons.py fill_dungeons_restrictive). `fill`
// draws such a placement, a spot the rules surely take (`yes`) for each
// item, never one an always-allow alone lets in, nor a spot a forbid_item
// refuses: each is a placement the randomizer may make, whatever the order
// it takes the items in. `sweep` plays a placement out as the player does,
// picking up each key where the state so far surely reaches it.
import { itemValue, type Solution, type State } from "@alltp/engine";
import { erLocationId } from "../src/entrances";
import ruleTables from "../src/entrances/rules.json" with { type: "json" };
import { erDungeons, erUntracked } from "../src/er-keys";
import { type ErWorld, solveFactsState } from "../src/er-world";
import { everything } from "../src/keys";
import type { AlttprSettings } from "../src/settings";

/** Where each key sits: a spot (the pack's id) to its item (`keyD1`). */
export type Placement = ReadonlyMap<string, string>;

const TABLES = ruleTables as unknown as {
  readonly dungeons: {
    readonly preplaced: readonly { readonly id: string; location: string }[];
  };
  readonly fill: {
    readonly always: readonly { readonly id?: string; location: string }[];
    readonly forbid: readonly {
      readonly id?: string;
      readonly location: string;
      readonly when: string;
    }[];
  };
};

/** The spots an item may never be drawn at: always-allowed or refused. */
const BARRED = new Set(
  [...TABLES.fill.always, ...TABLES.fill.forbid].map(
    (rule) => `${erLocationId(rule.location)}/${rule.id ?? ""}`,
  ),
);

/** The keys placed before the others: the Pinball Room's. */
export const PREPLACED: Placement = new Map(
  TABLES.dungeons.preplaced.map((p) => [erLocationId(p.location), p.id]),
);

/**
 * `state` with each placed item it surely reaches collected, until no more
 * is: a placed item counts once its spot is `yes`.
 */
export function sweep(
  world: ErWorld,
  state: State,
  placement: Placement,
): Solution {
  const taken = new Set<string>();
  let current = state;
  for (;;) {
    const { solution, state: next } = solveFactsState(world, current);
    const found = [...placement].filter(
      ([spot]) => !taken.has(spot) && solution.location(spot) === "yes",
    );
    if (found.length === 0) return solution;
    const raised: Record<string, number> = {};
    for (const [spot, item] of found) {
      taken.add(spot);
      raised[item] = (raised[item] ?? itemValue(next, item)) + 1;
    }
    current = { ...next, ...raised };
  }
}

/**
 * A placement of a world's untracked items the randomizer may make, each
 * spot chosen by `pick` among those the fill surely takes: the big keys
 * first, then the small keys (Dungeons.py:149-153). Undefined when an item
 * finds no such spot.
 */
export function fill(
  world: ErWorld,
  pick: (spots: readonly string[]) => string,
): Placement | undefined {
  const untracked = erUntracked(world);
  const items = [
    ...untracked.filter((u) => u.item.startsWith("bigKey")),
    ...untracked.filter((u) => u.item.startsWith("key")),
  ].flatMap((u) => {
    const preplaced = [...PREPLACED.values()].filter((i) => i === u.item);
    return Array.from({ length: u.count - preplaced.length }, () => u);
  });
  const placed = new Map(PREPLACED);
  const retro = world.settings.genericKeys === true;
  const dungeonSpots = new Map(erDungeons(retro).map((d) => [d.id, d.spots]));
  const base: Record<string, number | boolean | undefined> = {
    ...everything(world.settings as unknown as AlttprSettings),
  };
  for (const u of untracked) base[u.item] = 0;
  for (let i = 0; i < items.length; i++) {
    const u = items[i];
    if (u === undefined) break;
    // Everything but the dungeon items, those not placed yet held
    const unplaced: Record<string, number | boolean | undefined> = { ...base };
    for (const later of items.slice(i + 1))
      unplaced[later.item] = itemValue(unplaced, later.item) + 1;
    const solution = sweep(world, unplaced, placed);
    // Any spot of its dungeon, not only those the key model expects
    const spots = (dungeonSpots.get(u.dungeon) ?? []).filter(
      (spot) =>
        !placed.has(spot) &&
        !BARRED.has(`${spot}/${u.item}`) &&
        solution.location(spot) === "yes",
    );
    if (spots.length === 0) return undefined;
    placed.set(pick(spots), u.item);
  }
  return placed;
}

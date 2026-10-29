// The randomizer's fill of the dungeons' keys, played out on the pack's
// world: what the key model's soundness property holds it to (the entrance
// randomizer's is er-fill.ts).
//
// RandomAssumed::fillItemsInLocations (app/Filler/RandomAssumed.php:59-135)
// places the dungeon items first, in the pool's order (World::getDungeonPool,
// World.php:857-869, over config/item.php:94-120): every big key, then every
// small key, each dungeon in the order A2, D1-D7, A1, H2, P1-P3. Each goes
// where Location::canFill holds with the items not placed yet assumed held,
// and those placed where that state reaches collected (collectOtherItems).
// `fill` draws such a placement, a spot canFill surely takes (`yes`) for
// each item, among every location of the world, never one an always-allow
// alone lets in (a key locking itself in, which README.md's "The key model"
// sets apart). `sweep` plays a placement out as the player does, picking up
// each key where the state so far surely reaches it.
import { itemValue, type Solution, type State, solve } from "@alltp/engine";
import { DUNGEONS } from "../src/dungeons";
import type { Filler } from "../src/fill";
import { everything, untrackedItems } from "../src/keys";
import type { LocationDef } from "../src/location";

/** Where each key sits: a location (the pack's id) to its item (`keyD1`). */
export type Placement = ReadonlyMap<string, string>;

/** The dungeons in the pool's order (config/item.php:95-120). */
const ORDER = [
  "A2",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "A1",
  "H2",
  "P1",
  "P2",
  "P3",
];

/**
 * `state` with each placed item it surely reaches collected, until no more
 * is: a placed item counts once its location is `yes`.
 */
export function sweep(
  filler: Filler,
  state: State,
  placement: Placement,
): { readonly state: State; readonly solution: Solution } {
  const taken = new Set<string>();
  let current = state;
  for (;;) {
    const solution = solve(filler.world, current);
    const found = [...placement].filter(
      ([spot]) => !taken.has(spot) && solution.location(spot) === "yes",
    );
    if (found.length === 0) return { solution, state: current };
    const raised: Record<string, number> = {};
    for (const [spot, item] of found) {
      taken.add(spot);
      raised[item] = (raised[item] ?? itemValue(current, item)) + 1;
    }
    current = { ...current, ...raised };
  }
}

/** A state id's upstream name: `keyD1` is `KeyD1`. */
const upstreamName = (item: string) =>
  `${item.charAt(0).toUpperCase()}${item.slice(1)}`;

/**
 * A placement of a world's untracked items the randomizer may make, each
 * location chosen by `pick` among those the fill surely takes for the item
 * (`keyD1`). Undefined
 * when an item finds none. For a world whose keys stay in their dungeon:
 * not the retro world's generic keys.
 */
export function fill(
  filler: Filler,
  pick: (spots: readonly string[], item: string) => string,
): Placement | undefined {
  const untracked = untrackedItems(filler);
  const rankOf = (dungeon: string) =>
    ORDER.indexOf(DUNGEONS.find((d) => d.id === dungeon)?.code ?? "");
  const ofKind = (big: boolean) =>
    untracked
      .filter((u) => u.item.startsWith("bigKey") === big)
      .sort((a, b) => rankOf(a.dungeon) - rankOf(b.dungeon));
  const items = [...ofKind(true), ...ofKind(false)].flatMap((u) =>
    Array.from({ length: u.count }, () => u.item),
  );
  const defs = new Map<string, LocationDef>(
    filler.modules.flatMap((m) =>
      m.regions.flatMap((r) => r.locations.map((l) => [l.id, l] as const)),
    ),
  );
  const base: Record<string, number | boolean | undefined> = {
    ...everything(filler.settings),
  };
  for (const u of untracked) base[u.item] = 0;
  const placed = new Map<string, string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as string;
    const name = upstreamName(item);
    // Everything but the dungeon items, those not placed yet held
    const unplaced = { ...base };
    for (const later of items.slice(i + 1)) {
      unplaced[later] = itemValue(unplaced, later) + 1;
    }
    const { solution, state } = sweep(filler, unplaced, placed);
    const spots = filler.locations.filter(
      (spot) =>
        !placed.has(spot) &&
        filler.canFill(spot, name, state, solution) === "yes" &&
        // Taken by its own access, not by an always-allow alone
        (defs.get(spot)?.fill?.always?.items.includes(name) !== true ||
          solution.location(spot) === "yes"),
    );
    if (spots.length === 0) return undefined;
    placed.set(pick(spots, item), item);
  }
  return placed;
}

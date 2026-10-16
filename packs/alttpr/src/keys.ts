// Where the dungeons' items can sit.
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
import { itemValue, type State, solve } from "@alltp/engine";
import { derivedFacts } from "./derived";
import type { Filler } from "./fill";
import { fromUpstream, ITEMS } from "./items";
import { medallionFacts } from "./medallions";
import type { AlttprSettings } from "./settings";

/** Every item at its count in the pool, as the derived facts read them. */
function withFacts(
  items: Readonly<Record<string, number>>,
  settings: AlttprSettings,
): State {
  return {
    ...items,
    // Either pad may want any medallion: with all three, both open
    ...medallionFacts({ mire: "unknown", turtleRock: "unknown" }),
    ...derivedFacts(items, settings),
  };
}

const POOL: Readonly<Record<string, number>> = Object.fromEntries(
  ITEMS.map(({ id, max }) => [id, max]),
);

/**
 * Everything a world holds: every item at its count in the pool, every
 * prize and event, both medallion pads open. What the randomizer assumes
 * held before it places the first item.
 */
export function everything(settings: AlttprSettings): State {
  return withFacts(POOL, settings);
}

/**
 * Everything but one of `item` (an upstream name): what the randomizer
 * assumes held at most while it places that item.
 */
export function everythingBut(item: string, settings: AlttprSettings): State {
  const contribution = fromUpstream(item);
  if (contribution === null) return everything(settings);
  const { atLeast, count, item: id } = contribution;
  const held = itemValue(POOL, id);
  return withFacts(
    {
      ...POOL,
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

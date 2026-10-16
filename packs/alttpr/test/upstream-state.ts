// The item collections of the upstream tests, ported from tests/TestCase.php
// (sporchia/alttp_vt_randomizer at 219fcafd), as tracker states.
import { stateFromUpstream, UPSTREAM_ITEMS } from "../src/items";
import type { Collection } from "./fixtures";

/**
 * The names `allItemsExcept` removes together (TestCase.php:66-111).
 * AnySword falls through to UpgradedSword, and both remove UncleSword:
 * without UpgradedSword, only the level-1 swords and one ProgressiveSword
 * are left.
 */
export const EXCEPT_GROUPS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "AnySword",
    [
      "L1Sword",
      "L1SwordAndShield",
      "ProgressiveSword",
      "UncleSword",
      "L2Sword",
      "MasterSword",
      "L3Sword",
      "L4Sword",
    ],
  ],
  [
    "UpgradedSword",
    ["UncleSword", "L2Sword", "MasterSword", "L3Sword", "L4Sword"],
  ],
  [
    "AnyBottle",
    [
      "BottleWithBee",
      "BottleWithFairy",
      "BottleWithRedPotion",
      "BottleWithGreenPotion",
      "BottleWithBluePotion",
      "Bottle",
      "BottleWithGoldBee",
    ],
  ],
  ["AnyBow", ["Bow", "BowAndArrows", "BowAndSilverArrows", "ProgressiveBow"]],
  ["Flute", ["OcarinaActive", "OcarinaInactive"]],
  ["Gloves", ["ProgressiveGlove", "PowerGlove", "TitansMitt"]],
]);

/** allItems() is "everything but the generic keys" (TestCase.php:61-64). */
export const ALWAYS_EXCEPT: readonly string[] = ["BigKey", "Key", "ShopKey"];

/** What `manyKeys()` gives every small key (ItemCollection.php:283-292). */
const MANY_KEYS = 10;

/**
 * `allItemsExcept(except)` as upstream names: one of every item of
 * `Item::all` (aliases included), every name starting with "Key" ten times,
 * minus ALWAYS_EXCEPT and `except`. A name of `except` is a group of
 * EXCEPT_GROUPS or an item; anything else throws, where upstream would
 * silently remove nothing.
 *
 * One upstream quirk is not reproduced: ItemCollection::offsetUnset leaves
 * a removed item in the list `bottleCount()` and `hasHealth()` count, so
 * upstream still counts removed bottles and hearts there. The fixture specs
 * check that no case depends on it.
 */
export function allItemsExcept(except: readonly string[]): string[] {
  const removed = new Set<string>();
  for (const name of [...ALWAYS_EXCEPT, ...except]) {
    const group = EXCEPT_GROUPS.get(name);
    if (group !== undefined) {
      for (const member of group) removed.add(member);
    } else if (UPSTREAM_ITEMS.has(name)) {
      removed.add(name);
    } else {
      throw new RangeError(`allItemsExcept: unknown name "${name}"`);
    }
  }
  return [...UPSTREAM_ITEMS.keys()]
    .filter((name) => !removed.has(name))
    .flatMap((name) =>
      Array.from(
        { length: name.startsWith("Key") ? MANY_KEYS : 1 },
        () => name,
      ),
    );
}

/** The state of a case's collection, given what its file's setUp collected. */
export function collectionState(
  collection: Collection,
  setUp: readonly string[],
): ReturnType<typeof stateFromUpstream> {
  const base =
    collection.base === "allItems"
      ? allItemsExcept(collection.except ?? [])
      : setUp;
  return stateFromUpstream([...base, ...collection.add]);
}

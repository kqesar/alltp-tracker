// Facts derived from the items before solving, for the upstream rules that
// are not monotone in the items.
//
// Palace of Darkness asks for more keys once Link holds more items: with the
// hammer, a bow and the lamp, its key doors want one key more
// (`(Hammer && canShootArrows && Lamp) || wildKeys ? KeyD1 6 : 5`,
// PalaceOfDarkness.php:88, and 4 against 3 at 108, 113, 131, 137). Finding
// the hammer can then close a chest five keys opened, and upstream's tests
// hold both sides (PalaceOfDarknessTest.php:135 opens the Big Key Chest with
// five keys and no bow). The rule language has no negation, so no
// requirement can say "without the hammer".
//
// As for the medallion pads (medallions.ts), the state carries the fact
// instead: `podFewerKeysSuffice` holds while that condition fails, and a rule
// reads `keyD1 >= 6 | !setting(wildKeys) & podFewerKeysSuffice & keyD1 >= 5`.
// A state recomputes the facts from its items each time they change
// (derivedFacts), so within one state every rule stays monotone; across
// states, getting the hammer may lower a key rule, as upstream has it.
//
// The retro world's key for sale is a fact of the same kind: once a ShopKey
// is in, ItemCollection::has holds any count of any small key
// (ItemCollection.php:269-272), so the state holds every small key at its
// count in the pool, and the rules read them as they are.
import {
  evaluate,
  itemValue,
  loadRules,
  parse,
  type State,
} from "@alltp/engine";
import { ITEMS } from "./items";
import type { Source } from "./location";
import { RULES } from "./rules";
import type { AlttprSettings } from "./settings";

/** A fact the state carries: it holds while its condition surely fails. */
export interface DerivedFact {
  /** The condition, a requirement over the items and the settings. */
  readonly unless: string;
  readonly source: Source;
}

export const DERIVED = {
  /**
   * Palace of Darkness's lower key counts suffice: Link lacks the hammer, a
   * bow or the lamp the dark rooms want. Big Chest and the Dark Maze read
   * upstream's condition without the lamp (102, 145, 151), but they want the
   * lamp themselves, so there it is the same condition.
   */
  podFewerKeysSuffice: {
    source: "app/Region/Standard/PalaceOfDarkness.php:88",
    unless: "hammer & @canShootArrows & lamp >= setting(requireLamp)",
  },
} as const satisfies Readonly<Record<string, DerivedFact>>;

/** Every derived fact a rule may read. */
export const DERIVED_FACTS: readonly string[] = Object.keys(DERIVED);

const rules = loadRules(RULES);
const conditions = Object.entries(DERIVED).map(
  ([fact, { unless }]) => [fact, parse(unless)] as const,
);

/** The small keys, each with its count in the pool. */
const SMALL_KEYS = ITEMS.filter(({ id }) => /^key[A-Z]/.test(id));

/**
 * The derived facts of a state's items, each 1 or 0, under the run's
 * settings: spread them over the items (`{ ...items, ...derivedFacts(items,
 * settings) }`) every time the items change, so a stale fact is overwritten.
 * A fact holds only where its condition is `no`: a condition that might
 * hold asks for the higher count. With generic keys and a key for sale,
 * every small key joins them, at its count in the pool.
 */
export function derivedFacts(
  items: State,
  settings: AlttprSettings,
): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const [fact, condition] of conditions) {
    facts[fact] =
      evaluate(condition, items, rules, { settings }) === "no" ? 1 : 0;
  }
  if (settings.genericKeys && itemValue(items, "shopKey") >= 1) {
    for (const { id, max } of SMALL_KEYS) facts[id] = max;
  }
  return facts;
}

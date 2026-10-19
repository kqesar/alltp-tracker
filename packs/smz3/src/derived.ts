// Facts derived from the items before solving, for the upstream rules that
// are not monotone in the items, as the ALttPR pack has them
// (packs/alttpr/src/derived.ts).
//
// Palace of Darkness asks for more keys once Link holds more items: with the
// hammer, the bow and the lamp, its key doors want one key more
// (`(items.Hammer && items.Bow && items.Lamp) || config.Keysanity ? 6 : 5`,
// PalaceOfDarkness.cs:20), and some doors with the hammer and the bow alone
// (`(items.Hammer && items.Bow) || config.Keysanity ? 4 : 3`, :38). Ice
// Palace lets one key do while the big key is not held
// (`!items.BigKeyIP`, IcePalace.cs:49). The rule language has no negation,
// so the state carries the fact instead: it holds while its condition
// surely fails, and a rule reads `keyPD >= 6 | podNoHammerBowLamp & keyPD >=
// 5`. A state recomputes the facts from its items each time they change, so
// within one state every rule stays monotone.

import { evaluate, loadRules, parse, type State } from "@alltp/engine";

export const DERIVED = {
  /** Ice Palace's key spent before the big key is: no big key yet. */
  ipNoBigKey: "bigKeyIP",
  /** Palace of Darkness's lower counts for the rest. */
  podNoHammerBow: "hammer & bow",
  /** Palace of Darkness's lower counts for its dark rooms. */
  podNoHammerBowLamp: "hammer & bow & lamp",
} as const;

/** Every derived fact a rule may read. */
export const DERIVED_FACTS: readonly string[] = Object.keys(DERIVED);

const NO_HELPERS = loadRules({});
const conditions = Object.entries(DERIVED).map(
  ([fact, condition]) => [fact, parse(condition)] as const,
);

/**
 * The derived facts of a state's items, each 1 or 0: spread them over the
 * items (`{ ...items, ...derivedFacts(items) }`) every time the items
 * change, so a stale fact is overwritten.
 */
export function derivedFacts(items: State): Readonly<Record<string, number>> {
  const facts: Record<string, number> = {};
  for (const [fact, condition] of conditions) {
    facts[fact] = evaluate(condition, items, NO_HELPERS) === "no" ? 1 : 0;
  }
  return facts;
}

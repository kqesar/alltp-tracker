// The checks that cost rupees to get, for display only.
//
// The randomizer does not model money: no rule asks for a rupee, so the logic
// treats a paid check like a free one (the player is assumed to have the
// rupees). The price is what the game charges, shown beside the check's name
// so a player knows to bring it. Nothing here reaches a rule.
import { locationId } from "./location";

/** A paid check's price and where it was read. */
export interface RupeeCost {
  /** What the game takes from the player to give the item. */
  readonly rupees: number;
  /**
   * The line of vt's `app/Text.php` that states the price in the game's own
   * dialogue (held to `test/upstream/rupee-texts.json`, written by
   * `scripts/import-rupee-texts.mjs`). The ROM code that charges it is named
   * in the README's "Paid checks".
   */
  readonly source: `app/Text.php:${number}`;
}

/**
 * The paid checks, by location id: every check whose item the game sells,
 * and no more (the pack's spec holds the list to the ROM's dialogue).
 *
 * The prices are the base game's and no setting of the randomizer moves them:
 * vt's ROM patches (`app/Rom.php`) touch no price of these, and the only
 * setting that reaches one (`region.swordsInPool`, the Blacksmith's quick
 * item) keeps its 10 rupees (z3randomizer `swordswap.asm`, `GetSmithSword`).
 * Retro's shops are not locations of the pack, so their prices do not appear.
 */
export const RUPEE_COSTS: Readonly<Record<string, RupeeCost>> = {
  // Inverted only: the Bomb Shop sells the big bomb (the event that opens the
  // Pyramid) for 100 rupees
  [locationId("Bomb Merchant")]: { rupees: 100, source: "app/Text.php:664" },
  // The smiths ask 10 rupees to give their item
  [locationId("Blacksmith")]: { rupees: 10, source: "app/Text.php:528" },
  [locationId("Bottle Merchant")]: { rupees: 100, source: "app/Text.php:512" },
  // Pay 30 rupees to open two chests; the check is the prize chest
  [locationId("Chest Game")]: { rupees: 30, source: "app/Text.php:808" },
  [locationId("Digging Game")]: { rupees: 80, source: "app/Text.php:886" },
  // King Zora asks 500 rupees for his item (the flippers, in the base game)
  [locationId("King Zora")]: { rupees: 500, source: "app/Text.php:750" },
};

/** A check's price in rupees, or undefined for a free one. */
export const rupeeCostOf = (id: string): number | undefined =>
  RUPEE_COSTS[id]?.rupees;

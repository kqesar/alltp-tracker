// What a paid check shows beside its name: "Bottle Merchant (100 rupees)".
//
// Display only. The pack's logic does not model rupees (neither does the
// randomizer's own): a paid check is as available as a free one, and the
// price is a note for the player. The prices are the pack's (`RUPEE_COSTS`).
import { rupeeCostOf } from "@alltp/pack-alttpr";

/** A price in words: "100 rupees". */
export const rupeesText = (rupees: number): string => `${rupees} rupees`;

/** A name with its price after it when it has one. */
export const withRupees = (name: string, rupees: number | undefined): string =>
  rupees === undefined ? name : `${name} (${rupeesText(rupees)})`;

/** A check's name with its price after it when the check is paid. */
export const withCost = (name: string, id: string): string =>
  withRupees(name, rupeeCostOf(id));

/**
 * A map marker's name with its price when it stands for one paid check (a
 * marker for several, a cave with chests, names no price of its own).
 */
export const markerTitle = (marker: {
  readonly name: string;
  readonly locations: readonly string[];
}): string =>
  marker.locations.length === 1 && marker.locations[0] !== undefined
    ? withCost(marker.name, marker.locations[0])
    : marker.name;

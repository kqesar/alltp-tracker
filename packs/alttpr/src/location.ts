// What a location of the pack is: a check on the map, with the rule that
// opens it and where that rule was read upstream.
import type { DungeonItemClass } from "./world";

// The one id rule of every pack (ids are save keys): see `@alltp/engine`
export { locationId } from "@alltp/engine";

/**
 * The kinds of location: the upstream Location classes (app/Location/*.php),
 * in lowerCamel. A subclass (Prize\Crystal, Npc\Zora…) has its base's kind.
 */
export const LOCATION_KINDS = [
  "bigChest",
  "chest",
  "dash",
  "dig",
  "drop",
  "fountain",
  "medallion",
  "npc",
  "pedestal",
  "prize",
  "standing",
  "trade",
] as const;

export type LocationKind = (typeof LOCATION_KINDS)[number];

/**
 * Where a rule comes from: the upstream file and line it was read at
 * (`app/Region/Standard/TowerOfHera.php:121`), or `game` for what upstream
 * does not model, such as an item one can see before reaching it.
 */
export type Source = `app/${string}.php:${number}` | "game";

/**
 * Where a location's contents can be seen before it can be collected: the
 * engine's `Visibility`, with where it was read. Upstream does not model
 * sight, so its source is usually `game`.
 */
export interface Visible {
  /** The region id it is seen from; the location's own region when omitted. */
  readonly from?: string;
  /** What seeing it needs once there; `true` when omitted. */
  readonly req?: string;
  readonly source: Source;
}

/** One location: plain data, so a pack can be diffed and checked at load. */
export interface LocationDef {
  /** locationId(name): unique, and the key save files use. */
  readonly id: string;
  /** The official name, as upstream writes it. */
  readonly name: string;
  readonly kind: LocationKind;
  /**
   * The requirement once in its region, in the engine's rule language; it
   * may `reach()` another region.
   */
  readonly req: string;
  /** Where `req` was read. */
  readonly source: Source;
  /** When what it holds can be seen without getting it. */
  readonly visible?: Visible;
  /** What the randomizer checks before it places an item here. */
  readonly fill?: LocationFill;
}

/**
 * Some upstream items: listed by name (`KeyD1`), every item of some dungeon
 * classes (Item\Key, Item\BigKey…: any dungeon's), or every item but some.
 */
export type ItemMatch =
  | { readonly items: readonly string[] }
  | { readonly classes: readonly DungeonItemClass[] }
  | { readonly allBut: readonly string[] };

/** A setFillRules clause: items the location refuses. */
export interface Refusal {
  readonly refuse: ItemMatch;
  /** The settings it applies under, as `!setting(x)`; always when omitted. */
  readonly when?: string;
  readonly source: Source;
}

/**
 * What a region file tells Location::canFill (app/Location.php:72-85) about
 * one location, beyond its region's dungeon items and its rule: an item may
 * be placed when it is always allowed, or when the region keeps it, no
 * refusal names it, `requires` holds and the location is reachable with it
 * there. Item names are upstream's (`KeyD1`, `BigKeyP3`).
 */
export interface LocationFill {
  /**
   * setAlwaysAllow: these items go here whatever the region keeps and
   * whether Link can get them, when `req` holds over the items held and
   * the settings.
   */
  readonly always?: {
    readonly items: readonly string[];
    readonly req: string;
    readonly source: Source;
  };
  /** setFillRules, clause by clause. */
  readonly refuse?: readonly Refusal[];
  /**
   * The part of setFillRules that reads more than the item and the
   * settings, as a requirement over the items held.
   */
  readonly requires?: { readonly req: string; readonly source: Source };
  /**
   * Its rule once it holds an item that rule asks about (`hasItem` on
   * itself, or `itemInLocations` over a list that names it): the item's
   * entry while it holds that item, `otherwise` (`req` when omitted) while
   * it holds another. `req` reads such a placement as `maybe`, since a
   * tracker does not know it; placing the item settles it.
   */
  readonly holding?: {
    readonly items: Readonly<Record<string, string>>;
    readonly otherwise?: string;
    readonly source: Source;
  };
}

/** The kind of an upstream Location class: `Prize\Crystal` is a prize. */
export function locationKind(upstreamClass: string): LocationKind {
  const base = upstreamClass.split("\\")[0] ?? "";
  const kind = `${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  const known = LOCATION_KINDS.find((k) => k === kind);
  if (known === undefined) {
    throw new RangeError(`Unknown upstream location class "${upstreamClass}"`);
  }
  return known;
}

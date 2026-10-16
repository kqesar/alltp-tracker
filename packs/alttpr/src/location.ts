// What a location of the pack is: a check on the map, with the rule that
// opens it and where that rule was read upstream.

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
}

/**
 * The id of a location: its official name in lowercase kebab case, with
 * " - " as "/" and apostrophes dropped. "Tower of Hera - Big Key Chest" is
 * tower-of-hera/big-key-chest, "King's Tomb" kings-tomb.
 */
export function locationId(name: string): string {
  return name
    .split(" - ")
    .map((part) =>
      part
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("/");
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

import type { Placement } from "./model";

/**
 * One thing the player did in the run, as the tracker recorded it: a check
 * done, an item got, or both. A pack's adapter turns its timeline into these
 * (ALttPR: `check:<id>` and `item:<id>:<level>`), one find per event: a check
 * that gave a known item is one find carrying both, never two.
 */
export interface Find {
  /** When: any number that grows with the run (ms into it, or the order). */
  readonly at: number;
  /** The location checked, when the tracker knows it (a pack location id). */
  readonly location?: string;
  /** The item got, when the tracker knows it (a pack item id). */
  readonly item?: string;
}

export interface CompareInput {
  /** The seed's placements, with their spheres. */
  readonly placements: readonly Placement[];
  /** What the run recorded. */
  readonly finds: readonly Find[];
  /**
   * Locations whose state the tracker cannot tell (a dungeon's checks
   * outside autotracking count chests, not places): never found is then
   * `unknown`, not `missed`.
   */
  readonly unknown?: ReadonlySet<string>;
}

export type Whether = "found" | "missed" | "unknown";

export interface Entry {
  readonly placement: Placement;
  /** The find that matches it, or null. */
  readonly find: Find | null;
  /**
   * True when the match is by item, not by location: the k-th find of an
   * item stands for the k-th placement of that item in sphere order (how a
   * progressive item, or any item the run got without a check, is attributed).
   */
  readonly inferred: boolean;
  readonly state: Whether;
  /**
   * How many placements of later spheres were found before this one: 0 for
   * a placement in order, not found or outside the playthrough. This many
   * items the playthrough would have you hold later were got first.
   */
  readonly behind: number;
}

export interface Comparison {
  /** One per placement, in the input's order. */
  readonly entries: readonly Entry[];
  /** Over the placements of the playthrough (those with a sphere). */
  readonly summary: {
    readonly required: number;
    readonly inOrder: number;
    readonly late: number;
    readonly missed: number;
    readonly unknown: number;
  };
  /** Finds that matched no placement (an item from a shop, a start item). */
  readonly unmatched: readonly Find[];
}

/**
 * Sets the run against the seed. A find with a location is matched to that
 * placement exactly. A find with an item and no location is matched by item
 * to the earliest-sphere placement of that item still without one (ties in
 * the input's order), the earliest find first. Everything else is left
 * `missed`, or `unknown` where the caller says the tracker cannot know.
 *
 * "Late" is the playthrough's own measure: the seed lists items by the sphere
 * where they become reachable, so an item found after some of a later sphere
 * was found out of order (a shortcut, a glitch, a different route), not
 * necessarily wrongly. Cost is O(n log n + r^2) for n placements and r
 * required ones, r under a few hundred.
 */
export function compareRun(input: CompareInput): Comparison {
  const { placements, finds, unknown } = input;
  const matched: (Find | null)[] = placements.map(() => null);
  const inferred: boolean[] = placements.map(() => false);
  const used = new Set<Find>();

  // 1. By location, exactly. Of two finds for one place the earlier counts.
  const byLocation = new Map<string, number>();
  placements.forEach((p, i) => {
    byLocation.set(p.location, i);
  });
  for (const find of sortedByTime(finds)) {
    if (find.location === undefined) continue;
    const index = byLocation.get(find.location);
    if (index === undefined || matched[index] !== null) continue;
    matched[index] = find;
    used.add(find);
  }

  // 2. By item, for finds with no location: sphere order against time order.
  const waiting = new Map<string, number[]>();
  const order = placements
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (placements[a]?.sphere ?? Number.POSITIVE_INFINITY) -
          (placements[b]?.sphere ?? Number.POSITIVE_INFINITY) || a - b,
    );
  for (const i of order) {
    const item = placements[i]?.item;
    if (item === null || item === undefined || matched[i] !== null) continue;
    const queue = waiting.get(item);
    if (queue) queue.push(i);
    else waiting.set(item, [i]);
  }
  const cursor = new Map<string, number>();
  for (const find of sortedByTime(finds)) {
    if (find.location !== undefined || find.item === undefined) continue;
    const queue = waiting.get(find.item);
    const at = cursor.get(find.item) ?? 0;
    const index = queue?.[at];
    if (index === undefined) continue;
    cursor.set(find.item, at + 1);
    matched[index] = find;
    inferred[index] = true;
    used.add(find);
  }

  // 3. Late: for each found required placement, the found placements of
  // later spheres that came before it.
  const required: number[] = [];
  placements.forEach((p, i) => {
    if (p.sphere !== null) required.push(i);
  });
  const behind = placements.map(() => 0);
  for (const i of required) {
    const at = matched[i]?.at;
    const sphere = placements[i]?.sphere;
    if (at === undefined || sphere === null || sphere === undefined) continue;
    let count = 0;
    for (const j of required) {
      const other = matched[j];
      const later = placements[j]?.sphere;
      if (
        other &&
        later !== null &&
        later !== undefined &&
        later > sphere &&
        other.at < at
      ) {
        count++;
      }
    }
    behind[i] = count;
  }

  const entries: Entry[] = placements.map((placement, i) => {
    const find = matched[i] ?? null;
    const state: Whether = find
      ? "found"
      : unknown?.has(placement.location)
        ? "unknown"
        : "missed";
    return {
      behind: behind[i] ?? 0,
      find,
      inferred: inferred[i] ?? false,
      placement,
      state,
    };
  });

  const summary = { inOrder: 0, late: 0, missed: 0, required: 0, unknown: 0 };
  for (const i of required) {
    const entry = entries[i];
    if (!entry) continue;
    summary.required++;
    if (entry.state === "missed") summary.missed++;
    else if (entry.state === "unknown") summary.unknown++;
    else if (entry.behind > 0) summary.late++;
    else summary.inOrder++;
  }

  return {
    entries,
    summary,
    unmatched: finds.filter((f) => !used.has(f)),
  };
}

/** A copy of the finds, earliest first (the sort is stable: ties keep their order). */
function sortedByTime(finds: readonly Find[]): Find[] {
  return [...finds].sort((a, b) => a.at - b.at);
}

// The crystal switches' states of the Door Randomizer's world, as its
// traversal carries them (traverse_world, BaseClasses.py:628-692): Link
// enters a dungeon with the orange blocks up, a door that hits a switch
// (`c_switch`) lets either state through, a barrier lets only its own
// colour pass (valid_crystal, :712-714), and leaving the dungeon forgets
// the state. A region's states only grow, so the world is a product: each
// dungeon region a node per state some path can bring it in, a region
// reached in both split in two copies (`<id>__orange`, `<id>__blue`) that
// lead to the region itself, where its locations are.
import { DOOR_NAMED, type DrRegion, regionNamed } from "./data";
import { ALTERNATIVE_CRYSTAL_DOORS } from "./keys";

export type Crystal = "orange" | "blue";
const CRYSTALS: readonly Crystal[] = ["orange", "blue"];

/** An exit, as the world builder holds it. */
interface CrystalExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

/**
 * The states an exit leaves a dungeon region of state `s` in, toward a
 * dungeon region: none if a barrier of the other colour blocks it, both
 * if its door hits a switch, its barrier's colour for Mire's barriers two
 * keys open whatever the state (alternative_crystal_rule).
 */
export function crystalsThrough(exit: string, s: Crystal): readonly Crystal[] {
  const crystal = DOOR_NAMED.get(exit)?.crystal;
  if (crystal === undefined) return [s];
  if (crystal === "either") return CRYSTALS;
  if (crystal === s || ALTERNATIVE_CRYSTAL_DOORS.has(exit)) return [crystal];
  return [];
}

/** Each dungeon region's states some path can bring it in, rules aside. */
export function crystalStates(
  exits: readonly CrystalExit[],
): ReadonlyMap<string, ReadonlySet<Crystal>> {
  const out = new Map<string, CrystalExit[]>();
  for (const exit of exits)
    out.set(exit.from, [...(out.get(exit.from) ?? []), exit]);
  const states = new Map<string, Set<Crystal>>();
  const queue: [string, Crystal][] = [];
  const reach = (region: string, s: Crystal) => {
    const held = states.get(region) ?? new Set<Crystal>();
    if (held.has(s)) return;
    held.add(s);
    states.set(region, held);
    queue.push([region, s]);
  };
  // From outside a dungeon, orange (BaseClasses.py:686-690)
  for (const exit of exits)
    if (
      regionNamed(exit.from).type !== "dungeon" &&
      regionNamed(exit.to).type === "dungeon"
    )
      reach(exit.to, "orange");
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const [region, s] = next;
    for (const exit of out.get(region) ?? [])
      if (regionNamed(exit.to).type === "dungeon")
        for (const t of crystalsThrough(exit.name, s)) reach(exit.to, t);
  }
  return states;
}

/** Where a region's states sit in the engine's graph. */
export interface CrystalNodes {
  /** The states a region holds: none for a region out of a dungeon. */
  statesOf(region: DrRegion): readonly Crystal[];
  /** The node of a region in a state, or the region's own. */
  nodeOf(region: DrRegion, s: Crystal | undefined): string;
  /** Whether a region is split in two copies. */
  isSplit(region: DrRegion): boolean;
}

export function crystalNodes(
  states: ReadonlyMap<string, ReadonlySet<Crystal>>,
): CrystalNodes {
  const statesOf = (region: DrRegion): readonly Crystal[] => {
    if (region.type !== "dungeon") return [];
    const held = states.get(region.name);
    // A region no path enters: one node, as if orange
    if (held === undefined || held.size === 0) return ["orange"];
    return CRYSTALS.filter((s) => held.has(s));
  };
  const isSplit = (region: DrRegion) => statesOf(region).length === 2;
  return {
    isSplit,
    nodeOf: (region, s) =>
      s !== undefined && isSplit(region) ? `${region.id}__${s}` : region.id,
    statesOf,
  };
}

/**
 * A rule read in a region's state: its own state's read
 * (`reachedBlue_<id>` in blue) holds there; any other stays a fact.
 */
export function inState(req: string, region: DrRegion, s: Crystal): string {
  const own = s === "blue" ? "reachedBlue" : "reachedOrange";
  return req.replace(new RegExp(`\\b${own}_${region.id}\\b`, "g"), "true");
}

/** The crystal reads a rule makes: `reachedBlue_<id>`, `reachedOrange_<id>`. */
export const CRYSTAL_READ = /\breached(Blue|Orange)_(\w+)/g;

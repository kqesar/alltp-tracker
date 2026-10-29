// DR's key counters (KeyDoorShuffle.py): each set of key doors a player may
// have opened in a dungeon, with what the walk reaches behind them
// (create_key_counters, :1672-1721; create_key_counter, :1773-1799), and
// the lookups the analysis makes over them (find_counter, find_max_counter,
// can_open_door_by_counter, :1752-1900). A counter's id is DR's: the big
// key's bit, then a bit for each door of the flattened proposal.
import { DR_DUNGEONS } from "../data";
import { KEY_DROPS } from "../keys";
import {
  DEFAULT_SMALL_KEY_DOORS,
  DUNGEON_EVENTS,
  type KDoor,
  type KeyWorld,
  type KLocation,
  type KRegion,
} from "./dungeon";
import {
  ExplorationState,
  type ExplorePredicate,
  expandKeyState,
  openADoor,
} from "./exploration";

/** A key counter (KeyCounter, KeyDoorShuffle.py:213-230). */
export interface KeyCounter {
  readonly freeLocations: ReadonlySet<KLocation>;
  readonly keyOnlyLocations: ReadonlySet<KLocation>;
  readonly otherLocations: ReadonlySet<KLocation>;
  readonly importantLocations: ReadonlySet<KLocation>;
  readonly importantLocation: boolean;
  readonly childDoors: ReadonlySet<KDoor>;
  readonly openDoors: ReadonlySet<KDoor>;
  readonly usedKeys: number;
  readonly bigKeyOpened: boolean;
}

/** A dungeon's key layout (KeyLayout, KeyDoorShuffle.py:12-34). */
export interface KeyLayout {
  readonly world: KeyWorld;
  readonly dungeon: string;
  /** The dungeon's regions (the master sector's). */
  readonly regions: readonly KRegion[];
  readonly starts: readonly KRegion[];
  /** The key doors: a door, or a pair the same key opens. */
  readonly proposal: readonly (KDoor | readonly [KDoor, KDoor])[];
  readonly flatProposal: readonly KDoor[];
  readonly proposalSet: ReadonlySet<KDoor>;
  /** calc_max_chests: the keys the chests hold. */
  readonly maxChests: number;
  /** count_key_drops: the forced keys. */
  readonly maxDrops: number;
  /** check_bk_special: a forced big key lies inside. */
  readonly bigKeySpecial: boolean;
  /** get_special_big_key_doors (DungeonGenerator.py:774-781). */
  readonly specialBig: ReadonlySet<string>;
  readonly explorable: ExplorePredicate;
  readonly counters: Map<string, KeyCounter>;
  /** Every key door some counter waits at, and its other side. */
  readonly foundDoors: Set<KDoor>;
  /** The big key doors some counter waits at (key_logic.bk_doors). */
  readonly bigKeyDoors: Set<KDoor>;
}

/** imp_locations_factory and important_location (:1802-1814). */
function isImportant(layout: KeyLayout, loc: KLocation): boolean {
  return (
    loc.name.includes("- Prize") ||
    [
      "Agahnim 1",
      "Agahnim 2",
      "Attic Cracked Floor",
      "Suspicious Maiden",
    ].includes(loc.name) ||
    (layout.world.settings.mode === "standard" &&
      (loc.name === "Zelda Pickup" || loc.name === "Zelda Drop Off")) ||
    isForcedBigKey(loc)
  );
}

/** Location.forced_big_key (BaseClasses.py:2316-2322). */
const isForcedBigKey = (loc: KLocation): boolean =>
  loc.forced?.big === true && loc.forced.dungeon === loc.dungeon;

/** prize_or_event (DungeonGenerator.py:1098-1099). */
const isPrizeOrEvent = (loc: KLocation): boolean =>
  DUNGEON_EVENTS.has(loc.name) ||
  loc.name.includes("- Prize") ||
  loc.name === "Agahnim 1" ||
  loc.name === "Agahnim 2";

/**
 * blind_boss_unavail (DungeonGenerator.py:1106-1112): Blind, the vanilla
 * boss, waits for the maiden freed from the attic.
 */
const blindBossUnavailable = (
  loc: KLocation,
  found: readonly KLocation[],
): boolean =>
  loc.name === "Thieves' Town - Boss" &&
  (!found.some((x) => x.name === "Suspicious Maiden") ||
    !found.some((x) => x.name === "Attic Cracked Floor"));

/** count_free_locations (KeyDoorShuffle.py:1142-1148). */
const countFreeLocations = (found: readonly KLocation[]): number =>
  found.filter(
    (loc) =>
      !isPrizeOrEvent(loc) &&
      loc.forced === null &&
      !blindBossUnavailable(loc, found),
  ).length;

/** count_locations_exclude_big_chest (DungeonGenerator.py:1088-1095). */
const countExcludeBigChest = (found: readonly KLocation[]): number =>
  found.filter(
    (loc) =>
      !loc.name.includes("- Big Chest") &&
      loc.forced === null &&
      !isPrizeOrEvent(loc) &&
      !blindBossUnavailable(loc, found),
  ).length;

/** count_unique_sm_doors (KeyDoorShuffle.py:1053-1058). */
export function countUniqueSmallDoors(doors: Iterable<KDoor>): number {
  const unique = new Set<KDoor>();
  for (const d of doors)
    if (
      !unique.has(d) &&
      (d.dest === null || !unique.has(d.dest) || d.type === "SpiralStairs") &&
      !d.bigKey
    )
      unique.add(d);
  return unique.size;
}

/** counter_id (KeyDoorShuffle.py:1900-1906), prize relevance aside. */
export function counterId(
  opened: ReadonlySet<KDoor>,
  bigKey: boolean,
  layout: KeyLayout,
): string {
  return (
    (bigKey ? "1" : "0") +
    layout.flatProposal.map((d) => (opened.has(d) ? "1" : "0")).join("")
  );
}

/** cid (KeyDoorShuffle.py:1909-1911). */
export const cid = (counter: KeyCounter, layout: KeyLayout): string =>
  counterId(counter.openDoors, counter.bigKeyOpened, layout);

/** The forced small keys of the layout's dungeon a list holds. */
const isForcedSmall = (loc: KLocation, dungeon: string): boolean =>
  loc.forced !== null && !loc.forced.big && loc.forced.dungeon === dungeon;

/** create_key_counter (KeyDoorShuffle.py:1773-1799). */
function createKeyCounter(
  state: ExplorationState,
  layout: KeyLayout,
): KeyCounter {
  const free = new Set<KLocation>();
  const keyOnly = new Set<KLocation>();
  const other = new Set<KLocation>();
  const important = new Set<KLocation>();
  for (const loc of state.found) {
    if (isImportant(layout, loc)) {
      other.add(loc);
      important.add(loc);
    } else if (isForcedSmall(loc, layout.dungeon)) keyOnly.add(loc);
    else if (loc.forced?.big === true && loc.forced.dungeon === layout.dungeon)
      other.add(loc);
    else if (!DUNGEON_EVENTS.has(loc.name)) free.add(loc);
    else other.add(loc);
  }
  return {
    bigKeyOpened: state.bigKeyOpened,
    childDoors: new Set(
      [...state.smallDoors, ...state.bigDoors].map((d) => d.door),
    ),
    freeLocations: free,
    importantLocation: important.size > 0,
    importantLocations: important,
    keyOnlyLocations: keyOnly,
    openDoors: new Set(state.opened),
    otherLocations: other,
    usedKeys: countUniqueSmallDoors(state.opened),
  };
}

/** cnt_avail_small_locations (KeyDoorShuffle.py:1636-1644). */
function availableSmallLocations(
  free: number,
  keyOnly: number,
  state: ExplorationState,
  layout: KeyLayout,
): number {
  const { keyShuffle, mode } = layout.world.settings;
  const std = mode === "standard" && layout.dungeon === "Hyrule Castle";
  if (keyShuffle === "none" || std) {
    const bkAdj = state.bigKeyOpened && !state.bigKeySpecial ? 1 : 0;
    const stdAdj = std && keyShuffle !== "none" ? 1 : 0;
    const chests = Math.min(
      free + stdAdj - bkAdj,
      state.keyLocations - keyOnly,
    );
    // used_smalls is never raised on the counters' walk
    return Math.max(0, chests + keyOnly);
  }
  return state.keyLocations;
}

/** can_open_door (KeyDoorShuffle.py:1734-1749). */
function canOpenDoor(
  door: KDoor,
  state: ExplorationState,
  layout: KeyLayout,
): boolean {
  const ttl = state.bigKeyOpened
    ? countFreeLocations(state.found)
    : countExcludeBigChest(state.found);
  if (door.smallKey) {
    const keyOnly = state.found.filter(
      (l) => l.forced !== null && !l.forced.big,
    ).length;
    return availableSmallLocations(ttl, keyOnly, state, layout) > 0;
  }
  if (door.bigKey) {
    // cnt_avail_big_locations (:1658-1661), used_locations never raised
    const big = layout.world.settings.bigKeyShuffle
      ? state.bigKeySpecial
        ? 0
        : 1
      : state.bigKeySpecial
        ? 0
        : Math.max(0, ttl);
    return !state.bigKeyOpened && (big > 0 || state.foundForcedBigKey());
  }
  return true;
}

/** cnt_avail_small_locations_by_ctr (KeyDoorShuffle.py:1647-1655). */
function availableSmallByCounter(
  free: number,
  counter: KeyCounter,
  layout: KeyLayout,
): number {
  const { keyShuffle, mode } = layout.world.settings;
  const std = mode === "standard" && layout.dungeon === "Hyrule Castle";
  const keyOnly = counter.keyOnlyLocations.size;
  if (keyShuffle === "none" || std) {
    const bkAdj = counter.bigKeyOpened && !layout.bigKeySpecial ? 1 : 0;
    const stdAdj = std && keyShuffle !== "none" ? 1 : 0;
    const chests = Math.min(free + stdAdj - bkAdj, layout.maxChests);
    return Math.max(0, chests + keyOnly - counter.usedKeys);
  }
  return layout.maxChests + keyOnly - counter.usedKeys;
}

/** can_open_door_by_counter (KeyDoorShuffle.py:1752-1770). */
export function canOpenDoorByCounter(
  door: KDoor,
  counter: KeyCounter,
  layout: KeyLayout,
): boolean {
  const ttl = counter.bigKeyOpened
    ? counter.freeLocations.size
    : [...counter.freeLocations].filter((l) => !l.name.includes("- Big Chest"))
        .length;
  if (door.smallKey) return availableSmallByCounter(ttl, counter, layout) > 0;
  if (door.bigKey) {
    if (counter.bigKeyOpened) return false;
    if (layout.bigKeySpecial)
      return [...counter.otherLocations].some(isForcedBigKey);
    // cnt_avail_big_locations_by_ctr (:1664-1669)
    if (layout.world.settings.bigKeyShuffle) return true;
    const used = Math.max(0, counter.usedKeys - counter.keyOnlyLocations.size);
    return Math.max(0, ttl - used) > 0;
  }
  return true;
}

/**
 * create_key_counters (KeyDoorShuffle.py:1672-1721): from the start
 * regions, the walk opens each key door it waits at that some key may
 * open, breadth first, a counter for each new set of doors opened.
 */
function createKeyCounters(layout: KeyLayout): void {
  const state = new ExplorationState();
  // vanilla doors: the proposal's entries less the forced keys
  state.keyLocations = layout.proposal.length - layout.maxDrops;
  state.bigKeySpecial = layout.bigKeySpecial;
  for (const region of layout.starts) {
    state.visitRegion(region);
    state.addAllDoorsCheckKeys(region, layout.proposalSet);
  }
  expandKeyState(state, layout.proposalSet, layout.explorable);
  const stateId = (s: ExplorationState) =>
    counterId(new Set(s.opened), s.bigKeyOpened, layout);
  const first = createKeyCounter(state, layout);
  layout.counters.set(stateId(state), first);
  const queue: [KeyCounter, ExplorationState][] = [[first, state]];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const [counter, parent] = next;
    for (const door of counter.childDoors) {
      layout.foundDoors.add(door);
      if (
        door.dest !== null &&
        layout.proposalSet.has(door.dest) &&
        door.type !== "SpiralStairs"
      )
        layout.foundDoors.add(door.dest);
      const child = parent.copy();
      if (door.bigKey || layout.specialBig.has(door.name))
        layout.bigKeyDoors.add(door);
      if (!canOpenDoor(door, child, layout)) continue;
      openADoor(door, child, layout.proposalSet, layout.specialBig);
      expandKeyState(child, layout.proposalSet, layout.explorable);
      const code = stateId(child);
      if (!layout.counters.has(code)) {
        const made = createKeyCounter(child, layout);
        layout.counters.set(code, made);
        queue.push([made, child]);
      }
    }
  }
}

/**
 * find_counter_hint (KeyDoorShuffle.py:1880-1888): the counter of these
 * doors, else of these doors and the big key.
 */
export function findCounterHint(
  opened: ReadonlySet<KDoor>,
  bigKey: boolean,
  layout: KeyLayout,
): KeyCounter | undefined {
  const found = layout.counters.get(counterId(opened, bigKey, layout));
  if (found !== undefined || bigKey) return found;
  return layout.counters.get(counterId(opened, true, layout));
}

/**
 * find_counter (KeyDoorShuffle.py:1861-1877): as find_counter_hint, else
 * with each door's other side opened too; none is DR's error.
 */
export function findCounter(
  opened: ReadonlySet<KDoor>,
  bigKey: boolean,
  layout: KeyLayout,
): KeyCounter {
  const found = findCounterHint(opened, bigKey, layout);
  if (found !== undefined) return found;
  const more = new Set<KDoor>();
  for (const door of opened) {
    more.add(door);
    if (door.dest !== null && !opened.has(door.dest)) more.add(door.dest);
  }
  if (more.size > opened.size) {
    const again = findCounterHint(more, bigKey, layout);
    if (again !== undefined) return again;
  }
  throw new RangeError(
    `Unable to find door permutation in ${layout.dungeon}: ${counterId(opened, bigKey, layout)}`,
  );
}

/** find_max_counter (KeyDoorShuffle.py:1891-1897). */
export function findMaxCounter(layout: KeyLayout): KeyCounter {
  const max = findCounterHint(layout.foundDoors, false, layout);
  if (max === undefined) throw new RangeError("Max Counter is none");
  if (max.childDoors.size === 0) return max;
  const big = findCounterHint(layout.foundDoors, true, layout);
  if (big === undefined) throw new RangeError("Max Counter is none");
  return big;
}

/**
 * A dungeon's key layout and its counters (build_key_layout,
 * KeyDoorShuffle.py:233-241, then create_key_counters), on the vanilla
 * small key doors.
 */
export function keyLayout(world: KeyWorld, dungeon: string): KeyLayout {
  const regions = [...world.regions.values()].filter(
    (r) => r.dungeon === dungeon,
  );
  const doorNamed = (name: string) => {
    const door = world.doors.get(name);
    if (door === undefined) throw new RangeError(`No door ${name}`);
    return door;
  };
  const proposal = (DEFAULT_SMALL_KEY_DOORS[dungeon] ?? []).map((entry) =>
    typeof entry === "string"
      ? doorNamed(entry)
      : ([doorNamed(entry[0]), doorNamed(entry[1])] as const),
  );
  const flatProposal = proposal.flatMap((entry) =>
    Array.isArray(entry) ? [...entry] : [entry as KDoor],
  );
  const locations = regions.flatMap((r) => r.locations);
  const maxDrops = locations.filter((l) => isForcedSmall(l, dungeon)).length;
  const { keyShuffle, mode } = world.settings;
  // calc_max_chests: len(dungeon.small_keys), the chests' and each key
  // drop's the run shuffles (adjust_locations), none for universal keys
  const chestKeys =
    keyShuffle === "universal"
      ? 0
      : (DR_DUNGEONS.find((d) => d.name === dungeon)?.smallKeys.length ?? 0) +
        locations.filter(
          (l) =>
            l.forced === null &&
            KEY_DROP_SMALL.has(l.name) &&
            l.dungeon === dungeon,
        ).length;
  const explorable: ExplorePredicate = (region) =>
    (region.isDungeon && region.dungeon === dungeon) ||
    world.inaccessible.has(region.name) ||
    (region.name === "Hyrule Castle Ledge" && mode === "standard");
  const layout: KeyLayout = {
    bigKeyDoors: new Set(),
    bigKeySpecial: locations.some(isForcedBigKey),
    counters: new Map(),
    dungeon,
    explorable,
    flatProposal,
    foundDoors: new Set(),
    maxChests: chestKeys,
    maxDrops,
    proposal,
    proposalSet: new Set(flatProposal),
    regions,
    specialBig: new Set([
      "Hyrule Dungeon Cellblock Door",
      "Thieves Blind's Cell Door",
      ...(mode === "standard" ? ["Hyrule Castle Throne Room Tapestry"] : []),
    ]),
    starts: world.starts.get(dungeon) ?? [],
    world,
  };
  createKeyCounters(layout);
  return layout;
}

/** The small key drops' locations (key_drop_data). */
const KEY_DROP_SMALL: ReadonlySet<string> = new Set(
  KEY_DROPS.filter((d) => !d.big).map((d) => d.location),
);

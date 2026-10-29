// DR's walk through a dungeon for its key analysis: ExplorationState
// (DungeonGenerator.py:784-1089) on the paths KeyDoorShuffle.py takes
// (key_checks, add_all_doors_check_keys, open_a_door, expand_key_state,
// KeyDoorShuffle.py:1016-1041, :1179-1186). It follows doors, never item
// rules: a small key door waits in `smallDoors` until opened, a big key
// door in `bigDoors`, a door an event opens in `eventDoors`; the crystal
// state rides each door as DR's does. Lists keep DR's order, which its
// best-counter choice depends on.
import { specialBigKeyDoors } from "../keys";
import {
  type Crystal,
  DUNGEON_EVENTS,
  type KDoor,
  type KLocation,
  type KRegion,
} from "./dungeon";

/** A door waiting to be walked, in the state it is reached in (ExplorableDoor). */
export interface ExplorableDoor {
  readonly door: KDoor;
  readonly crystal: Crystal;
}

/** flooded_keys (BaseClasses.py:2982-2985) and its reverse (Regions.py:1338). */
const FLOODED_KEYS: Readonly<Record<string, string>> = {
  "Trench 1 Switch": "Swamp Palace - Trench 1 Pot Key",
  "Trench 2 Switch": "Swamp Palace - Trench 2 Pot Key",
};
const FLOODED_KEYS_REVERSE: Readonly<Record<string, string>> = {
  "Swamp Palace - Trench 1 Pot Key": "Trench 1 Switch",
  "Swamp Palace - Trench 2 Pot Key": "Trench 2 Switch",
};

/**
 * The doors add_all_doors_check_keys holds for the big key: the module's
 * special_big_key_doors (DungeonGenerator.py:774), Open's whatever the mode.
 */
const SPECIAL_BIG_KEY_DOORS = specialBigKeyDoors("open");

/** valid_region_to_explore (DungeonGenerator.py:1171-1176). */
export type ExplorePredicate = (region: KRegion) => boolean;

export class ExplorationState {
  avail: ExplorableDoor[] = [];
  eventDoors: ExplorableDoor[] = [];
  smallDoors: ExplorableDoor[] = [];
  bigDoors: ExplorableDoor[] = [];
  visitedOrange = new Set<KRegion>();
  visitedBlue = new Set<KRegion>();
  events = new Set<string>();
  crystal: Crystal = "orange";
  opened: KDoor[] = [];
  bigKeyOpened = false;
  bigKeySpecial = false;
  found: KLocation[] = [];
  /** key_locations: the chest keys, and each forced key found. */
  keyLocations = 0;

  copy(): ExplorationState {
    const ret = new ExplorationState();
    ret.avail = [...this.avail];
    ret.eventDoors = [...this.eventDoors];
    ret.smallDoors = [...this.smallDoors];
    ret.bigDoors = [...this.bigDoors];
    ret.visitedOrange = new Set(this.visitedOrange);
    ret.visitedBlue = new Set(this.visitedBlue);
    ret.events = new Set(this.events);
    ret.crystal = this.crystal;
    ret.opened = [...this.opened];
    ret.bigKeyOpened = this.bigKeyOpened;
    ret.bigKeySpecial = this.bigKeySpecial;
    ret.found = [...this.found];
    ret.keyLocations = this.keyLocations;
    return ret;
  }

  /** next_avail_door: the last of the doors sorted big keys first. */
  nextAvailDoor(): ExplorableDoor {
    const rank = (d: ExplorableDoor) => (d.door.bigKey ? 1 : 2);
    this.avail.sort((a, b) => rank(a) - rank(b));
    const exp = this.avail.pop();
    if (exp === undefined) throw new RangeError("No door to walk");
    this.crystal = exp.crystal;
    return exp;
  }

  /** visit_region with key_checks (DungeonGenerator.py:874-905). */
  visitRegion(region: KRegion): void {
    if (!region.isDungeon) this.crystal = "orange";
    if (this.crystal !== "blue") this.visitedOrange.add(region);
    if (this.crystal !== "orange") this.visitedBlue.add(region);
    if (!region.isDungeon) return;
    for (const location of region.locations) {
      if (!this.found.includes(location)) {
        if (location.forced !== null && !location.forced.big)
          this.keyLocations++;
        this.found.push(location);
      }
      if (
        DUNGEON_EVENTS.has(location.name) &&
        !this.events.has(location.name) &&
        this.floodedKeyCheck(location.name)
      )
        this.performEvent(location.name);
      const flooded = FLOODED_KEYS_REVERSE[location.name];
      if (flooded !== undefined && this.locationFound(flooded))
        this.performEvent(flooded);
    }
  }

  private floodedKeyCheck(name: string): boolean {
    const key = FLOODED_KEYS[name];
    return key === undefined || this.locationFound(key);
  }

  private locationFound(name: string): boolean {
    return this.found.some((l) => l.name === name);
  }

  /** perform_event: the doors the event opens become walkable. */
  private performEvent(name: string): void {
    this.events.add(name);
    for (const exp of [...this.eventDoors])
      if (exp.door.reqEvent === name) {
        this.avail.push(exp);
        this.eventDoors.splice(this.eventDoors.indexOf(exp), 1);
      }
  }

  /** can_traverse (DungeonGenerator.py:1036-1041). */
  canTraverse(door: KDoor): boolean {
    if (door.blocked) return false;
    if (door.crystal !== null && door.crystal !== "either")
      return this.crystal === "either" || door.crystal === this.crystal;
    return true;
  }

  /** visited: in the walk's current state (DungeonGenerator.py:1017-1024). */
  visited(region: KRegion): boolean {
    if (this.crystal === "either")
      return this.visitedBlue.has(region) && this.visitedOrange.has(region);
    return this.crystal === "orange"
      ? this.visitedOrange.has(region)
      : this.visitedBlue.has(region);
  }

  /** in_door_list: the door, in the walk's current state. */
  private inList(door: KDoor, list: readonly ExplorableDoor[]): boolean {
    return list.some((d) => d.door === door && d.crystal === this.crystal);
  }

  /** append_door_to_list: a barrier or switch door carries its own state. */
  private append(door: KDoor, list: ExplorableDoor[]): void {
    list.push({ crystal: door.crystal ?? this.crystal, door });
  }

  /** add_all_doors_check_keys (DungeonGenerator.py:984-999). */
  addAllDoorsCheckKeys(region: KRegion, proposal: ReadonlySet<KDoor>): void {
    for (const exit of region.doors) {
      if (!this.canTraverse(exit)) continue;
      const door = exit.controller ?? exit;
      if (proposal.has(door) && !this.opened.includes(door)) {
        if (!this.inList(door, this.smallDoors))
          this.append(door, this.smallDoors);
      } else if (
        (door.bigKey || SPECIAL_BIG_KEY_DOORS.has(door.name)) &&
        !this.bigKeyOpened
      ) {
        if (!this.inList(door, this.bigDoors)) this.append(door, this.bigDoors);
      } else if (door.reqEvent !== null && !this.events.has(door.reqEvent)) {
        if (!this.inList(door, this.eventDoors))
          this.append(door, this.eventDoors);
      } else if (!this.inList(door, this.avail)) this.append(door, this.avail);
    }
  }

  /** found_forced_bk. */
  foundForcedBigKey(): boolean {
    return this.found.some(
      (l) => l.forced?.big === true && l.forced.dungeon === l.dungeon,
    );
  }
}

/**
 * expand_key_state (KeyDoorShuffle.py:1179-1186): walk every door that is
 * free to walk, until none is left.
 */
export function expandKeyState(
  state: ExplorationState,
  proposal: ReadonlySet<KDoor>,
  explorable: ExplorePredicate,
): void {
  while (state.avail.length > 0) {
    const { door } = state.nextAvailDoor();
    const region = door.to;
    // validate (DungeonGenerator.py:1046-1048)
    if (
      region !== null &&
      state.canTraverse(door) &&
      !state.visited(region) &&
      explorable(region)
    ) {
      state.visitRegion(region);
      state.addAllDoorsCheckKeys(region, proposal);
    }
  }
}

/**
 * open_a_door (KeyDoorShuffle.py:1016-1041), the special big key doors
 * get_special_big_key_doors names for the mode: a big key door opens every
 * big key door waiting; a small key door opens itself and, but across a
 * spiral stair, its other side.
 */
export function openADoor(
  door: KDoor,
  state: ExplorationState,
  proposal: ReadonlySet<KDoor>,
  specialBig: ReadonlySet<string>,
): void {
  if (door.bigKey || specialBig.has(door.name)) {
    state.bigKeyOpened = true;
    state.avail.push(...state.bigDoors);
    state.opened.push(...new Set(state.bigDoors.map((d) => d.door)));
    state.bigDoors = [];
    return;
  }
  const release = (d: KDoor) => {
    state.avail.push(...state.smallDoors.filter((x) => x.door === d));
    state.smallDoors = state.smallDoors.filter((x) => x.door !== d);
  };
  state.opened.push(door);
  release(door);
  const dest = door.dest;
  if (dest !== null && proposal.has(dest) && door.type !== "SpiralStairs") {
    state.opened.push(dest);
    release(dest);
  }
}

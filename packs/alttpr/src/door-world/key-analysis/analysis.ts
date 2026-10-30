// DR's key analysis of a dungeon (analyze_dungeon, KeyDoorShuffle.py:
// 267-351) and vanilla_key_logic's adjustments (DoorShuffle.py:280-313):
// for each key door some counter waits at, the counter that has spent the
// most keys elsewhere and still gains from it (find_best_counter, :728-738)
// gives its rule (create_rule, :846-862; create_worst_case_rule, :865-867),
// the alternatives a placement may grant (check_for_self_lock_key, :870-878;
// bk_restricted_rules, :975-996), then the swap of a big key alternative
// that asks more (:344-350). The fill's own constraints
// (create_exhaustive_placement_rules, sm_restricted, the placement rules)
// are left out: they decide where DR puts keys, never what a door asks.

import { ALTERNATIVE_CRYSTAL_DOORS } from "../keys";
import {
  canOpenDoorByCounter,
  cid,
  findCounter,
  findMaxCounter,
  isForcedBigKey,
  isImportant,
  type KeyCounter,
  type KeyLayout,
  keyLayout,
} from "./counters";
import {
  DR_DUNGEON_ORDER,
  type KDoor,
  type KeyAnalysisSettings,
  type KLocation,
  keyWorld,
} from "./dungeon";

/** A door's key rule (DoorRules, KeyDoorShuffle.py:90-103). */
export interface DoorRule {
  /** small_key_num: the number partial logic caps the worst case at. */
  smallKeyNum: number;
  readonly isValid: boolean;
  /** alternate_small_key, with the big key in `alternateBigKeyLoc`. */
  alternateSmallKey: number | null;
  alternateBigKeyLoc: Set<KLocation>;
  /** allow_small: the one location behind it may hold its own key. */
  allowSmall: boolean;
  smallLocation: KLocation | null;
  /** new_rules: KeyRuleType.WorstCase. */
  worstCase?: number;
  /** new_rules: KeyRuleType.AllowSmall. */
  allowSmallNum?: number;
  /** new_rules: (KeyRuleType.Lock, the big key). */
  lockNum?: number;
  /** new_rules: KeyRuleType.CrystalAlternative. */
  crystalAlternative?: number;
}

/** A dungeon's key logic (KeyLogic, KeyDoorShuffle.py:46-64), as the rules read it. */
export interface KeyLogic {
  readonly dungeon: string;
  readonly layout: KeyLayout;
  readonly doorRules: Map<string, DoorRule>;
  /** bk_restricted, as analyze_dungeon and find_bk_locked_sections fill it. */
  readonly bkRestricted: Set<KLocation>;
  /** bk_doors: the big key doors some counter waits at. */
  readonly bkDoors: ReadonlySet<KDoor>;
  /** bk_chests: the big chests and the big key's locked spots. */
  readonly bkChests: Set<KLocation>;
  /**
   * chest_counting (KeyDoorShuffle.py:66 at 1.5.8): its doors count the
   * keys of the chests alone, the drops' aside (has_sm_key_strict), as the
   * static key logic sets it (static.ts).
   */
  readonly chestCounting?: boolean;
}

const difference = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> =>
  new Set([...a].filter((x) => !b.has(x)));
const subset = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean =>
  [...a].every((x) => b.has(x));
const isBigChest = (loc: KLocation) => loc.name.includes("- Big Chest");
/** A counter as DR builds one by hand (create_odd_key_counter and kin). */
interface PartialCounter {
  freeLocations: ReadonlySet<KLocation>;
  keyOnlyLocations: ReadonlySet<KLocation>;
  otherLocations: ReadonlySet<KLocation>;
  importantLocations: ReadonlySet<KLocation>;
  childDoors: ReadonlySet<KDoor>;
  openDoors: ReadonlySet<KDoor>;
  importantLocation: boolean;
}

/** available_chest_small_keys (KeyDoorShuffle.py:943-951). */
function availableChestSmallKeys(
  counter: KeyCounter,
  layout: KeyLayout,
): number {
  if (layout.world.settings.keyShuffle !== "none") return layout.maxChests;
  const count = [...counter.freeLocations].filter(
    (loc) => counter.bigKeyOpened || !isBigChest(loc),
  ).length;
  return Math.min(count, layout.maxChests);
}

/** find_next_counter (KeyDoorShuffle.py:817-827). */
function findNextCounter(
  door: KDoor,
  old: KeyCounter,
  layout: KeyLayout,
): KeyCounter {
  const entry = layout.proposal.find((item) =>
    Array.isArray(item) ? item.includes(door) : item === door,
  );
  const doors =
    entry === undefined
      ? []
      : Array.isArray(entry)
        ? [...entry]
        : [entry as KDoor];
  return findCounter(
    new Set([...old.openDoors, ...doors]),
    old.bigKeyOpened || door.bigKey,
    layout,
  );
}

/** create_odd_key_counter (KeyDoorShuffle.py:1917-1931): what a door adds. */
function createOddKeyCounter(
  door: KDoor,
  parent: KeyCounter,
  layout: KeyLayout,
): PartialCounter {
  const next = findNextCounter(door, parent, layout);
  const other = difference(next.otherLocations, parent.otherLocations);
  return {
    childDoors: new Set(
      [...next.childDoors].filter(
        (d) =>
          !parent.childDoors.has(d) &&
          (d.type === "SpiralStairs" ||
            d.dest === null ||
            !parent.childDoors.has(d.dest)),
      ),
    ),
    freeLocations: difference(next.freeLocations, parent.freeLocations),
    importantLocation: [...other].some((loc) => isImportant(layout, loc)),
    importantLocations: difference(
      next.importantLocations,
      parent.importantLocations,
    ),
    keyOnlyLocations: difference(
      next.keyOnlyLocations,
      parent.keyOnlyLocations,
    ),
    openDoors: new Set(),
    otherLocations: other,
  };
}

/** empty_counter (KeyDoorShuffle.py:627-630). */
const emptyCounter = (c: PartialCounter): boolean =>
  c.keyOnlyLocations.size === 0 &&
  c.freeLocations.size === 0 &&
  c.childDoors.size === 0 &&
  !c.importantLocation;

/** unique_child_door (KeyDoorShuffle.py:678-685). */
function uniqueChildDoor(child: KDoor, counter: KeyCounter): boolean {
  const known = (d: KDoor | null) =>
    d !== null && (counter.childDoors.has(d) || counter.openDoors.has(d));
  if (known(child) || known(child.dest)) return false;
  return !(child.bigKey && counter.bigKeyOpened);
}

/** relative_empty_counter (KeyDoorShuffle.py:633-650): nothing new in it. */
function relativeEmptyCounter(
  odd: PartialCounter,
  counter: KeyCounter,
): boolean {
  return (
    subset(odd.keyOnlyLocations, counter.keyOnlyLocations) &&
    subset(odd.freeLocations, counter.freeLocations) &&
    subset(odd.otherLocations, counter.otherLocations) &&
    subset(odd.importantLocations, counter.importantLocations) &&
    ![...odd.childDoors].some((child) => uniqueChildDoor(child, counter))
  );
}

const countLocations = (c: KeyCounter): number =>
  c.freeLocations.size +
  c.keyOnlyLocations.size +
  c.otherLocations.size +
  c.importantLocations.size;

/**
 * find_best_counter (KeyDoorShuffle.py:725-735): of every counter without
 * the door open (without the big key, if asked) that still gains from it,
 * the one that spent the most keys, then reaches the most; the first of
 * equals in the counters' order.
 */
function findBestCounter(
  door: KDoor,
  layout: KeyLayout,
  odd: PartialCounter,
  skipBigKey: boolean,
  empty: boolean,
): KeyCounter {
  let best: KeyCounter | undefined;
  let used = 0;
  let locations = 0;
  for (const counter of layout.counters.values()) {
    if (counter.openDoors.has(door)) continue;
    if (
      best === undefined ||
      counter.usedKeys > used ||
      (counter.usedKeys === used && countLocations(counter) > locations)
    )
      if (!skipBigKey || !counter.bigKeyOpened)
        if (empty || !relativeEmptyCounter(odd, counter)) {
          best = counter;
          used = counter.usedKeys;
          locations = countLocations(counter);
        }
  }
  if (best === undefined)
    throw new RangeError(`No best counter for ${door.name}`);
  return best;
}

/** create_rule (KeyDoorShuffle.py:843-859). */
function createRule(
  counter: KeyCounter,
  prev: KeyCounter,
  layout: KeyLayout,
): DoorRule {
  const chestKeys = availableChestSmallKeys(counter, layout);
  const keyGain = counter.keyOnlyLocations.size - prev.keyOnlyLocations.size;
  const required = counter.usedKeys + 1;
  const adjusted = Math.min(chestKeys, required);
  const neededChests = required - counter.keyOnlyLocations.size;
  const unneeded = Math.min(keyGain, Math.max(0, adjusted - neededChests));
  return {
    allowSmall: false,
    alternateBigKeyLoc: new Set(),
    alternateSmallKey: null,
    isValid: neededChests <= chestKeys,
    smallKeyNum: required - unneeded,
    smallLocation: null,
  };
}

/**
 * open_all_counter (KeyDoorShuffle.py:896-915): every door a key may open,
 * but `door` and its other side, opened until none is left.
 */
function openAllCounter(
  parent: KeyCounter,
  layout: KeyLayout,
  door: KDoor,
): KeyCounter {
  let counter = parent;
  let proposed = new Set(parent.openDoors);
  for (;;) {
    const open = [...counter.childDoors].filter(
      (child) =>
        child !== door &&
        child !== door.dest &&
        canOpenDoorByCounter(child, counter, layout),
    );
    if (open.length === 0) return counter;
    proposed = new Set([...proposed, ...open]);
    counter = findCounter(
      proposed,
      counter.bigKeyOpened || open.some((d) => d.bigKey),
      layout,
    );
  }
}

/**
 * open_some_counter (KeyDoorShuffle.py:918-936): every small key door but
 * the ignored ones, opened until none is left.
 */
function openSomeCounter(
  parent: KeyCounter,
  layout: KeyLayout,
  ignored: ReadonlySet<KDoor | null>,
): KeyCounter {
  let counter = parent;
  let proposed = new Set(parent.openDoors);
  for (;;) {
    const open = [...counter.childDoors].filter(
      (child) => !ignored.has(child) && !child.bigKey,
    );
    if (open.length === 0) return counter;
    proposed = new Set([...proposed, ...open]);
    counter = findCounter(proposed, counter.bigKeyOpened, layout);
  }
}

/** find_inverted_counter (KeyDoorShuffle.py:878-893): what only `door` leads to. */
function findInvertedCounter(
  door: KDoor,
  parent: KeyCounter,
  layout: KeyLayout,
): PartialCounter {
  const counter = openAllCounter(parent, layout, door);
  const max = findMaxCounter(layout);
  const other = difference(max.otherLocations, counter.otherLocations);
  return {
    childDoors: new Set(),
    freeLocations: difference(max.freeLocations, counter.freeLocations),
    importantLocation: [...other].some((loc) => isImportant(layout, loc)),
    importantLocations: new Set(),
    keyOnlyLocations: difference(
      max.keyOnlyLocations,
      counter.keyOnlyLocations,
    ),
    openDoors: difference(max.openDoors, counter.openDoors),
    otherLocations: other,
  };
}

/**
 * check_for_self_lock_key (KeyDoorShuffle.py:867-875): a door behind
 * which one location lies, nothing else, may hold its own key.
 */
function checkForSelfLockKey(
  rule: DoorRule,
  door: KDoor,
  parent: KeyCounter,
  layout: KeyLayout,
): void {
  if (layout.world.settings.accessibility === "locations") return;
  const counter = findInvertedCounter(door, parent, layout);
  // self_lock_possible (:939-940), then one free location exactly
  if (
    counter.freeLocations.size !== 1 ||
    counter.keyOnlyLocations.size !== 0 ||
    counter.importantLocation
  )
    return;
  rule.allowSmall = true;
  rule.smallLocation = [...counter.freeLocations][0] ?? null;
  rule.allowSmallNum = (rule.worstCase ?? 0) - 1;
}

/**
 * bk_restricted_rules (KeyDoorShuffle.py:972-993): fewer keys where the
 * big key lies behind the door and the door is reached without it.
 */
function bkRestrictedRules(
  rule: DoorRule,
  door: KDoor,
  odd: PartialCounter,
  empty: boolean,
  counter: KeyCounter,
  layout: KeyLayout,
): void {
  if (counter.bigKeyOpened) return;
  const best = findBestCounter(door, layout, odd, true, empty);
  const bkRule = createRule(best, counter, layout);
  if (bkRule.smallKeyNum >= rule.smallKeyNum) return;
  const doorOpen = findNextCounter(door, best, layout);
  const ignored = new Set<KDoor | null>(
    [...best.childDoors].filter((d) => doorOpen.childDoors.has(d)),
  );
  for (const d of [...ignored])
    if (d !== null && !ignored.has(d.dest)) ignored.add(d.dest);
  const post = openSomeCounter(doorOpen, layout, ignored);
  const unique = difference(post.freeLocations, best.freeLocations);
  if (unique.size === 0) return;
  rule.alternateSmallKey = bkRule.smallKeyNum;
  for (const loc of unique) rule.alternateBigKeyLoc.add(loc);
  if (!door.bigKey) rule.lockNum = best.usedKeys + 1;
}

/** exist_relevant_big_doors (KeyDoorShuffle.py:1086-1098). */
function existRelevantBigDoors(
  counter: KeyCounter,
  layout: KeyLayout,
): boolean {
  let big: KeyCounter;
  try {
    big = findCounter(counter.openDoors, true, layout);
  } catch {
    return false;
  }
  return (
    difference(big.freeLocations, counter.freeLocations).size > 0 ||
    difference(big.keyOnlyLocations, counter.keyOnlyLocations).size > 0 ||
    difference(big.childDoors, counter.childDoors).size > 0
  );
}

/** count_unique_small_doors (KeyDoorShuffle.py:1074-1083). */
function countUniqueSmallChildDoors(
  counter: KeyCounter,
  layout: KeyLayout,
): number {
  let count = 0;
  const counted = new Set<KDoor>();
  for (const door of counter.childDoors)
    if (layout.proposalSet.has(door) && !counted.has(door)) {
      count++;
      counted.add(door);
      if (door.type !== "SpiralStairs" && door.dest !== null)
        counted.add(door.dest);
    }
  return count;
}

/** find_bk_locked_sections (KeyDoorShuffle.py:597-624). */
function findBkLockedSections(
  logic: KeyLogic,
  allChests: Set<KLocation>,
): void {
  const { layout } = logic;
  const notRequired = new Set<KLocation>();
  let bigChestAllowsBigKey =
    layout.world.settings.accessibility !== "locations";
  for (const counter of layout.counters.values()) {
    for (const loc of counter.freeLocations) allChests.add(loc);
    if (counter.bigKeyOpened && counter.importantLocation)
      bigChestAllowsBigKey = false;
    if (!counter.bigKeyOpened)
      for (const loc of [
        ...counter.freeLocations,
        ...counter.keyOnlyLocations,
        ...counter.otherLocations,
      ])
        notRequired.add(loc);
  }
  if (!layout.bigKeySpecial)
    for (const loc of difference(allChests, notRequired))
      logic.bkRestricted.add(loc);
  if (!bigChestAllowsBigKey)
    for (const loc of allChests)
      if (loc.name.includes("Big Chest") || BIG_KEY_LOCKED.has(loc.name))
        logic.bkRestricted.add(loc);
}

/** find_big_key_locked_locations (KeyDoorShuffle.py:1172-1177). */
const BIG_KEY_LOCKED: ReadonlySet<string> = new Set([
  "Thieves' Town - Blind's Cell",
  "Hyrule Castle - Zelda's Chest",
]);

/** analyze_dungeon (KeyDoorShuffle.py:268-352), its door rules. */
export function analyzeDungeon(layout: KeyLayout): KeyLogic {
  const logic: KeyLogic = {
    bkChests: new Set(),
    bkDoors: layout.bigKeyDoors,
    bkRestricted: new Set(),
    doorRules: new Map(),
    dungeon: layout.dungeon,
    layout,
  };
  const allChests = new Set<KLocation>();
  findBkLockedSections(logic, allChests);
  for (const loc of allChests)
    if (loc.name.includes("Big Chest") || BIG_KEY_LOCKED.has(loc.name))
      logic.bkChests.add(loc);
  const { keyShuffle, mode } = layout.world.settings;
  if (keyShuffle === "universal" && mode !== "standard") return logic;

  let original = findCounter(new Set(), false, layout);
  if (layout.bigKeySpecial && [...original.otherLocations].some(isForcedBigKey))
    original = findCounter(new Set(), true, layout);
  let queue: [KDoor | null, KeyCounter][] = [[null, original]];
  const completed = new Set<KDoor>();
  const visited = new Set([cid(original, layout)]);
  while (queue.length > 0) {
    // queue_sorter (:582-586): a stable sort, big key doors last
    queue = [...queue].sort(
      ([a], [b]) => (a?.bigKey === true ? 1 : 0) - (b?.bigKey === true ? 1 : 0),
    );
    const [, counter] = queue.shift() as [KDoor | null, KeyCounter];
    const chestKeys = availableChestSmallKeys(counter, layout);
    const available =
      chestKeys + counter.keyOnlyLocations.size - counter.usedKeys;
    const possibleSmalls = countUniqueSmallChildDoors(counter, layout);
    const bigs =
      existRelevantBigDoors(counter, layout) ||
      [...counter.freeLocations].some(isBigChest);
    const nonBig = [...counter.freeLocations].filter(
      (l) => !isBigChest(l),
    ).length;
    const bigAvailable =
      counter.bigKeyOpened ||
      (layout.bigKeySpecial &&
        [...counter.otherLocations].some((l) => l.forced?.big === true));
    if (
      !bigAvailable &&
      chestKeys === nonBig &&
      chestKeys > 0 &&
      available <= possibleSmalls &&
      !bigs
    )
      for (const loc of counter.freeLocations)
        if (!isBigChest(loc)) logic.bkRestricted.add(loc);
    const children: [KDoor, PartialCounter, boolean][] = [];
    for (const child of counter.childDoors)
      if (canOpenDoorByCounter(child, counter, layout)) {
        const odd = createOddKeyCounter(child, counter, layout);
        children.push([child, odd, emptyCounter(odd)]);
      }
    for (const [child, odd, empty] of children) {
      if (layout.proposalSet.has(child) && !completed.has(child)) {
        const best = findBestCounter(child, layout, odd, false, empty);
        const rule = createRule(best, counter, layout);
        rule.worstCase = best.usedKeys + 1;
        checkForSelfLockKey(rule, child, best, layout);
        bkRestrictedRules(rule, child, odd, empty, counter, layout);
        logic.doorRules.set(child.name, rule);
      }
      completed.add(child);
      const next = findNextCounter(child, counter, layout);
      const id = cid(next, layout);
      if (!visited.has(id)) {
        queue.push([child, next]);
        visited.add(id);
      }
    }
  }
  // Flip a big key alternative that asks more (:340-346)
  for (const rule of logic.doorRules.values())
    if (
      rule.alternateSmallKey !== null &&
      rule.alternateSmallKey > rule.smallKeyNum
    ) {
      const max = findMaxCounter(layout);
      rule.alternateBigKeyLoc = difference(
        max.freeLocations,
        rule.alternateBigKeyLoc,
      );
      [rule.smallKeyNum, rule.alternateSmallKey] = [
        rule.alternateSmallKey,
        rule.smallKeyNum,
      ];
    }
  return logic;
}

/**
 * vanilla_key_logic (DoorShuffle.py:226-313): every dungeon's layout on
 * its vanilla key doors, analyzed, then the adjustments DR makes by hand.
 */
export function vanillaKeyLogic(
  settings: KeyAnalysisSettings,
): ReadonlyMap<string, KeyLogic> {
  const world = keyWorld(settings);
  const logics = new Map<string, KeyLogic>();
  // A partly noted world leaves out a dungeon it cannot start
  for (const dungeon of DR_DUNGEON_ORDER)
    if (settings.partial !== true || world.starts.has(dungeon))
      logics.set(dungeon, analyzeDungeon(keyLayout(world, dungeon)));
  if (settings.keyShuffle === "universal") return logics;
  const rule = (dungeon: string, door: string) => {
    const found = logics.get(dungeon)?.doorRules.get(door);
    if (found === undefined) throw new RangeError(`No rule for ${door}`);
    return found;
  };
  // The adjustments DR makes by hand, to the dungeons analyzed
  const has = (dungeon: string) => logics.has(dungeon);
  if (
    settings.mode !== "standard" &&
    settings.dropShuffleNone &&
    has("Hyrule Castle")
  )
    for (const door of [
      "Sewers Secret Room Key Door S",
      "Hyrule Dungeon Map Room Key Door S",
      "Sewers Dark Cross Key Door N",
    ]) {
      const hc = rule("Hyrule Castle", door);
      if (hc.worstCase === 3) {
        hc.worstCase = 2;
        hc.smallKeyNum = 2;
      }
    }
  if (has("Palace of Darkness")) {
    const podFront = rule("Palace of Darkness", "PoD Middle Cage N");
    if (podFront.worstCase === 6) {
      podFront.worstCase = 1;
      podFront.smallKeyNum = 1;
    }
  }
  // Mire's blue barriers: two keys from either state (:298-307, 312-316)
  const mire = logics.get("Misery Mire");
  for (const door of ALTERNATIVE_CRYSTAL_DOORS)
    mire?.doorRules.set(door, {
      allowSmall: false,
      alternateBigKeyLoc: new Set(),
      alternateSmallKey: null,
      crystalAlternative: 2,
      isValid: true,
      smallKeyNum: 0,
      smallLocation: null,
    });
  if (has("Ganons Tower")) {
    const conveyor = rule("Ganons Tower", "GT Conveyor Star Pits EN");
    for (const door of ["GT Firesnake Room SW", "GT Tile Room EN"])
      for (const loc of conveyor.alternateBigKeyLoc)
        rule("Ganons Tower", door).alternateBigKeyLoc.add(loc);
  }
  return logics;
}

// The run's timeline: when each thing the board holds was found or checked.
// Pure: the store stamps each change of the run with its instant and the run
// timer's reading then (`stampTimeline`), and the Run tab reads it. It keeps
// what the board holds now, so undoing a find drops its time with it.
import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { type ItemState, itemsMax } from "@/games/alttpr/data/items";
import { PACK_ITEMS } from "@/games/alttpr/logic/packItems";
import type { Stamp } from "@/games/stamp";

/**
 * A run's finds by key: `item:<id>` for an item held or not, `item:<id>:<n>`
 * for each level of a progressive one (a boss's 2 is beaten) or each bit of
 * one whose bits are items (the bow's 1 is the silver arrows, its 2 the bow),
 * and `check:<location>` for a location checked, by the pack's ids.
 */
export type Timeline = Readonly<Record<string, Stamp>>;

/** What of a run the timeline follows. */
interface Finds {
  readonly items: ItemState;
  readonly checked: Readonly<Record<string, true>>;
}

/**
 * The kinds of value that are no find: a dungeon's items left, the prize
 * picked for it, the boss known to hold it, the hearts on screen and the
 * pieces toward the next, the
 * spacer, and what no cell draws
 * (the escape's bombs and its end, the flute activated, the prizes held).
 */
const NO_FINDS: ReadonlySet<string> = new Set([
  "escape",
  "hearts",
  "held",
  "known",
  "activation",
  "none",
  "prize",
  "boss",
  "quarters",
]);

/**
 * How the timeline reads an item's value, from what it records for the
 * pack (logic/packItems.ts): each bit an item, each level a find, or no
 * find at all (NO_FINDS).
 */
const findsOf = (id: string): "bits" | "levels" | null => {
  const kind = Object.hasOwn(PACK_ITEMS, id) ? PACK_ITEMS[id].kind : "none";
  if (NO_FINDS.has(kind)) return null;
  return kind === "bits" ? "bits" : "levels";
};

/** Each bit set in `value`, as its own value: 3 is 1 and 2. */
const bitsOf = (value: number): number[] =>
  [1, 2, 4, 8].filter((bit) => (value & bit) !== 0);

/**
 * The timeline once a run changes from `before` to `after` at `stamp`: each
 * level gained and location checked gets the stamp, each level lost and
 * location unchecked loses its entry. The same object when nothing dated
 * changed.
 */
export const stampTimeline = (
  timeline: Timeline,
  before: Finds,
  after: Finds,
  stamp: Stamp,
): Timeline => {
  let next: Record<string, Stamp> | null = null;
  const edit = () => {
    next ??= { ...timeline };
    return next;
  };

  if (before.items !== after.items) {
    for (const [id, now] of Object.entries(after.items)) {
      const was = before.items[id];
      const finds = findsOf(id);
      if (was === now || finds === null) continue;
      if (typeof now === "boolean") {
        if (now) edit()[`item:${id}`] = stamp;
        else if (was === true) delete edit()[`item:${id}`];
        continue;
      }
      const from = typeof was === "number" ? was : 0;
      if (finds === "bits") {
        for (const bit of bitsOf(now & ~from)) {
          edit()[`item:${id}:${bit}`] = stamp;
        }
        for (const bit of bitsOf(from & ~now)) {
          delete edit()[`item:${id}:${bit}`];
        }
        continue;
      }
      for (let level = from + 1; level <= now; level++) {
        edit()[`item:${id}:${level}`] = stamp;
      }
      for (let level = now + 1; level <= from; level++) {
        delete edit()[`item:${id}:${level}`];
      }
    }
  }

  if (before.checked !== after.checked) {
    for (const id of Object.keys(after.checked)) {
      if (!before.checked[id]) edit()[`check:${id}`] = stamp;
    }
    for (const id of Object.keys(before.checked)) {
      if (!after.checked[id]) delete edit()[`check:${id}`];
    }
  }

  return next ?? timeline;
};

const ITEM_KEY = /^item:([a-z0-9]+)(?::(\d+))?$/;

/**
 * Whether this version knows a timeline key: an item it dates, at a level
 * it reaches, or a location of the map.
 */
export const isTimelineKey = (key: string): boolean => {
  if (key.startsWith("check:")) return MAP_LOCATIONS.has(key.slice(6));
  const [, id = "", level] = ITEM_KEY.exec(key) ?? [];
  const finds = findsOf(id);
  if (finds === null) return false;
  if (!Object.hasOwn(itemsMax, id)) return level === undefined;
  if (level === undefined) return false;
  if (finds === "bits") return bitsOf(itemsMax[id]).includes(Number(level));
  return Number(level) >= 1 && Number(level) <= itemsMax[id];
};

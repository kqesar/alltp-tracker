// A Door Randomizer run's door notes as the store changes them: pure, by
// ids alone, so the main bundle never loads DR's world to note a door. What
// the ids name (which doors a shuffle relinks, which kinds may move) is the
// pack's `door-world`, which the Doors tab and the logic load on demand.

import type {
  DoorKindNote,
  DoorNotes,
} from "@/games/alttpr/stores/persistence";

/** A change to the notes: each entry set, or forgotten (`null`). */
export type DoorNotesChange = {
  readonly links?: Readonly<Record<string, string | null>>;
  readonly lobbies?: Readonly<Record<string, string | null>>;
  readonly kinds?: Readonly<Record<string, DoorKindNote | null>>;
  readonly keys?: Readonly<Record<string, number | null>>;
};

/** A table of the notes with `change` laid on it, the same when it holds. */
function changed<T>(
  table: Readonly<Record<string, T>> | undefined,
  change: Readonly<Record<string, T | null>> | undefined,
): Readonly<Record<string, T>> | undefined {
  if (change === undefined) return table;
  const next: Record<string, T> = { ...table };
  let moved = false;
  for (const [key, value] of Object.entries(change)) {
    if (value === null) {
      if (key in next) {
        delete next[key];
        moved = true;
      }
    } else if (next[key] !== value) {
      next[key] = value;
      moved = true;
    }
  }
  if (!moved) return table;
  return Object.keys(next).length === 0 ? undefined : next;
}

/**
 * The notes with a change laid on them: the same object when nothing
 * moves, a table emptied dropped, so a run with none noted is `{}`.
 */
export function withDoorNotes(
  notes: DoorNotes,
  change: DoorNotesChange,
): DoorNotes {
  const links = changed(notes.links, change.links);
  const lobbies = changed(notes.lobbies, change.lobbies);
  const kinds = changed(notes.kinds, change.kinds);
  const keys = changed(notes.keys, change.keys);
  if (
    links === notes.links &&
    lobbies === notes.lobbies &&
    kinds === notes.kinds &&
    keys === notes.keys
  )
    return notes;
  return {
    ...(links === undefined ? {} : { links }),
    ...(lobbies === undefined ? {} : { lobbies }),
    ...(kinds === undefined ? {} : { kinds }),
    ...(keys === undefined ? {} : { keys }),
  };
}

/**
 * What noting that `door` leads into `target` (or into nothing known,
 * `null`) changes. A door leads into one door, which comes out of it alone:
 * a door noted elsewhere before is forgotten there. In a coupled shuffle
 * the way back is noted with it (`target` leads into `door`), and the way
 * back of a link forgotten is forgotten too. A door noted gets its kind and
 * its target's as plain doors where none is noted: the player went through
 * both, and sets either kind beside it.
 */
export function linkChange(
  notes: DoorNotes,
  door: string,
  target: string | null,
  coupled: boolean,
): DoorNotesChange {
  const links = notes.links ?? {};
  const change: Record<string, string | null> = { [door]: target };
  const forget = (id: string | undefined) => {
    if (id !== undefined && id !== door && id !== target) change[id] = null;
  };
  // The door's earlier target, and its way back to this door
  const before = links[door];
  if (coupled && before !== undefined && links[before] === door) forget(before);
  if (target !== null) {
    // Whatever led into the target before leads nowhere known now
    for (const [from, to] of Object.entries(links))
      if (to === target && from !== door) forget(from);
    if (coupled) {
      const theirs = links[target];
      if (theirs !== undefined && theirs !== door && links[theirs] === target)
        forget(theirs);
      change[target] = door;
    }
  }
  const kinds: Record<string, DoorKindNote> = {};
  if (target !== null)
    for (const id of [door, target])
      if (notes.kinds?.[id] === undefined) kinds[id] = "normal";
  return {
    links: change,
    ...(Object.keys(kinds).length === 0 ? {} : { kinds }),
  };
}

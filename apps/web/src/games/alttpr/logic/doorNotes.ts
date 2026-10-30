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

/** Each links table's way backs, so a coupled door's is found once. */
const wayBacks = new WeakMap<
  Readonly<Record<string, string>>,
  ReadonlyMap<string, string>
>();

/**
 * Where a door leads as the notes tell it: its own note, else, in a coupled
 * shuffle, the way back of the door noted into it (the first, should two
 * be), which the store never holds: DR's world derives it the same way
 * (the pack's `linkShuffledDoors`).
 */
export function linkOf(
  links: DoorNotes["links"],
  door: string,
  coupled: boolean,
): string | undefined {
  if (links === undefined) return undefined;
  const own = links[door];
  if (own !== undefined || !coupled) return own;
  let back = wayBacks.get(links);
  if (back === undefined) {
    const found = new Map<string, string>();
    for (const [from, to] of Object.entries(links))
      if (!found.has(to)) found.set(to, from);
    back = found;
    wayBacks.set(links, back);
  }
  return back.get(door);
}

/**
 * What noting that `door` leads into `target` (or into nothing known,
 * `null`) changes. Only what the player noted is kept: a coupled door's way
 * back is derived (`linkOf`), so it never outlives the coupling it rests
 * on. A door leads into one door, which comes out of it alone: a door noted
 * into the target before is forgotten; in a coupled shuffle so is every
 * note that pairs the door or the target with another. No kind is noted
 * with it: a kind the player has not noted stays unknown, so what lies
 * behind the door reads maybe until they note it.
 */
export function linkChange(
  notes: DoorNotes,
  door: string,
  target: string | null,
  coupled: boolean,
): DoorNotesChange {
  const change: Record<string, string | null> = {};
  for (const [from, to] of Object.entries(notes.links ?? {})) {
    const taken = target !== null && to === target && from !== door;
    const paired =
      coupled &&
      (from === door ||
        to === door ||
        (target !== null && (from === target || to === target)));
    if (taken || paired) change[from] = null;
  }
  change[door] = target;
  return { links: change };
}

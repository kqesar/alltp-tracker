// From the session's snapshot (ids, as the server sends them) to the run the
// board saves and publishes (names): pure, so the runtime's batching and the
// stream view's data are tested apart from any socket.

import type { ApSnapshot, NameData } from "@alltp/archipelago";
import type { ApItem, ApRoom, ApServerRun } from "@/games/archipelago/store";

/** An item whose name the data package has not given yet. */
export const unknownItem = (id: number) => `Unknown item ${id}`;

/**
 * The run as the snapshot states it, or null while the snapshot is not the
 * current word of a connected server (between connections, before
 * Connected): the board keeps what it has.
 * @param names - The slot's game's name data, once loaded
 * @param checksum - The checksum known so far, kept when the room is not
 */
export const projectRun = (
  snapshot: ApSnapshot,
  names: NameData | null,
  checksum: string | null,
): Omit<ApServerRun, "updatedAt"> | null => {
  const { identity } = snapshot;
  if (!snapshot.ready || identity === null) return null;
  const room: ApRoom = {
    checksum:
      names?.checksum ?? snapshot.room?.checksums[identity.game] ?? checksum,
    game: identity.game,
    generatorVersion: identity.generatorVersion,
    seedName: identity.seedName,
    slot: identity.slot,
    slotName: snapshot.slotName ?? "",
    team: identity.team,
  };
  // One entry per name, in the order the first copy came
  const byName = new Map<string, ApItem>();
  for (const { flags, item } of snapshot.items) {
    const name = names?.items.get(item) ?? unknownItem(item);
    const held = byName.get(name);
    byName.set(
      name,
      held === undefined
        ? { count: 1, flags, name }
        : { count: held.count + 1, flags: held.flags | flags, name },
    );
  }
  return {
    checked: [...snapshot.checked],
    items: [...byName.values()],
    missing: [...snapshot.missing],
    players: snapshot.players
      .filter((player) => player.team === identity.team)
      .map(({ alias, game, slot }) => ({ game, name: alias, slot })),
    raceMode: snapshot.raceMode,
    received: snapshot.items.length,
    room,
  };
};

/** AP's item classification bits (NetworkItem.flags). */
export const PROGRESSION = 1;
export const USEFUL = 2;
export const TRAP = 4;

/** The kinds the generic board groups items by, most important first. */
export const ITEM_KINDS = [
  { id: "progression", name: "Progression" },
  { id: "useful", name: "Useful" },
  { id: "filler", name: "Filler" },
  { id: "trap", name: "Traps" },
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number]["id"];

/** An item's kind by its flags: progression first, then useful, then trap. */
export const kindOf = (flags: number): ItemKind => {
  if (flags & PROGRESSION) return "progression";
  if (flags & USEFUL) return "useful";
  if (flags & TRAP) return "trap";
  return "filler";
};

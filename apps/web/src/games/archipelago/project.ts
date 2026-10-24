// From the session's snapshot (ids, as the server sends them) to the run the
// board saves and publishes (names): pure, so the runtime's batching and the
// stream view's data are tested apart from any socket.

import {
  type ApSnapshot,
  type FeedNames,
  hintCost,
  hintStatus,
  type NameData,
  type NetworkItem,
  splitHints,
} from "@alltp/archipelago";
import type {
  ApFeedEntry,
  ApHint,
  ApItem,
  ApRoom,
  ApServerRun,
} from "@/games/archipelago/store";

/** An item whose name the data package has not given yet. */
export const unknownItem = (id: number) => `Unknown item ${id}`;

/** A location whose name the data package has not given yet. */
export const unknownLocation = (id: number) => `Location ${id}`;

/** A game's name data, once loaded; null until then (or for no game). */
export type NameLookup = (game: string | undefined) => NameData | null;

/** How many slot data values the run keeps: information, not a dump. */
const SLOT_DATA_KEPT = 64;

/** The slot data's plain values (numbers, strings, booleans), outside races only. */
const slotDataOf = (
  snapshot: ApSnapshot,
): Record<string, string | number | boolean> | null => {
  if (snapshot.raceMode !== false || snapshot.slotData === null) return null;
  const kept: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(snapshot.slotData)) {
    if (Object.keys(kept).length === SLOT_DATA_KEPT) break;
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      kept[key] = value;
    }
  }
  return kept;
};

/** Names by slot and by id, as the feed, the hints and "What I sent" read them. */
export const namesOf = (snapshot: ApSnapshot, names: NameLookup): FeedNames => {
  const team = snapshot.identity?.team ?? 0;
  const players = new Map(
    snapshot.players
      .filter((player) => player.team === team)
      .map((player) => [player.slot, player]),
  );
  return {
    game: (slot) => players.get(slot)?.game,
    item: (game, id) => names(game)?.items.get(id),
    location: (game, id) => names(game)?.locations.get(id),
    me: snapshot.identity?.slot ?? -1,
    player: (slot) => players.get(slot)?.alias ?? `Player ${slot}`,
  };
};

/** What one item of the slot's received list reads as: its name, sender and location. */
export type AwayItem = {
  item: string;
  flags: number;
  sender: string;
  location: string;
};

/** Items the slot received, with who sent them and from where. */
export const awayItems = (
  snapshot: ApSnapshot,
  items: readonly NetworkItem[],
  names: NameLookup,
): AwayItem[] => {
  const by = namesOf(snapshot, names);
  const own = snapshot.identity?.game;
  return items.map(({ flags, item, location, player }) => ({
    flags,
    item: by.item(own, item) ?? unknownItem(item),
    location:
      by.location(by.game(player), location) ?? unknownLocation(location),
    sender: player === by.me ? "your world" : by.player(player),
  }));
};

/**
 * The games whose names the run needs beyond the slot's own: the receivers
 * of what its checked locations held, both sides of each hint, and the
 * senders of what it received while away. Loaded lazily, one at a time.
 */
export const neededForRun = (
  snapshot: ApSnapshot,
  away: readonly NetworkItem[],
): string[] => {
  const by = namesOf(snapshot, () => null);
  const games = new Set<string>();
  const add = (slot: number) => {
    const game = by.game(slot);
    if (game !== undefined && game !== "") games.add(game);
  };
  for (const item of snapshot.sent) add(item.player);
  for (const hint of snapshot.hints ?? []) {
    add(hint.receiver);
    add(hint.finder);
  }
  for (const item of away) add(item.player);
  return [...games];
};

/**
 * The run as the snapshot states it, or null while the snapshot is not the
 * current word of a connected server (between connections, before
 * Connected): the board keeps what it has.
 * @param names - Name data by game, as loaded so far
 * @param checksum - The checksum known so far, kept when the room is not
 * @param feed - The feed's lines, resolved (runtime.ts)
 */
export const projectRun = (
  snapshot: ApSnapshot,
  names: NameLookup,
  checksum: string | null,
  feed: readonly ApFeedEntry[] = [],
): Omit<ApServerRun, "updatedAt"> | null => {
  const { identity } = snapshot;
  if (!snapshot.ready || identity === null) return null;
  const own = names(identity.game);
  const room: ApRoom = {
    checksum:
      own?.checksum ?? snapshot.room?.checksums[identity.game] ?? checksum,
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
    const name = own?.items.get(item) ?? unknownItem(item);
    const held = byName.get(name);
    byName.set(
      name,
      held === undefined
        ? { count: 1, flags, name }
        : { count: held.count + 1, flags: held.flags | flags, name },
    );
  }
  const by = namesOf(snapshot, names);
  const { forMe, inMyWorld } = splitHints(snapshot.hints ?? [], identity.slot);
  const hintRow =
    (mine: boolean) =>
    (hint: (typeof forMe)[number]): ApHint => ({
      entrance: hint.entrance,
      finder: by.player(hint.finder),
      flags: hint.flags,
      forMe: mine,
      item:
        by.item(by.game(hint.receiver), hint.item) ?? unknownItem(hint.item),
      location:
        by.location(by.game(hint.finder), hint.location) ??
        unknownLocation(hint.location),
      receiver: by.player(hint.receiver),
      status: hintStatus(hint),
    });
  const locations = snapshot.checked.length + snapshot.missing.length;
  return {
    checked: [...snapshot.checked],
    feed: [...feed],
    hintCost: hintCost(snapshot.room?.hintCost ?? null, locations),
    hintPoints: snapshot.hintPoints,
    hints: [...forMe.map(hintRow(true)), ...inMyWorld.map(hintRow(false))],
    items: [...byName.values()],
    missing: [...snapshot.missing],
    players: snapshot.players
      .filter((player) => player.team === identity.team)
      .map(({ alias, game, slot }) => ({
        game,
        name: alias,
        slot,
        status: snapshot.clientStatus[slot] ?? null,
      })),
    raceMode: snapshot.raceMode,
    received: snapshot.items.length,
    room,
    sent: snapshot.sent.map(({ flags, item, location, player }) => ({
      flags,
      item: by.item(by.game(player), item) ?? unknownItem(item),
      location,
      to: player,
    })),
    slotData: slotDataOf(snapshot),
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

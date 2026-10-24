// The slot as the server states it, folded from the packets it sends: a pure
// reducer the session runs on every packet and the app persists. What it
// holds is published (live follow, the stream view), so it never holds the
// address, the port or the password: the server never sends them.
//
// Every packet comes from the network, so each field is checked before use;
// a packet that does not hold together leaves the snapshot unchanged.

import { type Hint, hintsKey, parseClientStatusKey, parseHints } from "./hints";

export interface NetworkItem {
  /** The item's id in the receiving slot's game. */
  readonly item: number;
  /** The location's id in the finding slot's game. */
  readonly location: number;
  /** The slot that found it. */
  readonly player: number;
  /** AP's classification bits: 1 progression, 2 useful, 4 trap. */
  readonly flags: number;
}

export interface ApPlayer {
  readonly team: number;
  readonly slot: number;
  readonly name: string;
  readonly alias: string;
  readonly game: string;
}

/** What RoomInfo said about the room this connection reached. */
export interface RoomSummary {
  readonly seedName: string;
  /** "0.6.8": the AP that generated the multiworld. */
  readonly generatorVersion: string;
  /** "0.6.8": the server's own; a `--compatibility 0` room accepts only it. */
  readonly serverVersion: string;
  readonly passwordRequired: boolean;
  readonly games: readonly string[];
  /** Name-data checksum per game, for datapackage.ts. */
  readonly checksums: Readonly<Record<string, string>>;
  readonly hintCost: number | null;
  readonly locationCheckPoints: number | null;
}

/**
 * Which run a snapshot belongs to. `seed_name` alone is not enough: it
 * follows `--seed`, so a normal and a race multiworld can share it (bench).
 */
export interface RoomIdentity {
  readonly seedName: string;
  readonly generatorVersion: string;
  readonly team: number;
  readonly slot: number;
  readonly game: string;
}

export interface ApSnapshot {
  readonly identity: RoomIdentity | null;
  /** The current connection has delivered Connected: the data is current. */
  readonly ready: boolean;
  readonly room: RoomSummary | null;
  readonly slotName: string | null;
  readonly players: readonly ApPlayer[];
  /** Every item the slot received, in the server's index order. */
  readonly items: readonly NetworkItem[];
  /** The slot's own locations, checked and not, sorted. */
  readonly checked: readonly number[];
  readonly missing: readonly number[];
  readonly hintPoints: number | null;
  /** `_read_race_mode`: null until read. */
  readonly raceMode: boolean | null;
  readonly slotData: Readonly<Record<string, unknown>> | null;
  /** `_read_hints_{team}_{slot}`: every hint involving the slot; null until read. */
  readonly hints: readonly Hint[] | null;
  /** `_read_client_status_{team}_{slot}` per slot of the team, as read so far. */
  readonly clientStatus: Readonly<Record<number, number>>;
  /**
   * What the slot's checked locations held ("What I sent"), from
   * LocationInfo: `player` is the receiver. Sorted by location.
   */
  readonly sent: readonly NetworkItem[];
}

export interface Reduction {
  readonly snapshot: ApSnapshot;
  /**
   * ReceivedItems skipped an index: the session sends Sync, and the server
   * answers with the whole list at index 0.
   */
  readonly sync: boolean;
  /** Connected named another run: the old snapshot was dropped. */
  readonly reset: boolean;
}

export const EMPTY_SNAPSHOT: ApSnapshot = {
  checked: [],
  clientStatus: {},
  hintPoints: null,
  hints: null,
  identity: null,
  items: [],
  missing: [],
  players: [],
  raceMode: null,
  ready: false,
  room: null,
  sent: [],
  slotData: null,
  slotName: null,
};

/** A new connection starts: the data stays on screen, no longer current. */
export function beginConnection(snapshot: ApSnapshot): ApSnapshot {
  return snapshot.ready || snapshot.room !== null
    ? { ...snapshot, ready: false, room: null }
    : snapshot;
}

export function sameIdentity(a: RoomIdentity, b: RoomIdentity): boolean {
  return (
    a.seedName === b.seedName &&
    a.generatorVersion === b.generatorVersion &&
    a.team === b.team &&
    a.slot === b.slot &&
    a.game === b.game
  );
}

type Record_ = Record<string, unknown>;

const isRecord = (value: unknown): value is Record_ =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isInteger(value);
const intOr = (value: unknown, fallback: number | null): number | null =>
  isInt(value) ? value : fallback;

function intList(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(isInt) ? [...value] : null;
}

function version(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const { build, major, minor } = value;
  return isInt(major) && isInt(minor) && isInt(build)
    ? `${major}.${minor}.${build}`
    : null;
}

function networkItem(value: unknown): NetworkItem | null {
  if (!isRecord(value)) return null;
  const { flags, item, location, player } = value;
  return isInt(item) && isInt(location) && isInt(player) && isInt(flags)
    ? { flags, item, location, player }
    : null;
}

function roomSummary(packet: Record_): RoomSummary | null {
  const serverVersion = version(packet.version);
  const generatorVersion = version(packet.generator_version);
  const { datapackage_checksums: sums, games, seed_name: seedName } = packet;
  if (
    serverVersion === null ||
    generatorVersion === null ||
    typeof seedName !== "string" ||
    !Array.isArray(games) ||
    !games.every((game) => typeof game === "string")
  ) {
    return null;
  }
  const checksums: Record<string, string> = {};
  if (isRecord(sums)) {
    for (const [game, sum] of Object.entries(sums)) {
      if (typeof sum === "string") checksums[game] = sum;
    }
  }
  return {
    checksums,
    games: [...games],
    generatorVersion,
    hintCost: intOr(packet.hint_cost, null),
    locationCheckPoints: intOr(packet.location_check_points, null),
    passwordRequired: packet.password === true,
    seedName,
    serverVersion,
  };
}

function players(
  value: unknown,
  games: (slot: number) => string,
): ApPlayer[] | null {
  if (!Array.isArray(value)) return null;
  const list: ApPlayer[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { alias, name, slot, team } = entry;
    if (!isInt(team) || !isInt(slot) || typeof name !== "string") return null;
    list.push({
      alias: typeof alias === "string" ? alias : name,
      game: games(slot),
      name,
      slot,
      team,
    });
  }
  return list;
}

const sorted = (ids: Iterable<number>): number[] =>
  [...new Set(ids)].sort((a, b) => a - b);

function connected(state: ApSnapshot, packet: Record_): Reduction {
  const room = state.room;
  const { slot, slot_info: info, team } = packet;
  const checked = intList(packet.checked_locations);
  const missing = intList(packet.missing_locations);
  if (
    room === null ||
    !isInt(slot) ||
    !isInt(team) ||
    !isRecord(info) ||
    checked === null ||
    missing === null
  ) {
    return done(state);
  }
  const slotInfo = (n: number): Record_ | null => {
    const entry = info[String(n)];
    return isRecord(entry) ? entry : null;
  };
  const own = slotInfo(slot);
  if (own === null || typeof own.game !== "string") return done(state);
  const identity: RoomIdentity = {
    game: own.game,
    generatorVersion: room.generatorVersion,
    seedName: room.seedName,
    slot,
    team,
  };
  const reset =
    state.identity !== null && !sameIdentity(state.identity, identity);
  const gameOf = (n: number) => {
    const game = slotInfo(n)?.game;
    return typeof game === "string" ? game : "";
  };
  return {
    reset,
    snapshot: {
      checked: sorted(checked),
      clientStatus: reset ? {} : state.clientStatus,
      hintPoints: intOr(packet.hint_points, null),
      hints: reset ? null : state.hints,
      identity,
      // Same run: the server's list only grows, and it resends it whole at
      // index 0 right after Connected whenever it is not empty.
      items: reset ? [] : state.items,
      missing: sorted(missing),
      players: players(packet.players, gameOf) ?? [],
      raceMode: reset ? null : state.raceMode,
      ready: true,
      room,
      // What was scouted stays true of the same run's checked locations
      sent: reset ? [] : state.sent,
      slotData: isRecord(packet.slot_data) ? packet.slot_data : null,
      slotName: typeof own.name === "string" ? own.name : null,
    },
    sync: false,
  };
}

function receivedItems(state: ApSnapshot, packet: Record_): Reduction {
  const { index, items } = packet;
  if (!state.ready || !isInt(index) || !Array.isArray(items)) {
    return done(state);
  }
  const parsed: NetworkItem[] = [];
  for (const entry of items) {
    const item = networkItem(entry);
    if (item === null) return done(state);
    parsed.push(item);
  }
  if (index === 0) {
    return done({ ...state, items: parsed });
  }
  if (index === state.items.length) {
    return done({ ...state, items: [...state.items, ...parsed] });
  }
  // A gap, or an overlap the protocol does not produce: ask for the list.
  return { reset: false, snapshot: state, sync: true };
}

function roomUpdate(state: ApSnapshot, packet: Record_): Reduction {
  if (!state.ready) return done(state);
  let next = state;
  const newly = intList(packet.checked_locations);
  if (newly !== null) {
    // After a Collect the server repeats ids already sent: a union.
    const had = new Set(next.checked);
    const fresh = newly.filter((id) => !had.has(id));
    if (fresh.length > 0) {
      const gone = new Set(fresh);
      next = {
        ...next,
        checked: sorted([...next.checked, ...fresh]),
        missing: next.missing.filter((id) => !gone.has(id)),
      };
    }
  }
  if (isInt(packet.hint_points) && packet.hint_points !== next.hintPoints) {
    next = { ...next, hintPoints: packet.hint_points };
  }
  const room = next.room;
  if (room !== null) {
    const hintCost = intOr(packet.hint_cost, room.hintCost);
    const points = intOr(
      packet.location_check_points,
      room.locationCheckPoints,
    );
    if (hintCost !== room.hintCost || points !== room.locationCheckPoints) {
      next = {
        ...next,
        room: { ...room, hintCost, locationCheckPoints: points },
      };
    }
  }
  const known = new Map(next.players.map((p) => [p.slot, p.game]));
  const list = players(packet.players, (slot) => known.get(slot) ?? "");
  if (list !== null) next = { ...next, players: list };
  return done(next);
}

function raceMode(state: ApSnapshot, value: unknown): Reduction {
  if (!isInt(value)) return done(state);
  const race = value === 1;
  return done(race === state.raceMode ? state : { ...state, raceMode: race });
}

const RACE_MODE_KEY = "_read_race_mode";

/** One data storage value read or changed: the race flag, hints, a status. */
function storageValue(
  state: ApSnapshot,
  key: string,
  value: unknown,
): ApSnapshot {
  if (key === RACE_MODE_KEY) return raceMode(state, value).snapshot;
  const identity = state.identity;
  if (identity === null) return state;
  if (key === hintsKey(identity.team, identity.slot)) {
    const hints = parseHints(value);
    return hints === null ? state : { ...state, hints };
  }
  const status = parseClientStatusKey(key);
  if (status !== null && status.team === identity.team && isInt(value)) {
    return state.clientStatus[status.slot] === value
      ? state
      : {
          ...state,
          clientStatus: { ...state.clientStatus, [status.slot]: value },
        };
  }
  return state;
}

/** LocationInfo: what the slot's own checked locations held. */
function locationInfo(state: ApSnapshot, packet: Record_): Reduction {
  const { locations } = packet;
  if (!state.ready || !Array.isArray(locations)) return done(state);
  const checked = new Set(state.checked);
  const byLocation = new Map(state.sent.map((item) => [item.location, item]));
  let changed = false;
  for (const entry of locations) {
    const item = networkItem(entry);
    // Only what the guard let the session ask: the slot's checked locations
    if (item === null || !checked.has(item.location)) continue;
    const had = byLocation.get(item.location);
    if (
      had?.item === item.item &&
      had.player === item.player &&
      had.flags === item.flags
    ) {
      continue;
    }
    byLocation.set(item.location, item);
    changed = true;
  }
  if (!changed) return done(state);
  const sent = [...byLocation.values()].sort((a, b) => a.location - b.location);
  return done({ ...state, sent });
}

function done(snapshot: ApSnapshot): Reduction {
  return { reset: false, snapshot, sync: false };
}

/**
 * Folds one server packet into the snapshot. The returned snapshot is the
 * same object when nothing changed.
 */
export function reduce(state: ApSnapshot, packet: unknown): Reduction {
  if (!isRecord(packet)) return done(state);
  switch (packet.cmd) {
    case "RoomInfo": {
      const room = roomSummary(packet);
      return room === null ? done(state) : done({ ...state, room });
    }
    case "Connected":
      return connected(state, packet);
    case "ReceivedItems":
      return receivedItems(state, packet);
    case "RoomUpdate":
      return roomUpdate(state, packet);
    case "Retrieved": {
      if (!isRecord(packet.keys)) return done(state);
      let next = state;
      for (const [key, value] of Object.entries(packet.keys)) {
        next = storageValue(next, key, value);
      }
      return done(next);
    }
    case "SetReply":
      return typeof packet.key === "string"
        ? done(storageValue(state, packet.key, packet.value))
        : done(state);
    case "LocationInfo":
      return locationInfo(state, packet);
    default:
      return done(state);
  }
}

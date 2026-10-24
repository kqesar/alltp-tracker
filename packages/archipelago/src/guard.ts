// The read-only guarantee, second layer: every frame that leaves the socket
// is checked here, and anything a read-only tracker has no business sending
// throws before a byte goes out. The first layer is the Tracker tag, which
// makes the server refuse checks and goals; it does not refuse Bounce, Say,
// Set or hints (bench, normal-session.json), hence this whitelist.
//
// One packet depends on the slot's state: LocationScouts, which reads what
// the slot's own checked locations held ("What I sent"). It passes only with
// `create_as_hint: 0` (no hint created, nothing announced) and for locations
// the server already states checked, so it never reveals a location the
// player has not opened.

import type { WebSocketLike } from "./platform";

/** A frame or packet the guard refused. Sending it would be a bug. */
export class GuardError extends Error {
  override readonly name = "GuardError";

  constructor(
    /** The refused packet's `cmd`, or null when the frame was not packets. */
    readonly cmd: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** The only commands a tracker sends (README, "Read-only guarantee"). */
export const ALLOWED_COMMANDS = [
  "Connect",
  "GetDataPackage",
  "Get",
  "SetNotify",
  "Sync",
  "LocationScouts",
] as const;

export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

/** Server-owned data storage keys a tracker reads (all `_read_`, never writable). */
const READABLE_KEYS: readonly RegExp[] = [
  /^_read_hints_\d+_\d+$/,
  /^_read_client_status_\d+_\d+$/,
  /^_read_slot_data_\d+$/,
  /^_read_race_mode$/,
  /^_read_location_name_groups_[^\n]+$/,
];

/** What the guard needs to know of the slot: which locations are checked. */
export interface GuardContext {
  /** Whether the server states this location of the slot checked. */
  readonly isChecked: (location: number) => boolean;
}

/** No location checked: every LocationScouts is refused. */
export const NOTHING_CHECKED: GuardContext = { isChecked: () => false };

/** The one tag a tracker connects with: no DeathLink, no game-client tags. */
export const TRACKER_TAGS: readonly string[] = ["Tracker"];

export function isReadableKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    READABLE_KEYS.some((pattern) => pattern.test(key))
  );
}

const CONNECT_FIELDS = new Set([
  "cmd",
  "name",
  "game",
  "password",
  "uuid",
  "version",
  "items_handling",
  "tags",
  "slot_data",
]);

function refuse(cmd: string | null, why: string): never {
  throw new GuardError(cmd, `Refused to send ${cmd ?? "a frame"}: ${why}`);
}

function onlyFields(
  packet: Record<string, unknown>,
  cmd: string,
  fields: ReadonlySet<string>,
): void {
  for (const key of Object.keys(packet)) {
    if (!fields.has(key)) refuse(cmd, `unexpected field "${key}"`);
  }
}

function readableKeys(packet: Record<string, unknown>, cmd: string): void {
  const { keys } = packet;
  if (!Array.isArray(keys) || keys.length === 0) refuse(cmd, "no keys");
  for (const key of keys) {
    if (!isReadableKey(key))
      refuse(cmd, `key ${JSON.stringify(key)} is not read-only`);
  }
}

const GET_FIELDS = new Set(["cmd", "keys", "uuid"]);
const SET_NOTIFY_FIELDS = new Set(["cmd", "keys"]);
const DATA_PACKAGE_FIELDS = new Set(["cmd", "games"]);
const SYNC_FIELDS = new Set(["cmd"]);
const SCOUT_FIELDS = new Set(["cmd", "locations", "create_as_hint"]);

/**
 * Throws a GuardError unless `packet` is one a read-only tracker sends.
 * `context` says which locations are checked, for LocationScouts.
 */
export function checkPacket(
  packet: unknown,
  context: GuardContext = NOTHING_CHECKED,
): void {
  if (typeof packet !== "object" || packet === null || Array.isArray(packet)) {
    refuse(null, "not a packet");
  }
  const record = packet as Record<string, unknown>;
  const cmd = typeof record.cmd === "string" ? record.cmd : null;
  switch (cmd) {
    case "Connect": {
      onlyFields(record, cmd, CONNECT_FIELDS);
      const { game, items_handling: items, tags } = record;
      if (game !== "") refuse(cmd, "a tracker connects with no game");
      if (
        !Array.isArray(tags) ||
        tags.length !== TRACKER_TAGS.length ||
        tags.some((tag, index) => tag !== TRACKER_TAGS[index])
      ) {
        refuse(cmd, `tags must be exactly ${JSON.stringify(TRACKER_TAGS)}`);
      }
      if (
        !Number.isInteger(items) ||
        (items as number) < 0 ||
        (items as number) > 7
      ) {
        refuse(cmd, "items_handling must be 0 to 7");
      }
      return;
    }
    case "Get":
      onlyFields(record, cmd, GET_FIELDS);
      readableKeys(record, cmd);
      if (record.uuid !== undefined && typeof record.uuid !== "string") {
        refuse(cmd, "uuid must be a string");
      }
      return;
    case "SetNotify":
      onlyFields(record, cmd, SET_NOTIFY_FIELDS);
      readableKeys(record, cmd);
      return;
    case "GetDataPackage": {
      onlyFields(record, cmd, DATA_PACKAGE_FIELDS);
      const { games } = record;
      if (
        games !== undefined &&
        (!Array.isArray(games) ||
          games.some((game) => typeof game !== "string"))
      ) {
        refuse(cmd, "games must be strings");
      }
      return;
    }
    case "Sync":
      onlyFields(record, cmd, SYNC_FIELDS);
      return;
    case "LocationScouts": {
      onlyFields(record, cmd, SCOUT_FIELDS);
      // 0 exactly, and said: the server's default today, never left to it
      if (record.create_as_hint !== 0) {
        refuse(cmd, "create_as_hint must be 0: a tracker creates no hint");
      }
      const { locations } = record;
      if (!Array.isArray(locations) || locations.length === 0) {
        refuse(cmd, "no locations");
      }
      for (const location of locations) {
        if (!Number.isInteger(location) || !context.isChecked(location)) {
          refuse(
            cmd,
            `location ${JSON.stringify(location)} is not one the server states checked`,
          );
        }
      }
      return;
    }
    default:
      refuse(cmd, "not on the read-only whitelist");
  }
}

/** Throws a GuardError unless `data` is a JSON array of allowed packets. */
export function checkFrame(
  data: unknown,
  context: GuardContext = NOTHING_CHECKED,
): void {
  if (typeof data !== "string") refuse(null, "not text");
  let packets: unknown;
  try {
    packets = JSON.parse(data);
  } catch {
    refuse(null, "not JSON");
  }
  if (!Array.isArray(packets) || packets.length === 0) {
    refuse(null, "not a list of packets");
  }
  for (const packet of packets) checkPacket(packet, context);
}

/**
 * Puts the guard on a socket: its `send` checks each frame first and throws
 * a GuardError instead of sending a refused one. Every frame archipelago.js
 * writes goes through this method, its own packets included.
 *
 * `onRefused` hears of each refusal before the throw: a refusal inside one
 * of the library's event handlers would otherwise end there, unseen.
 * `context` is read at each frame: the checked locations as they stand.
 */
export function guardSocket<T extends WebSocketLike>(
  socket: T,
  onRefused: (error: GuardError) => void = () => {},
  context: GuardContext = NOTHING_CHECKED,
): T {
  const send = socket.send.bind(socket);
  socket.send = (data: string) => {
    try {
      checkFrame(data, context);
    } catch (error) {
      if (error instanceof GuardError) onRefused(error);
      throw error;
    }
    send(data);
  };
  return socket;
}

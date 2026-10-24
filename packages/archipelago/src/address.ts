// What a player types in the Room field, read into a server address or an
// archipelago.gg room link, and the URLs this page may try for it. README
// "Addresses and connectivity" holds the measured table the policy encodes.

/** AP's default port (MultiServer.py, and archipelago.js when none is given). */
export const DEFAULT_PORT = 38281;

/** The public host: its room ports speak wss only (bench, 2026-10-24). */
export const ARCHIPELAGO_GG = "archipelago.gg";

export type Scheme = "ws" | "wss";

export interface ServerAddress {
  /** null when the player gave none: connectPlan() picks. */
  readonly scheme: Scheme | null;
  /** Lower case; an IPv6 literal keeps its brackets, as in a URL. */
  readonly host: string;
  readonly port: number;
}

/** `https://archipelago.gg/room/<id>`: resolved to a port and slots by the room's status. */
export interface RoomLink {
  readonly id: string;
}

export type AddressError =
  | "empty"
  /** http(s) that is not an archipelago.gg room link, or another scheme. */
  | "unsupported-scheme"
  | "invalid-host"
  | "invalid-port"
  /** A path, query or user part where only host and port belong. */
  | "unexpected-path";

export type ParsedAddress =
  | {
      readonly ok: true;
      readonly kind: "server";
      readonly address: ServerAddress;
    }
  | { readonly ok: true; readonly kind: "room-link"; readonly room: RoomLink }
  | { readonly ok: false; readonly error: AddressError };

const ROOM_LINK =
  /^(?:https?:\/\/)?(?:www\.)?archipelago\.gg\/room\/([A-Za-z0-9_-]{1,64})\/?(?:[?#].*)?$/i;
const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^\[([0-9a-f:.]+)\]$/;

/**
 * Reads every form the Room field accepts:
 * `archipelago.gg:38281`, `/connect archipelago.gg:38281` (what a room page
 * and AP's clients print), `wss://host:port`, `ws://host:port`,
 * `localhost:38281`, `[::1]:38281`, a bare host (port 38281), and a room link
 * `https://archipelago.gg/room/<id>`.
 */
export function parseAddress(input: string): ParsedAddress {
  const text = input.trim().replace(/^\/connect(?:\s+|$)/i, "");
  if (text === "") return { error: "empty", ok: false };
  const room = ROOM_LINK.exec(text);
  if (room !== null)
    return { kind: "room-link", ok: true, room: { id: room[1] } };

  let scheme: Scheme | null = null;
  let rest = text;
  const match = SCHEME.exec(text);
  if (match !== null) {
    const given = match[1].toLowerCase();
    if (given !== "ws" && given !== "wss") {
      return { error: "unsupported-scheme", ok: false };
    }
    scheme = given;
    rest = text.slice(match[0].length);
  }
  rest = rest.replace(/\/$/, "");
  if (/[/?#@\s]/.test(rest)) return { error: "unexpected-path", ok: false };

  let host: string;
  let portText: string | null = null;
  if (rest.startsWith("[")) {
    const close = rest.indexOf("]");
    if (close === -1) return { error: "invalid-host", ok: false };
    host = rest.slice(0, close + 1);
    const after = rest.slice(close + 1);
    if (after !== "") {
      if (!after.startsWith(":")) return { error: "invalid-host", ok: false };
      portText = after.slice(1);
    }
  } else {
    const parts = rest.split(":");
    if (parts.length > 2) return { error: "invalid-host", ok: false };
    host = parts[0];
    portText = parts.length === 2 ? parts[1] : null;
  }
  host = host.toLowerCase();
  if (!validHost(host)) return { error: "invalid-host", ok: false };

  let port = DEFAULT_PORT;
  if (portText !== null) {
    if (!/^\d{1,5}$/.test(portText))
      return { error: "invalid-port", ok: false };
    port = Number(portText);
    if (port < 1 || port > 65_535) return { error: "invalid-port", ok: false };
  }
  return { address: { host, port, scheme }, kind: "server", ok: true };
}

function validHost(host: string): boolean {
  const v6 = IPV6.exec(host);
  if (v6 !== null) return v6[1].includes(":");
  const v4 = IPV4.exec(host);
  if (v4 !== null) return v4.slice(1).every((octet) => Number(octet) <= 255);
  const labels = host.replace(/\.$/, "").split(".");
  return (
    host.length <= 253 &&
    labels.every((label) => LABEL.test(label)) &&
    // A dotted name of digits only is a malformed IPv4 address, not a host.
    !labels.every((label) => /^\d+$/.test(label))
  );
}

/**
 * Where the server sits, as browsers class it for mixed content and Local
 * Network Access: this device, a private network, or the internet.
 */
export type AddressClass = "loopback" | "private" | "public";

export function addressClass(host: string): AddressClass {
  const name = host.replace(/\.$/, "");
  if (name === "localhost" || name.endsWith(".localhost")) return "loopback";
  const v4 = IPV4.exec(name);
  if (v4 !== null) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return "loopback";
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    ) {
      return "private";
    }
    return "public";
  }
  const v6 = IPV6.exec(name);
  if (v6 !== null) {
    const ip = v6[1];
    if (ip === "::1" || /^0*(:0*){0,6}:0*1$/.test(ip)) return "loopback";
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip)) return "private";
    return "public";
  }
  if (name.endsWith(".local")) return "private";
  return "public";
}

export function isArchipelagoGg(host: string): boolean {
  const name = host.replace(/\.$/, "");
  return name === ARCHIPELAGO_GG || name.endsWith(`.${ARCHIPELAGO_GG}`);
}

/** `wss://host:port`, the form archipelago.js gets: always with a scheme. */
export function serverUrl(scheme: Scheme, address: ServerAddress): string {
  return `${scheme}://${address.host}:${address.port}`;
}

/** Browser families as `@alltp/autotrack`'s environment detection names them. */
export type BrowserFamily = "chromium" | "firefox" | "safari" | "other";

/**
 * The permission a browser asks for before a public page reaches this device
 * ("loopback-network") or the local network ("local-network"): Local Network
 * Access, Chromium 145+ and Firefox 154+ (`@alltp/autotrack`'s README, "Local
 * network access").
 */
export type LocalNetworkPermissionName = "loopback-network" | "local-network";

/**
 * The page the tracker runs in:
 * - "desktop": the Tauri app (a secure context that may open plain ws://
 *   anywhere: gate B, Linux);
 * - "insecure": an http page (the dev server): no mixed content to block;
 * - "secure": an https page in a browser, the site. `gated` says whether this
 *   browser puts sockets to this device and the LAN behind its local network
 *   permission (the app reads it from `@alltp/autotrack`'s `loopbackAccess`:
 *   Chromium 147+, Firefox 154+); absent, Chromium alone counts as gated.
 */
export type PageContext =
  | { readonly kind: "desktop" }
  | { readonly kind: "insecure" }
  | {
      readonly kind: "secure";
      readonly browser: BrowserFamily;
      readonly gated?: boolean;
    };

export type ConnectPlan =
  | {
      readonly ok: true;
      /** The URLs to try, in order, each with a scheme. */
      readonly urls: readonly string[];
      /**
       * The local network permission the browser may ask for before the
       * first socket opens, or null when none stands in the way.
       */
      readonly permission: LocalNetworkPermissionName | null;
    }
  | {
      readonly ok: false;
      /**
       * "blocked-insecure": ws:// to a public host from an https page, which
       * every browser refuses as mixed content. "blocked-browser": a ws://
       * this browser refuses where others allow it (Safari to this device,
       * Firefox and Safari to the LAN).
       */
      readonly code: "blocked-insecure" | "blocked-browser";
      readonly addressClass: AddressClass;
    };

/** Whether this page may open a plain ws:// to an address of this class. */
function plainAllowed(
  page: PageContext,
  where: AddressClass,
): true | "blocked-insecure" | "blocked-browser" {
  if (page.kind !== "secure") return true;
  if (where === "public") return "blocked-insecure";
  // Measured on 2026-10-24 (README): Chromium reaches both once Local Network
  // Access is granted, Firefox reaches loopback only. WebKit refuses ws:// to
  // loopback from https (WebKit bug 171934), hence the LAN too. An unknown
  // browser is let try: the session reports what it meets.
  switch (page.browser) {
    case "chromium":
    case "other":
      return true;
    case "firefox":
      return where === "loopback" ? true : "blocked-browser";
    case "safari":
      return "blocked-browser";
  }
}

/** The permission a secure page's sockets to this class wait on, if any. */
function permissionFor(
  page: PageContext,
  where: AddressClass,
): LocalNetworkPermissionName | null {
  if (page.kind !== "secure" || where === "public") return null;
  if (!(page.gated ?? page.browser === "chromium")) return null;
  return where === "loopback" ? "loopback-network" : "local-network";
}

/**
 * The static check made before any socket opens: the URLs worth trying for
 * this address from this page and the permission they may wait on, or why
 * none is worth trying.
 *
 * Without a scheme, archipelago.gg gets wss only (its room ports refuse
 * plain ws), and any other host wss then ws, as AP's own clients and
 * archipelago.js do, dropping ws where this page may not open it.
 */
export function connectPlan(
  address: ServerAddress,
  page: PageContext,
): ConnectPlan {
  const where = addressClass(address.host);
  const plain = plainAllowed(page, where);
  const permission = permissionFor(page, where);
  if (address.scheme === "wss") {
    return { ok: true, permission, urls: [serverUrl("wss", address)] };
  }
  if (address.scheme === "ws") {
    if (plain !== true) return { addressClass: where, code: plain, ok: false };
    return { ok: true, permission, urls: [serverUrl("ws", address)] };
  }
  const urls = [serverUrl("wss", address)];
  if (plain === true && !isArchipelagoGg(address.host)) {
    urls.push(serverUrl("ws", address));
  }
  return { ok: true, permission, urls };
}

/**
 * What will happen when this page reaches the address, said before any
 * socket opens, each with its way out (README, "Addresses and
 * connectivity"):
 * - "open": nothing stands in the way;
 * - "ask": the browser asks for its local network permission first (its
 *   state reads "prompt");
 * - "denied": the player refused that permission to the site;
 * - "blocked-insecure", "blocked-browser": `connectPlan`'s refusals.
 */
export type Reach =
  | { readonly kind: "open" }
  | {
      readonly kind: "ask";
      readonly permission: LocalNetworkPermissionName;
      readonly browser: BrowserFamily;
    }
  | {
      readonly kind: "denied";
      readonly permission: LocalNetworkPermissionName;
      readonly browser: BrowserFamily;
    }
  | { readonly kind: "blocked-insecure"; readonly addressClass: AddressClass }
  | {
      readonly kind: "blocked-browser";
      readonly addressClass: AddressClass;
      readonly browser: BrowserFamily;
    };

/** What the browser says of a permission: the state its Permissions API reads. */
export type PermissionStateName =
  | "granted"
  | "prompt"
  | "denied"
  | "unsupported";

/**
 * The pre-check: the plan for this address from this page, then what the
 * page knows of the permission it waits on (null while not read yet).
 */
export function reachOf(
  address: ServerAddress,
  page: PageContext,
  permission: PermissionStateName | null,
): Reach {
  const plan = connectPlan(address, page);
  if (!plan.ok) {
    return plan.code === "blocked-browser" && page.kind === "secure"
      ? {
          addressClass: plan.addressClass,
          browser: page.browser,
          kind: "blocked-browser",
        }
      : { addressClass: plan.addressClass, kind: "blocked-insecure" };
  }
  if (plan.permission === null || page.kind !== "secure") {
    return { kind: "open" };
  }
  const { browser } = page;
  if (permission === "denied") {
    return { browser, kind: "denied", permission: plan.permission };
  }
  if (permission === "prompt") {
    return { browser, kind: "ask", permission: plan.permission };
  }
  return { kind: "open" };
}

/** One slot of a room, as archipelago.gg's room status lists it. */
export interface RoomPlayer {
  readonly name: string;
  readonly game: string;
}

/** What `/api/room_status/<id>` says that the Room field needs. */
export interface RoomStatus {
  /** The port the room last ran on; null if it never ran. */
  readonly port: number | null;
  readonly players: readonly RoomPlayer[];
}

/** archipelago.gg's room status API, which allows the site's origin (CORS). */
export function roomStatusUrl(room: RoomLink): string {
  return `https://${ARCHIPELAGO_GG}/api/room_status/${encodeURIComponent(room.id)}`;
}

/** The room's page: opening it wakes a paused room. */
export function roomPageUrl(room: RoomLink): string {
  return `https://${ARCHIPELAGO_GG}/room/${encodeURIComponent(room.id)}`;
}

/**
 * Reads a room status body (WebHostLib/api/__init__.py `room_info`):
 * `{ players: [[name, game], ...], last_port, ... }`. Anything else is null:
 * the body comes from the network.
 */
export function parseRoomStatus(body: unknown): RoomStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const { last_port: lastPort, players } = body as Record<string, unknown>;
  if (!Array.isArray(players)) return null;
  const list: RoomPlayer[] = [];
  for (const entry of players) {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string"
    ) {
      return null;
    }
    list.push({ game: entry[1], name: entry[0] });
  }
  const port =
    typeof lastPort === "number" &&
    Number.isInteger(lastPort) &&
    lastPort > 0 &&
    lastPort <= 65_535
      ? lastPort
      : null;
  return { players: list, port };
}

/** The server address a room status points at, if the room ever ran. */
export function roomAddress(status: RoomStatus): ServerAddress | null {
  return status.port === null
    ? null
    : { host: ARCHIPELAGO_GG, port: status.port, scheme: null };
}

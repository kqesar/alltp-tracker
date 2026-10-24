// The session's user-facing states. Each carries a machine `code` and what
// the UI needs to say exactly what to do. README "Diagnostic codes" lists
// them with what triggers each.

import {
  type AddressClass,
  addressClass,
  type BrowserFamily,
  isArchipelagoGg,
} from "./address";

/**
 * Why the server refused the Connect (MultiServer.py, `ConnectionRefused`),
 * each recorded in test/fixtures/refused.json, password.json and
 * compatibility-0.json.
 */
export const REFUSAL_REASONS = [
  "InvalidSlot",
  "InvalidPassword",
  "IncompatibleVersion",
  "InvalidItemsHandling",
  "InvalidGame",
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/**
 * What most likely kept the socket from opening, from what is known:
 * - "offline": the device says it has no network;
 * - "room-paused": archipelago.gg failed again and again: rooms sleep after
 *   hours of inactivity, and opening the room's page wakes them;
 * - "no-tls": wss:// to a self-hosted server, which usually speaks ws only;
 * - "not-running": ws:// to this device or the LAN: no server listens there;
 * - "unknown": nothing narrows it down.
 */
export type UnreachableHint =
  | "offline"
  | "room-paused"
  | "no-tls"
  | "not-running"
  | "unknown";

/** Where a connection attempt stood when it ran out of time. */
export type TimeoutStage = "socket" | "room-info" | "login" | "keepalive";

/**
 * `retryInMs`: the wait before the next automatic attempt, or null when the
 * session waits for the player (fix the slot or password, click Retry).
 */
export type SessionStatus =
  | { readonly code: "idle" }
  | {
      /** Another tab of this browser holds the connection; this one follows it. */
      readonly code: "elsewhere";
    }
  | {
      /** ws:// to a public host from an https page: every browser refuses it. */
      readonly code: "blocked-insecure";
      readonly addressClass: AddressClass;
    }
  | {
      /** A ws:// this browser refuses where others allow it. */
      readonly code: "blocked-browser";
      readonly addressClass: AddressClass;
      readonly browser: BrowserFamily;
    }
  | {
      /** Opening the socket ("socket"), then waiting for RoomInfo ("room-info"). */
      readonly code: "connecting";
      readonly url: string;
      readonly attempt: number;
      readonly stage: "socket" | "room-info";
    }
  | {
      /** Connect sent, waiting for Connected or ConnectionRefused. */
      readonly code: "authenticating";
      readonly url: string;
      readonly attempt: number;
    }
  | {
      readonly code: "unreachable";
      readonly url: string;
      readonly attempt: number;
      readonly hint: UnreachableHint;
      readonly retryInMs: number | null;
    }
  | {
      readonly code: "timeout";
      readonly url: string;
      readonly attempt: number;
      readonly stage: TimeoutStage;
      readonly retryInMs: number | null;
    }
  | {
      /** The server said no: nothing changes until the player does. */
      readonly code: "refused";
      readonly url: string;
      /** The server's reasons, known ones first; others kept verbatim. */
      readonly reasons: readonly string[];
      /** RoomInfo's version, for IncompatibleVersion's explanation. */
      readonly serverVersion: string | null;
    }
  | { readonly code: "connected"; readonly url: string }
  | {
      /** A working connection dropped; the next attempt is scheduled. */
      readonly code: "reconnecting";
      readonly url: string;
      readonly attempt: number;
      readonly retryInMs: number | null;
    }
  | {
      /** The app's Archipelago chunk failed to load (set by the app). */
      readonly code: "unavailable";
      readonly detail: string;
    }
  | {
      readonly code: "stopped";
      /** Why the session stopped itself (the guard refused a packet), if it did. */
      readonly detail?: string;
    };

export type SessionCode = SessionStatus["code"];

/** Every code, in the order a successful session meets them. */
export const SESSION_CODES: readonly SessionCode[] = [
  "idle",
  "elsewhere",
  "blocked-insecure",
  "blocked-browser",
  "connecting",
  "authenticating",
  "unreachable",
  "timeout",
  "refused",
  "connected",
  "reconnecting",
  "unavailable",
  "stopped",
];

export function isRefusalReason(reason: string): reason is RefusalReason {
  return (REFUSAL_REASONS as readonly string[]).includes(reason);
}

/** archipelago.gg failures in a row before the session suspects a paused room. */
export const PAUSED_AFTER_FAILURES = 3;

/** Why a URL could not be reached, from what the session knows. */
export function unreachableHint(input: {
  readonly url: string;
  readonly online: boolean;
  /** Failed attempts in a row on this address, this one included. */
  readonly failures: number;
}): UnreachableHint {
  if (!input.online) return "offline";
  const match = /^(wss?):\/\/(\[[^\]]+\]|[^:/]+)/.exec(input.url);
  if (match === null) return "unknown";
  const [, scheme, host] = match;
  if (isArchipelagoGg(host)) {
    return input.failures >= PAUSED_AFTER_FAILURES ? "room-paused" : "unknown";
  }
  if (addressClass(host) === "public") {
    return scheme === "wss" ? "no-tls" : "unknown";
  }
  return scheme === "wss" ? "no-tls" : "not-running";
}

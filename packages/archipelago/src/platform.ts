// Typed seams over the host's globals. The sources compile against ES2022
// only, so every browser API they use is declared here, structurally, and
// looked up on globalThis at call time (test fakes installed later apply).

import type {
  LocalNetworkPermissionName,
  PermissionStateName,
} from "./address";

/** The part of the WHATWG WebSocket archipelago.js and this package use. */
export interface WebSocketLike {
  readonly url: string;
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose:
    | ((event: { readonly code: number; readonly reason: string }) => void)
    | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

/** Timers and the clock, so tests can drive them. */
export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

/** Page visibility: the keepalive pauses while hidden, a return retries. */
export interface Visibility {
  hidden(): boolean;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** `navigator.onLine` and its events: coming back online retries at once. */
export interface Online {
  online(): boolean;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/**
 * What the page knows of its local network permission: the shape of
 * `@alltp/autotrack`'s `systemPermission()`, which the app passes in. This
 * package queries no permission itself (it would be a second copy).
 */
export interface LocalNetworkPermission {
  query(): Promise<{
    readonly name: string | null;
    readonly state: PermissionStateName;
  }>;
  /** Calls `listener` when the state changes; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** The permission behind one name, made when a plan needs it. */
export type PermissionFactory = (
  name: LocalNetworkPermissionName,
) => LocalNetworkPermission;

/** No Permissions API: every state reads "unsupported", nothing changes. */
export const NO_PERMISSION: PermissionFactory = () => ({
  query: async () => ({ name: null, state: "unsupported" }),
  subscribe: () => () => {},
});

interface EventHost {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface Host extends Partial<EventHost> {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  WebSocket?: new (url: string) => WebSocketLike;
  document?: EventHost & { readonly visibilityState?: string };
  navigator?: { readonly onLine?: boolean };
  crypto?: { randomUUID?: () => string };
}

const host = globalThis as unknown as Host;

export const systemClock: Clock = {
  clearTimeout: (handle) => host.clearTimeout(handle),
  now: () => Date.now(),
  setTimeout: (callback, ms) => host.setTimeout(callback, ms),
};

/** The host's own WebSocket while withWebSocket() has swapped the global. */
let swapped: Host["WebSocket"] | null = null;

/** The host's WebSocket, or a factory that throws where there is none. */
export const systemWebSocket: WebSocketFactory = (url) => {
  const NativeWebSocket = swapped ?? host.WebSocket;
  if (NativeWebSocket === undefined) {
    throw new Error("This environment has no WebSocket");
  }
  return new NativeWebSocket(url);
};

/** `document.visibilityState`, or always visible outside a page. */
export const systemVisibility: Visibility = {
  hidden: () => host.document?.visibilityState === "hidden",
  subscribe(listener) {
    const doc = host.document;
    if (doc === undefined) return () => {};
    doc.addEventListener("visibilitychange", listener);
    return () => doc.removeEventListener("visibilitychange", listener);
  },
};

/** `navigator.onLine` with the window's online/offline events. */
export const systemOnline: Online = {
  online: () => host.navigator?.onLine !== false,
  subscribe(listener) {
    if (host.addEventListener === undefined) return () => {};
    host.addEventListener("online", listener);
    host.addEventListener("offline", listener);
    return () => {
      host.removeEventListener?.("online", listener);
      host.removeEventListener?.("offline", listener);
    };
  },
};

/** A random v4 UUID from the host's crypto. */
export function systemUuid(): string {
  const random = host.crypto?.randomUUID;
  if (random === undefined) {
    throw new Error("This environment has no crypto.randomUUID");
  }
  return random.call(host.crypto);
}

/**
 * Runs `create` while `globalThis.WebSocket` is `factory`, and puts the
 * original back before returning.
 *
 * archipelago.js has no option for its WebSocket: it reads the global one at
 * every connect, synchronously, from inside `login()`. Swapping the global
 * for that synchronous call is how this package hands it a socket it can
 * guard, time and close (README, "archipelago.js edges").
 */
export function withWebSocket<T>(
  factory: WebSocketFactory,
  create: () => T,
): T {
  const previous = host.WebSocket;
  // A plain function used with `new` returns the object it returns.
  function Injected(url: string | { toString(): string }) {
    return factory(String(url));
  }
  swapped = previous;
  host.WebSocket = Injected as unknown as Host["WebSocket"];
  try {
    return create();
  } finally {
    host.WebSocket = previous;
    swapped = null;
  }
}

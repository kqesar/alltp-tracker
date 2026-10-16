// Typed seams over the host's globals. The sources compile against ES2022
// only, so every browser API they use is declared here, structurally, and
// looked up on globalThis at call time (test fakes installed later apply).

/** The part of the WHATWG WebSocket this package uses. */
export interface WebSocketLike {
  binaryType: string;
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose:
    | ((event: { readonly code: number; readonly reason: string }) => void)
    | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

/** Timers and the clock, so tests can drive them. */
export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

/** Page visibility: polling pauses while the page is hidden. */
export interface Visibility {
  hidden(): boolean;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

interface Host {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  WebSocket?: new (url: string) => WebSocketLike;
  document?: {
    readonly visibilityState?: string;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  };
}

const host = globalThis as unknown as Host;

export const systemClock: Clock = {
  clearTimeout: (handle) => host.clearTimeout(handle),
  now: () => Date.now(),
  setTimeout: (callback, ms) => host.setTimeout(callback, ms),
};

/** The host's WebSocket, or a factory that throws where there is none. */
export const systemWebSocket: WebSocketFactory = (url) => {
  if (host.WebSocket === undefined) {
    throw new Error("This environment has no WebSocket");
  }
  return new host.WebSocket(url);
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

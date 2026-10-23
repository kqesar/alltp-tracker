// The followed view's side of live follow (docs/desktop.md, "Live follow on
// the LAN"): one WebSocket to the desktop app's relay, the run it sends
// checked and handed on, the timer's clock offset worked out, and the
// connection kept up through drops, with the relay's close codes said.

import { type GameId, isGameId, type RunStore } from "@/games/registry";

/** The largest run the relay passes on (`MAX_VALUE` in follow.rs). */
const MAX_VALUE = 1 << 20;

/**
 * The relay sends a beat every 15 s (follow.rs, `TIMING`): this long without
 * a frame, two beats missed, the connection is dead, though the browser may
 * still call it open (a phone that slept, a computer that left the network).
 */
export const STALE_AFTER = 35_000;

/** What the relay's close codes mean (follow.rs, `close`). */
export const CLOSE = {
  /** Eight devices already follow: retry later */
  FULL: 4503,
  /** The player turned live follow off, or quit the app: no retry */
  STOPPED: 4410,
  /** The token is not the running session's: the link is out of date */
  TOKEN: 4401,
} as const;

/** Where the connection stands, as the view's banner says it. */
export type FollowStatus =
  /** Opening the first connection, nothing received yet */
  | "connecting"
  /** Connected, the run received */
  | "live"
  /** The connection dropped: trying again */
  | "reconnecting"
  /** Too many devices follow: trying again */
  | "full"
  /** The player stopped sharing (4410) */
  | "stopped"
  /** The link's token is not the running session's (4401) */
  | "expired";

/** One run as the relay sends it, checked. */
export type Snapshot = {
  game: GameId;
  /** The game's persisted run, a JSON string the game's store reads */
  value: string;
  /** The player's computer's clock when it was sent, ms since the epoch */
  sentAt: number;
};

/**
 * A frame from the relay, checked: a known game, a run that is JSON and no
 * larger than the relay allows, a finite instant. Anything else is null and
 * ignored. The frame's `key` is not read: the run is written under the
 * game's own key, never one the wire names.
 */
export const parseSnapshot = (data: unknown): Snapshot | null => {
  if (typeof data !== "string") return null;
  try {
    const frame: unknown = JSON.parse(data);
    if (typeof frame !== "object" || frame === null) return null;
    const { game, sentAt, value } = frame as Record<string, unknown>;
    if (!isGameId(game)) return null;
    if (typeof value !== "string" || value.length > MAX_VALUE) return null;
    if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) return null;
    JSON.parse(value);
    return { game, sentAt, value };
  } catch {
    return null;
  }
};

/**
 * Write a received run under its game's key, then reload the store from it:
 * the game's own validation, migration and history reset judge it, as when
 * another tab changed it.
 * @returns Whether storage took it
 */
export const applySnapshot = (value: string, store: RunStore): boolean => {
  const key = store.persist.getOptions().name;
  if (!key) return false;
  try {
    localStorage.setItem(key, value);
  } catch {
    return false;
  }
  void store.persist.rehydrate();
  return true;
};

/**
 * The wait before the next attempt: 1 s, doubling, at most 30 s; at least
 * 5 s while the relay is full, which frees a seat only when a device leaves.
 * @param attempt - How many attempts failed in a row, from 0
 */
export const retryDelay = (attempt: number, full = false): number => {
  const delay = Math.min(30_000, 1000 * 2 ** attempt);
  return full ? Math.max(5000, delay) : delay;
};

export type FollowOptions = {
  /** The relay's stream, `followSocketUrl()` */
  url: string;
  /**
   * Each run received, and how far the player's clock is ahead of this
   * device's, in ms
   */
  onSnapshot: (snapshot: Snapshot, clockOffset: number) => void;
  onStatus: (status: FollowStatus) => void;
  /** Opens a socket; the browser's WebSocket by default */
  open?: (url: string) => WebSocket;
};

/**
 * Follow the relay: connect, hand on each run, and on a drop try again
 * after `retryDelay`, at once when the device comes back online or the page
 * comes back into view (a phone that slept). A connection silent for
 * `STALE_AFTER` (no run, no beat) counts as a drop: closed and tried again.
 * The token refused or the relay stopped ends it.
 *
 * The clock offset is the largest `sentAt − arrival` seen: latency only makes
 * a sample smaller, so the largest is the closest. The run sent on connecting
 * is the relay's last, possibly minutes old, which this also discounts; the
 * desktop app sends a fresh one as each device joins.
 * @returns A function that stops following
 */
export const follow = ({
  onSnapshot,
  onStatus,
  open = (url) => new WebSocket(url),
  url,
}: FollowOptions): (() => void) => {
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let ended = false;
  let clockOffset = Number.NEGATIVE_INFINITY;
  // When the open socket last said anything, and the timer that gives up on it
  let heard = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const retryLater = (full: boolean) => {
    onStatus(full ? "full" : "reconnecting");
    retry = setTimeout(connect, retryDelay(attempt, full));
    attempt += 1;
  };

  // The open socket fell silent: close it (its late close is ignored) and
  // try again, as after a drop
  const abandon = () => {
    const current = socket;
    if (!current) return;
    socket = null;
    clearTimeout(watchdog);
    current.close();
    retryLater(false);
  };

  const hear = () => {
    heard = Date.now();
    clearTimeout(watchdog);
    watchdog = setTimeout(abandon, STALE_AFTER);
  };

  const connect = () => {
    retry = undefined;
    const current = open(url);
    socket = current;
    hear();
    current.onmessage = (event: MessageEvent) => {
      if (socket !== current) return;
      hear();
      // A beat is no run: it only proves the connection lives
      const snapshot = parseSnapshot(event.data);
      if (!snapshot) return;
      attempt = 0;
      clockOffset = Math.max(clockOffset, snapshot.sentAt - Date.now());
      onStatus("live");
      onSnapshot(snapshot, clockOffset);
    };
    current.onclose = (event: CloseEvent) => {
      if (socket !== current || ended) return;
      socket = null;
      clearTimeout(watchdog);
      if (event.code === CLOSE.TOKEN || event.code === CLOSE.STOPPED) {
        ended = true;
        stopListening();
        onStatus(event.code === CLOSE.TOKEN ? "expired" : "stopped");
        return;
      }
      retryLater(event.code === CLOSE.FULL);
    };
  };

  // Back online or in view: a socket silent too long (its timer held back
  // while the page slept) is dropped, and a pending attempt runs now
  const now = () => {
    if (ended) return;
    if (socket && Date.now() - heard >= STALE_AFTER) abandon();
    if (retry === undefined) return;
    clearTimeout(retry);
    connect();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") now();
  };
  const stopListening = () => {
    window.removeEventListener("online", now);
    document.removeEventListener("visibilitychange", onVisible);
  };

  window.addEventListener("online", now);
  document.addEventListener("visibilitychange", onVisible);
  onStatus("connecting");
  connect();

  return () => {
    ended = true;
    stopListening();
    clearTimeout(retry);
    clearTimeout(watchdog);
    socket?.close();
    socket = null;
  };
};

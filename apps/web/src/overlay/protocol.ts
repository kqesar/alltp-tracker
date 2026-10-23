// The overlay API's protocol, version 1 (docs/overlay-api.md): what the
// desktop app's `/overlay` WebSocket tells stream tools. The page computes the
// state and the events from a race-safe whitelist (`games/<id>/overlay.ts`)
// and hands them to the app (`overlay_publish`), which numbers and relays
// them; the types here are that contract. A client ignores the fields and
// the event types it does not know: version 1 only ever grows by them.

import type { GameId } from "@/games/registry";

/** The `v` of every frame. */
export const OVERLAY_VERSION = 1;

/** The WebSocket route of the overlay API, on the stream's port. */
export const OVERLAY_PATH = "/overlay";

/**
 * The address a stream tool connects to, from the stream's own (`address` or
 * `lanAddress` of a session, `http://host:port/`) and the API's token. The
 * token rides in the query, as tools that take only an address need; a page
 * of a browser source should offer it as the subprotocol `alltp.<token>`
 * instead and keep it out of the address.
 */
export const overlayUrl = (base: string, token: string): string => {
  const url = new URL(OVERLAY_PATH, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.href;
};

/** An item the run holds, at a level: 0 not held, up to `max`. */
export type OverlayItem = {
  /** The id a client keys on, stable (docs/overlay-api.md, "Ids per game") */
  id: string;
  /** The item's name, for a label */
  name: string;
  /** 0 when not held; a count or a level for a progressive item or a pack */
  level: number;
  /** The highest `level` */
  max: number;
};

/** A goal of the run, a boss or an objective, done or not. */
export type OverlayObjective = {
  id: string;
  name: string;
  done: boolean;
  /** The run timer's reading when it was done; null when unknown */
  ms: number | null;
};

/** Where the run timer stands. */
export type OverlayTimerState = "idle" | "running" | "paused" | "finished";

/**
 * The run timer, as data a client counts itself: the time shown is
 * `elapsedMs`, plus `now - startedAt` while it runs, `now` being the app's
 * clock (the `beat` frame's), so the client's own clock never matters.
 */
export type OverlayTimer = {
  state: OverlayTimerState;
  /** Counted before `startedAt` */
  elapsedMs: number;
  /** When it (re)started on the app's clock, ms since the epoch; null unless running */
  startedAt: number | null;
};

/** Whether every step to the goal is in logic: yes, possible, not yet. */
export type OverlayGoMode = "yes" | "maybe" | "no";

/** What the run holds, from the whitelist alone. */
export type OverlayState = {
  game: GameId;
  items: OverlayItem[];
  objectives: OverlayObjective[];
  /** Null for a game with no run timer */
  timer: OverlayTimer | null;
  /** Null when the game or the run has none, or it is not known yet */
  goMode: OverlayGoMode | null;
};

/** What a game's `overlay.ts` reads off its run. */
export type OverlayReading = {
  state: OverlayState;
  /**
   * The run is as a new one starts (nothing found, nothing done, the timer
   * idle): what makes a fall back to it a `reset`.
   */
  fresh: boolean;
};

/** A game's side of the API: its run, as the whitelist reads it. */
export type OverlaySource = {
  read: () => OverlayReading;
  /** Calls `listener` after each change to the run; returns what stops it */
  subscribe: (listener: () => void) => () => void;
};

export type OverlayTimerAction =
  | "start"
  | "pause"
  | "resume"
  | "finish"
  | "reset";

/** What changed between two states. */
export type OverlayEvent =
  | {
      type: "item";
      id: string;
      name: string;
      level: number;
      previous: number;
      /** The run timer's reading at the change (counting, paused or stopped); null before it starts or with no timer */
      ms: number | null;
    }
  | {
      type: "objective";
      id: string;
      name: string;
      done: boolean;
      ms: number | null;
    }
  | { type: "timer"; action: OverlayTimerAction }
  | {
      type: "goMode";
      goMode: OverlayGoMode | null;
      previous: OverlayGoMode | null;
    }
  | { type: "reset" };

/** The frames the app sends. `seq` counts the app's publications, from 1. */
export type OverlayFrame =
  | { v: 1; type: "state"; seq: number; state: OverlayState }
  | {
      v: 1;
      type: "update";
      seq: number;
      state: OverlayState;
      events: OverlayEvent[];
    }
  | { v: 1; type: "beat"; seq: number; now: number };

/** What the page hands the app: both as JSON text (`overlay_publish`). */
export type OverlayPublication = { state: string; events: string };

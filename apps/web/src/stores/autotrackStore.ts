import type {
  BridgeInfo,
  DeviceDescriptor,
  Environment,
  SessionOptions,
  SessionStatus,
} from "@alltp/autotrack";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Follower } from "@/autotrack/follow";
import type { AutotrackReading } from "@/autotrack/reading";
import type { Runtime, RuntimeSink } from "@/autotrack/runtime";
import { shownStatus } from "@/autotrack/status";
import { bridgeUrl, isObsView } from "@/utils/view";

type AutotrackState = {
  /**
   * Connect as the tracker opens. Connect sets it and Disconnect clears it,
   * so a player who autotracks once finds it on at the next visit, on this
   * device. The only field saved.
   */
  connectOnStart: boolean;
  /** A session runs, or loads: from Connect until Disconnect. */
  active: boolean;
  /**
   * Another tab of the tracker holds the session: this one waits, and takes
   * over when that one closes or disconnects.
   */
  elsewhere: boolean;
  /** The session's status, as it reports it (the diagnostic report's). */
  status: SessionStatus;
  /** The status the UI shows: a retry keeps the failure it retries. */
  shown: SessionStatus;
  /** When the session entered `status`, in ms since the epoch. */
  since: number;
  /** The bridge and the devices it listed, as last seen. */
  bridge: BridgeInfo | null;
  devices: readonly DeviceDescriptor[];
  /** The system and browser, once detected. */
  environment: Environment | null;
  /** The game as last read, or null before the first read. */
  reading: AutotrackReading | null;
  /**
   * The session's code could not be fetched: offline before it was ever
   * cached, or a release since this page loaded replaced it.
   */
  unavailable: boolean;
  setConnectOnStart: (connectOnStart: boolean) => void;
};

const IDLE: SessionStatus = { code: "idle" };
const STOPPED: SessionStatus = { code: "stopped" };

/**
 * Autotracking's state: the session's status and what it read. Kept apart
 * from the game store, so a status change never re-renders the board, and
 * nothing of it is saved but the player's wish to connect on start.
 */
export const useAutotrackStore = create<AutotrackState>()(
  persist(
    (set) => ({
      active: false,
      bridge: null,
      connectOnStart: false,
      devices: [],
      elsewhere: false,
      environment: null,
      reading: null,
      setConnectOnStart: (connectOnStart) => set({ connectOnStart }),
      shown: IDLE,
      since: 0,
      status: IDLE,
      unavailable: false,
    }),
    {
      name: "alltp-tracker-autotrack",
      partialize: ({ connectOnStart }) => ({ connectOnStart }),
      version: 1,
    },
  ),
);

const set = useAutotrackStore.setState;

/** The one session of this page, once started. */
let runtime: Runtime | null = null;

/** The board's side of the session: what it read, laid on the run. */
let follower: Follower | null = null;

/**
 * Bumped by every connect and stop: a start that loses a race with a stop
 * (a double click, StrictMode's double effect) finds it changed and gives up.
 */
let generation = 0;

/** Session options of the tests' own: a transport, a clock... */
let overrides: Partial<Omit<SessionOptions, "pack">> = {};

/**
 * Replace the session's defaults (the usb2snes transport at the bridge's
 * address, the system clock, permission and visibility). For tests.
 */
export const setAutotrackOptions = (
  options: Partial<Omit<SessionOptions, "pack">>,
) => {
  overrides = options;
};

const loadRuntime = () => import("@/autotrack/runtime");

/**
 * Fetch the session's code ahead of a click on Connect: the dialog asks as it
 * opens, so the connection starts in the same moment as the click, while the
 * browser still counts it as the player's (its permission prompt answers one).
 */
export const preloadAutotrack = () => {
  loadRuntime().catch(() => {});
};

/**
 * Reports from the runtime of `mine`. A status from one since stopped (the
 * "stopped" its stop() reports) is dropped: what replaced it decides.
 */
const sinkFor = (mine: number): RuntimeSink => ({
  // A stopped session never reads again: no reading outlives its session
  reading: (reading) => {
    if (mine !== generation) return;
    set({ reading });
    follower?.read(reading);
  },
  status: (status, since, { bridge, devices }) => {
    if (mine !== generation) return;
    set((state) => ({
      // The session stops itself on a bug only (a read Race Mode refused)
      ...(status.code === "stopped" && { active: false }),
      bridge,
      devices,
      shown: shownStatus(state.shown, status),
      since,
      status,
    }));
  },
});

/** The Web Lock one tab of the tracker holds while it autotracks. */
const LOCK = "alltp-tracker-autotrack";

/** Lets the lock go, while this page holds it. */
let releaseLock: (() => void) | null = null;

/** Stops waiting for the lock, while this page waits. */
let stopWaiting: AbortController | null = null;

/**
 * Take the autotracking lock: at once when no other tab of the tracker holds
 * it, else when that tab lets it go (it closes, or disconnects), saying so
 * meanwhile. Two tabs never both read the game and lay it on the run. A
 * browser without Web Locks goes ahead, as before them.
 * @param mine - The connect taking it
 * @returns Whether it holds the lock; false once stopped
 */
const takeLock = async (mine: number): Promise<boolean> => {
  const locks = (navigator as { locks?: LockManager }).locks;
  if (locks === undefined) return true;
  const request = (options: LockOptions) =>
    new Promise<boolean>((resolve) => {
      locks
        .request(LOCK, options, (lock) => {
          // Not free, or no longer wanted: let it go at once
          if (lock === null || mine !== generation) {
            resolve(false);
            return;
          }
          resolve(true);
          return new Promise<void>((release) => {
            releaseLock = release;
          });
        })
        .catch(() => resolve(false));
    });
  if (await request({ ifAvailable: true })) return true;
  if (mine !== generation) return false;
  set({ elsewhere: true });
  stopWaiting = new AbortController();
  const held = await request({ signal: stopWaiting.signal });
  if (mine === generation) set({ elsewhere: false });
  return held;
};

/**
 * Start autotracking: load the session's code if needed, then connect, and
 * keep connecting until Disconnect. Never more than one session: a second
 * call while one runs does nothing, and across the tracker's tabs the first
 * to connect holds the session while the others wait (`elsewhere`). The
 * stream view (`?view=obs`) never connects: the tracker it shows on stream
 * holds the session, and the view follows the run through the shared
 * storage.
 */
export const connectAutotrack = async () => {
  if (isObsView() || useAutotrackStore.getState().active) return;
  const mine = ++generation;
  set({
    active: true,
    connectOnStart: true,
    elsewhere: false,
    reading: null,
    shown: IDLE,
    status: IDLE,
    unavailable: false,
  });
  try {
    const loading = loadRuntime();
    // Waiting for another tab must not leave a failed fetch unhandled
    loading.catch(() => {});
    if (!(await takeLock(mine))) return;
    const { createFollower, detectEnvironment, startRuntime } = await loading;
    const environment =
      useAutotrackStore.getState().environment ?? (await detectEnvironment());
    if (mine !== generation) return;
    set({ environment });
    const url = bridgeUrl();
    follower = createFollower();
    runtime = startRuntime(
      { environment, ...(url === undefined ? {} : { url }), ...overrides },
      sinkFor(mine),
    );
  } catch {
    if (mine === generation) set({ active: false, unavailable: true });
  }
};

/**
 * Stop the session, if any, and forget what it read; the wish to connect on
 * start stays. The tracker calls it as it goes away.
 */
export const stopAutotrack = () => {
  generation++;
  runtime?.stop();
  runtime = null;
  follower = null;
  stopWaiting?.abort();
  stopWaiting = null;
  releaseLock?.();
  releaseLock = null;
  set({
    active: false,
    elsewhere: false,
    reading: null,
    shown: STOPPED,
    since: Date.now(),
    status: STOPPED,
  });
};

/** Stop autotracking at the player's word: no reconnection on the next visit. */
export const disconnectAutotrack = () => {
  stopAutotrack();
  set({ connectOnStart: false, unavailable: false });
};

/** Retry now rather than after the session's wait. */
export const retryAutotrack = () => runtime?.retryNow();

/**
 * Set the board to what the game holds, the player's marks beyond it
 * included: one undo step.
 * @returns How many values changed, or null before any game in play was read
 */
export const syncFromGame = (): number | null => follower?.sync() ?? null;

// Super Metroid's autotracking: the one session per page, loaded lazily on
// Connect, its status and last reading. Only `connectOnStart` is saved, under
// its own key: a device that connected once connects again as the tracker
// opens. Across the tracker's tabs one session, whatever the game: the tab
// that runs it holds the shared Web Lock (autotrack/lock.ts), another waits.
//
// It follows ALttPR's autotracking store (games/alttpr/stores/
// autotrackStore.ts) without its seed checks: a Map Rando ROM says its own
// objectives and settings, which the follower lays on the run.

import type {
  BridgeInfo,
  DeviceDescriptor,
  Environment,
  SessionOptions,
  SessionStatus,
} from "@alltp/autotrack";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAutotrackLock } from "@/autotrack/lock";
import { shownStatus } from "@/autotrack/status";
import type { SmReading } from "@/games/sm/autotrack/reading";
import type { SmRuntime } from "@/games/sm/autotrack/runtime";
import { bridgeUrl, isObsView } from "@/utils/view";

type SmAutotrackState = {
  /** A session runs, or is starting. */
  active: boolean;
  /** Connect as the tracker opens: the player connected last time. */
  connectOnStart: boolean;
  /** Another tab of the tracker holds the session: this one waits. */
  elsewhere: boolean;
  environment: Environment | null;
  /** The session's latest status, and the one shown (`shownStatus`). */
  status: SessionStatus;
  shown: SessionStatus;
  since: number;
  seen: {
    readonly bridge: BridgeInfo | null;
    readonly devices: readonly DeviceDescriptor[];
  };
  reading: SmReading | null;
  /** The session's code could not be loaded. */
  unavailable: boolean;
};

const IDLE: SessionStatus = { code: "idle" };
const STOPPED: SessionStatus = { code: "stopped" };

export const useSmAutotrackStore = create<SmAutotrackState>()(
  persist(
    (): SmAutotrackState => ({
      active: false,
      connectOnStart: false,
      elsewhere: false,
      environment: null,
      reading: null,
      seen: { bridge: null, devices: [] },
      shown: IDLE,
      since: Date.now(),
      status: IDLE,
      unavailable: false,
    }),
    {
      name: "alltp-tracker-sm-autotrack",
      partialize: ({ connectOnStart }) => ({ connectOnStart }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const set = useSmAutotrackStore.setState;

let runtime: SmRuntime | null = null;
/** Bumped by each connect and stop: a late answer of an older one is dropped. */
let generation = 0;
const lock = createAutotrackLock();

/** Session options of the tests' own: a transport, a clock... */
let overrides: Partial<SessionOptions> = {};

/** For tests: what the next sessions are started with. */
export const setSmAutotrackOptions = (options: Partial<SessionOptions>) => {
  overrides = options;
};

const loadRuntime = () => import("@/games/sm/autotrack/runtime");

/**
 * Start autotracking: load the session's code, take the lock, connect, and
 * keep connecting until Disconnect. A second call while one runs does
 * nothing; the stream view never connects.
 */
export const connectSmAutotrack = async () => {
  if (isObsView() || useSmAutotrackStore.getState().active) return;
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
    const held = await lock.take(
      () => mine === generation,
      (elsewhere) => set({ elsewhere }),
    );
    if (!held) return;
    const { createSmFollower, detectEnvironment, startSmRuntime } =
      await loading;
    const environment =
      useSmAutotrackStore.getState().environment ?? (await detectEnvironment());
    if (mine !== generation) return;
    set({ environment });
    const url = bridgeUrl();
    const follower = createSmFollower();
    runtime = startSmRuntime(
      { environment, ...(url === undefined ? {} : { url }), ...overrides },
      {
        reading: (reading) => {
          if (mine !== generation) return;
          set({ reading });
          follower.read(reading);
        },
        status: (status, since, seen) => {
          if (mine !== generation) return;
          set((state) => ({
            seen,
            shown: shownStatus(state.shown, status),
            since,
            status,
          }));
          // The session stopped itself: no longer active
          if (status.code === "stopped") set({ active: false });
        },
      },
    );
  } catch {
    if (mine === generation) set({ active: false, unavailable: true });
  }
};

/** Stop the session, if any; the wish to connect on start stays. */
export const stopSmAutotrack = () => {
  generation++;
  runtime?.stop();
  runtime = null;
  lock.release();
  set({
    active: false,
    elsewhere: false,
    reading: null,
    shown: STOPPED,
    since: Date.now(),
    status: STOPPED,
  });
};

/** Stop at the player's word: no reconnection on the next visit. */
export const disconnectSmAutotrack = () => {
  stopSmAutotrack();
  set({ connectOnStart: false, unavailable: false });
};

/** Retry now rather than after the session's wait. */
export const retrySmAutotrack = () => runtime?.retryNow();

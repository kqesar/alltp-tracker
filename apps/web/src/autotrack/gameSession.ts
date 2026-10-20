// A game's autotracking: the one session per page, loaded lazily on Connect,
// its status and last reading. Only `connectOnStart` is saved, under the
// game's key: a device that connected once connects again as the tracker
// opens. Across the tracker's tabs one session, whatever the game: the tab
// that runs it holds the shared Web Lock (autotrack/lock.ts), another waits.
//
// Super Metroid and SMZ3 build theirs with it. It follows ALttPR's
// autotracking store (games/alttpr/stores/autotrackStore.ts) without its seed
// checks: these ROMs state their own settings, which each game's follower
// lays on the run.

import type {
  BridgeInfo,
  DeviceDescriptor,
  Environment,
  SessionOptions,
  SessionStatus,
} from "@alltp/autotrack";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { bridgeOptions } from "@/autotrack/bridge";
import { createAutotrackLock } from "@/autotrack/lock";
import { shownStatus } from "@/autotrack/status";
import { isObsView } from "@/utils/view";

/** What a bridge listed, as the session last saw it. */
export type SessionSeen = {
  readonly bridge: BridgeInfo | null;
  readonly devices: readonly DeviceDescriptor[];
};

/** Where a game's runtime reports to. */
export type GameRuntimeSink<Reading> = {
  /** Every status change, with when it began and what the bridge listed. */
  status: (status: SessionStatus, since: number, seen: SessionSeen) => void;
  /** The game, decoded again after every read that changed memory. */
  reading: (reading: Reading) => void;
};

/** A running session, as the store drives it. */
export type GameRuntime = {
  retryNow: () => void;
  stop: () => void;
};

/** What a game's runtime chunk gives: its session, and what follows it. */
export type GameRuntimeModule<Reading> = {
  detectEnvironment: () => Promise<Environment>;
  start: (
    options: Omit<SessionOptions, "pack"> & {
      readonly environment: Environment;
    },
    sink: GameRuntimeSink<Reading>,
  ) => GameRuntime;
  /** What lays the readings on the run, for one session. */
  createFollower: () => { read: (reading: Reading) => void };
};

export type GameAutotrackState<Reading> = {
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
  seen: SessionSeen;
  reading: Reading | null;
  /** The session's code could not be loaded. */
  unavailable: boolean;
};

const IDLE: SessionStatus = { code: "idle" };
const STOPPED: SessionStatus = { code: "stopped" };

/**
 * A game's autotracking store and its actions.
 * @param storageKey - Where the wish to connect on start is saved
 * @param load - Imports the game's runtime chunk
 * @param seed - What the board tracks, as headlines name it: "a Map Rando seed"
 */
export const createGameAutotrack = <Reading>({
  load,
  seed,
  storageKey,
}: {
  load: () => Promise<GameRuntimeModule<Reading>>;
  seed: string;
  storageKey: string;
}) => {
  const useStore = create<GameAutotrackState<Reading>>()(
    persist(
      (): GameAutotrackState<Reading> => ({
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
        name: storageKey,
        partialize: ({ connectOnStart }) => ({ connectOnStart }),
        storage: createJSONStorage(() => localStorage),
      },
    ),
  );
  const set = useStore.setState;

  let runtime: GameRuntime | null = null;
  /** Bumped by each connect and stop: a late answer of an older one is dropped. */
  let generation = 0;
  const lock = createAutotrackLock();
  /** Session options of the tests' own: a transport, a clock... */
  let overrides: Partial<SessionOptions> = {};

  /**
   * Start autotracking: load the session's code, take the lock, connect, and
   * keep connecting until Disconnect. A second call while one runs does
   * nothing; the stream view never connects.
   */
  const connect = async () => {
    if (isObsView() || useStore.getState().active) return;
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
      const loading = load();
      // Waiting for another tab must not leave a failed fetch unhandled
      loading.catch(() => {});
      const held = await lock.take(
        () => mine === generation,
        (elsewhere) => set({ elsewhere }),
      );
      if (!held) return;
      const { createFollower, detectEnvironment, start } = await loading;
      const environment =
        useStore.getState().environment ?? (await detectEnvironment());
      const bridge = await bridgeOptions();
      if (mine !== generation) return;
      set({ environment });
      const follower = createFollower();
      runtime = start(
        { environment, ...bridge, ...overrides },
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
  const stop = () => {
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

  return {
    connect,
    /** Stop at the player's word: no reconnection on the next visit. */
    disconnect: () => {
      stop();
      set({ connectOnStart: false, unavailable: false });
    },
    /** Retry now rather than after the session's wait. */
    retry: () => runtime?.retryNow(),
    seed,
    /** For tests: what the next sessions are started with. */
    setOptions: (options: Partial<SessionOptions>) => {
      overrides = options;
    },
    stop,
    useStore,
  };
};

/** A game's autotracking, as createGameAutotrack builds it. */
export type GameAutotrack<Reading> = ReturnType<
  typeof createGameAutotrack<Reading>
>;

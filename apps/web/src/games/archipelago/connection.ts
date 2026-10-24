// The Archipelago board's connection: where the room is, which slot, whether
// to connect as the tracker opens (saved under its own key, device-only:
// never published, exported or put in a report), the password (this tab's
// session storage, and this device's local storage only when the player asks
// it remembered), and the one session per page with its status. Across the
// tabs of a browser one connection: the tab that holds the Web Lock
// `alltp-tracker-archipelago` connects, the others follow its run through
// storage and take over when it lets go.

import {
  type BrowserFamily,
  type PageContext,
  parseAddress,
  type SessionStatus,
  type Timeouts,
  type WebSocketFactory,
} from "@alltp/archipelago";
import { parseUserAgent } from "@alltp/autotrack";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createTabLock } from "@/autotrack/lock";
import { nameCache } from "@/games/archipelago/datapackageCache";
import { useApNamesStore } from "@/games/archipelago/names";
import type { Runtime } from "@/games/archipelago/runtime";
import { sameRun, useArchipelagoStore } from "@/games/archipelago/store";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";
import { isDesktopApp } from "@/utils/platform";
import { isObsView } from "@/utils/view";

/** Where the connection's settings are saved: device-only. */
export const AP_CONNECTION_KEY = "alltp-tracker-archipelago-connection";

/** Where the password is kept: this tab, and this device when remembered. */
export const AP_PASSWORD_KEY = "alltp-tracker-archipelago-password";

/** The Web Lock one tab of the browser holds while connected to the room. */
export const AP_LOCK = "alltp-tracker-archipelago";

/**
 * The saved settings' shape: what another version or a hand edit left in
 * storage is checked before it reaches the store, and dropped whole when it
 * does not hold (the player types the room again).
 */
const savedSchema = z.object({
  /** The Room field as the player typed it, a room link resolved. */
  address: z.string(),
  connectOnStart: z.boolean(),
  rememberPassword: z.boolean(),
  /** The archipelago.gg room link the address came from, for its page. */
  roomLink: z.nullable(z.string()),
  /** The slot name, case-sensitive. */
  slot: z.string(),
  /** This device's id in the room (archipelago.js would share one per page). */
  uuid: z.nullable(z.string()),
});

type Saved = z.infer<typeof savedSchema>;

export type ConnectionState = Saved & {
  /** A session runs, or is starting. */
  active: boolean;
  status: SessionStatus;
  since: number;
  /** The session's code could not be loaded. */
  unavailable: boolean;
  /** What the board says once, as a run of another room replaced it. */
  notice: string | null;
};

const IDLE: SessionStatus = { code: "idle" };

export const useApConnectionStore = create<ConnectionState>()(
  persist(
    (): ConnectionState => ({
      active: false,
      address: "",
      connectOnStart: false,
      notice: null,
      rememberPassword: false,
      roomLink: null,
      since: Date.now(),
      slot: "",
      status: IDLE,
      unavailable: false,
      uuid: null,
    }),
    {
      merge: (saved, current) => {
        const parsed = savedSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
      name: AP_CONNECTION_KEY,
      partialize: ({
        address,
        connectOnStart,
        rememberPassword,
        roomLink,
        slot,
        uuid,
      }): Saved => ({
        address,
        connectOnStart,
        rememberPassword,
        roomLink,
        slot,
        uuid,
      }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const set = useApConnectionStore.setState;

/** Storage that refuses (a private window, blocked site data) reads as empty. */
const safely = <T>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

/** The password: this tab's, else this device's when remembered. */
export const readPassword = (): string =>
  safely(
    () =>
      sessionStorage.getItem(AP_PASSWORD_KEY) ??
      localStorage.getItem(AP_PASSWORD_KEY) ??
      "",
    "",
  );

/**
 * Keep the password for this tab, and on this device only when `remember`:
 * forgetting it there takes it out of local storage at once.
 */
export const savePassword = (password: string, remember: boolean) => {
  safely(() => {
    if (password === "") sessionStorage.removeItem(AP_PASSWORD_KEY);
    else sessionStorage.setItem(AP_PASSWORD_KEY, password);
    if (remember && password !== "") {
      localStorage.setItem(AP_PASSWORD_KEY, password);
    } else {
      localStorage.removeItem(AP_PASSWORD_KEY);
    }
  }, undefined);
  set({ rememberPassword: remember });
};

/** Where the board runs, as the package's connect plan reads it. */
export const pageContext = (
  protocol: string = window.location.protocol,
  userAgent: string = navigator.userAgent,
): PageContext => {
  if (isDesktopApp) return { kind: "desktop" };
  if (protocol !== "https:") return { kind: "insecure" };
  const browser: BrowserFamily = parseUserAgent(userAgent).browser;
  return { browser, kind: "secure" };
};

/** This device's id in the room, made once and kept. */
const deviceUuid = () => {
  const saved = useApConnectionStore.getState().uuid;
  if (saved !== null) return saved;
  const uuid = crypto.randomUUID();
  set({ uuid });
  return uuid;
};

let runtime: Runtime | null = null;
/** The room the running session was started with. */
const watched = { address: "", slot: "" };
/** Bumped by each connect and stop: a late answer of an older one is dropped. */
let generation = 0;
const lock = createTabLock(AP_LOCK);
/** Tests' own sockets and timers. */
let overrides: { webSocket?: WebSocketFactory; timeouts?: Partial<Timeouts> } =
  {};
const importRuntime = () => import("@/games/archipelago/runtime");
/** Loads the session's chunk; tests may fail it. */
let loadRuntime = importRuntime;

/**
 * Connect to the room saved: load the session's code, take the lock (another
 * tab may hold it: this one says so and waits), and keep connecting until
 * Disconnect. A second call while one runs does nothing; the stream view
 * never connects, and nothing does without a server address and a slot.
 */
export const connect = async () => {
  const state = useApConnectionStore.getState();
  if (isObsView() || state.active) return;
  const parsed = parseAddress(state.address);
  if (!parsed.ok || parsed.kind !== "server" || state.slot === "") return;
  const mine = ++generation;
  watched.address = state.address;
  watched.slot = state.slot;
  set({
    active: true,
    connectOnStart: true,
    notice: null,
    since: Date.now(),
    status: IDLE,
    unavailable: false,
  });
  try {
    const { startRuntime } = await loadRuntime();
    if (mine !== generation) return;
    const stored = useArchipelagoStore.getState();
    runtime = startRuntime(
      {
        address: parsed.address,
        cache: nameCache,
        checksum: stored.room?.checksum ?? null,
        lock,
        page: pageContext(),
        password: readPassword(),
        slot: state.slot,
        uuid: deviceUuid(),
        ...overrides,
      },
      {
        groups: (groups) => {
          if (mine === generation) useApNamesStore.setState({ groups });
        },
        names: (names) => {
          if (mine === generation) useApNamesStore.setState({ names });
        },
        run: (run) => {
          if (mine !== generation || run.room === null) return;
          const before = useArchipelagoStore.getState();
          const same = before.room !== null && sameRun(before.room, run.room);
          // The same run's list only grows: a shorter one is the moment
          // between Connected and the items it resends
          if (same && run.received < before.received) return;
          if (before.room !== null && !same) {
            set({
              notice:
                "This room holds another run than the board did: the board now shows this one.",
            });
          }
          before.apply({ ...run, updatedAt: Date.now() });
        },
        status: (status, since) => {
          if (mine !== generation) return;
          set({ since, status });
          // The session stopped itself (its guard refused a packet)
          if (status.code === "stopped") set({ active: false });
        },
      },
    );
  } catch {
    if (mine === generation) {
      set({
        active: false,
        status: { code: "unavailable", detail: "the page could not load it" },
        unavailable: true,
      });
    }
  }
};

/** Stop the session, if any; the wish to connect on start stays. */
export const stop = () => {
  generation++;
  runtime?.stop();
  runtime = null;
  lock.release();
  set({ active: false, since: Date.now(), status: { code: "stopped" } });
};

/** Stop at the player's word: no reconnection on the next visit. */
export const disconnect = () => {
  stop();
  set({ connectOnStart: false, unavailable: false });
};

/** Retry now rather than after the session's wait. */
export const retry = () => runtime?.retryNow();

/**
 * Save the Room and Slot fields: connecting again with them is the caller's
 * move. The run on the board stays until the server names another.
 */
export const saveRoom = (room: {
  address: string;
  roomLink: string | null;
  slot: string;
}) => set(room);

/**
 * Follow another tab's settings: its Disconnect stops this tab's waiting
 * session, and a room it changed is the one this tab waits for.
 * @returns A function that stops following
 */
export const followOtherTabs = () => {
  const stopSync = syncAcrossTabs(useApConnectionStore);
  const stopWatch = useApConnectionStore.persist.onFinishHydration((after) => {
    if (!after.active) return;
    if (!after.connectOnStart) stop();
    else if (after.address !== watched.address || after.slot !== watched.slot) {
      stop();
      void connect();
    }
  });
  return () => {
    stopSync();
    stopWatch();
  };
};

/** For tests: what the next sessions are started with, and how the chunk loads. */
export const setRuntimeOptions = (
  options: typeof overrides,
  load: typeof loadRuntime = importRuntime,
) => {
  overrides = options;
  loadRuntime = load;
};

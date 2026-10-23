// The stream view for OBS in the desktop app (docs/desktop.md, "Stream
// tools"): the dialog's switch starts and stops the app's second server
// (src-tauri/src/stream.rs), which serves the stream view to a browser
// source, and while it runs the page publishes the run after each change
// (runFeed.ts). The switch, the port, the addresses and whether the network
// may reach the server are the app's to keep (a source is set up once and
// left), so this page keeps nothing: the app is asked again each time the
// page loads (`attachStream`). Imported in the desktop build only.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { holdOverlay, releaseOverlay } from "@/desktop/overlayFeed";
import { holdRun, publishNow, releaseRun } from "@/desktop/runFeed";

/** What the stream is called among the run feed's holders. */
const OWNER = "stream";

/**
 * While the stream runs, the page publishes the run for the source and what
 * the whitelist reads of it for the overlay API (`overlayFeed.ts`): the same
 * switch, so the same hold.
 */
const hold = () => {
  holdRun(OWNER);
  holdOverlay();
};

const release = () => {
  releaseRun(OWNER);
  releaseOverlay();
};

/** A running stream, as `stream_start` and `stream_state` describe it. */
export type StreamSession = {
  /** Where an OBS on this computer reaches the app: `http://127.0.0.1:23076/` */
  address: string;
  port: number;
  /** The saved port was not free: the address in OBS must be pasted again */
  moved: boolean;
  /** What opens the stream view (`?view=obs&token=…`) */
  token: string;
  /** What opens the overlay API (`/overlay`), a secret of its own */
  apiToken: string;
  /** The browser sources connected */
  viewers: number;
  /** Whether other devices on the network may reach the stream */
  lan: boolean;
  /** Where they reach it, when `lan` is on and the app knows its address */
  lanAddress: string | null;
};

type StreamStore = {
  /** The running stream, or null while it is off */
  session: StreamSession | null;
  /** A start, a stop or another change is under way */
  pending: boolean;
  /** Why the last change failed */
  error: string | null;
  /**
   * The stream was found running with its port moved, as the app started it
   * by itself at launch, and the player has not been told yet: a notice
   * outside the dialog says so (the dialog says it too, once opened).
   */
  movedNotice: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Replace the addresses: the sources holding the old ones are closed */
  newTokens: () => Promise<void>;
  /**
   * Ask the app how the stream stands: what the dialog does when it opens on
   * a running stream, since the network address can have changed since.
   */
  refresh: () => Promise<void>;
  /** Allow other devices on the network, or take that back */
  setLan: (lan: boolean) => Promise<void>;
  dismissMovedNotice: () => void;
};

/**
 * Where the port the player was told about is kept for this launch: the
 * page's own storage for the session, which a reload (a game switch) keeps
 * and an app restart does not. A moved port is said once per launch, outside
 * the dialog, whether or not it was dismissed; the dialog keeps saying it.
 */
const TOLD_KEY = "alltp-tracker-stream-moved-told";

const wasTold = (port: number): boolean => {
  try {
    return sessionStorage.getItem(TOLD_KEY) === String(port);
  } catch {
    return false;
  }
};

const markTold = (port: number): void => {
  try {
    sessionStorage.setItem(TOLD_KEY, String(port));
  } catch {
    // No storage: the notice may come back after a reload, nothing worse
  }
};

/** A count heard while no session is known yet, applied when one arrives. */
let heardViewers: number | null = null;

/**
 * Ask the app how the stream stands, after a change that failed: a restart
 * that could not reopen the port leaves it off, and the dialog must not keep
 * showing it on. The run is published only while it runs. If the app cannot
 * answer either, what was shown stays.
 */
const resync = async (
  set: (state: Partial<StreamStore>) => void,
): Promise<void> => {
  try {
    const session = await invoke<StreamSession | null>("stream_state");
    set({ session });
    if (session) hold();
    else release();
  } catch (error) {
    console.warn("Could not ask the app about the stream:", error);
    // What was shown stays, and a stream shown running keeps publishing
    if (useStreamStore.getState().session) hold();
  }
};

/**
 * A command failed: say why, and ask the app how the stream stands. `pending`
 * stays on until it answers, so no other command runs meanwhile and the
 * answer is never older than the next command's result.
 */
const failed = async (
  set: (state: Partial<StreamStore>) => void,
  error: unknown,
): Promise<void> => {
  set({ error: String(error) });
  await resync(set);
  set({ pending: false });
};

/** The run is published while a session runs, and only then. */
const publishWhile = (session: StreamSession | null) => {
  if (session) hold();
  else release();
};

export const useStreamStore = create<StreamStore>()((set, get) => ({
  dismissMovedNotice: () => set({ movedNotice: false }),
  error: null,
  movedNotice: false,
  newTokens: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    try {
      const session = await invoke<StreamSession | null>("stream_new_tokens");
      set({ pending: false, session });
      publishWhile(session);
    } catch (error) {
      console.warn("Could not make new addresses:", error);
      await failed(set, error);
    }
  },
  pending: false,
  refresh: async () => {
    if (get().pending) return;
    await resync(set);
  },
  session: null,
  setLan: async (lan) => {
    if (get().pending) return;
    set({ error: null, pending: true });
    try {
      const session = await invoke<StreamSession | null>("stream_set_lan", {
        lan,
      });
      set({ pending: false, session });
      publishWhile(session);
    } catch (error) {
      console.warn("Could not change who can reach the stream:", error);
      await failed(set, error);
    }
  },
  start: async () => {
    if (get().pending) return;
    heardViewers = null;
    set({ error: null, pending: true });
    try {
      const session = await invoke<StreamSession>("stream_start");
      // The dialog says a moved port to the player who just started it
      if (session.moved) markTold(session.port);
      // A source may have connected before the answer came
      set({
        pending: false,
        session: { ...session, viewers: heardViewers ?? session.viewers },
      });
      hold();
    } catch (error) {
      console.warn("Could not start the stream:", error);
      await failed(set, error);
    } finally {
      heardViewers = null;
    }
  },
  stop: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    release();
    try {
      await invoke("stream_stop");
      heardViewers = null;
      set({ movedNotice: false, pending: false, session: null });
    } catch (error) {
      console.warn("Could not stop the stream:", error);
      await failed(set, error);
    }
  },
}));

/** The app's stream, found running when the page asked or was told. */
const adopt = (session: StreamSession) => {
  const state = useStreamStore.getState();
  // Told of the same session twice (the page's question, then the app's
  // event): the second changes nothing
  if (
    state.session?.token === session.token &&
    state.session.port === session.port
  )
    return;
  const notice = session.moved && !wasTold(session.port);
  if (notice) markTold(session.port);
  useStreamStore.setState({
    movedNotice: notice,
    session: { ...session, viewers: heardViewers ?? session.viewers },
  });
  heardViewers = null;
  hold();
};

/**
 * Pick up the stream the app runs: it starts by itself at launch when it was
 * left on, and keeps running when the page loads again (a game switch). The
 * page may ask before the app has opened it, so the app says so by an event
 * when it does. The run is published at once, and again, freshly stamped, as
 * each source joins, for its timer's clock.
 */
export const attachStream = async () => {
  heardViewers = null;
  try {
    await listen<StreamSession>("stream-started", ({ payload }) =>
      adopt(payload),
    );
    await listen<{ count: number }>("stream-viewers", ({ payload }) => {
      const { session } = useStreamStore.getState();
      if (!session) {
        // Heard while a start, or the page's question, is still answering:
        // kept for the answer
        heardViewers = payload.count;
        return;
      }
      if (payload.count > session.viewers) publishNow();
      useStreamStore.setState({
        session: { ...session, viewers: payload.count },
      });
    });
    const session = await invoke<StreamSession | null>("stream_state");
    if (session) adopt(session);
  } catch (error) {
    console.warn("The stream is not available:", error);
  }
};

// The stream view for OBS in the desktop app (docs/desktop.md, "Stream
// tools"): the dialog's switch starts and stops the app's second server
// (src-tauri/src/stream.rs), which serves the stream view to a browser
// source, and while it runs the page publishes the run after each change
// (runFeed.ts). The switch, the port and the addresses are the app's to keep
// (a source is set up once and left), so this page keeps nothing: the app is
// asked again each time the page loads (`attachStream`). Imported in the
// desktop build only.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { holdRun, publishNow, releaseRun } from "@/desktop/runFeed";

/** What the stream is called among the run feed's holders. */
const OWNER = "stream";

/** A running stream, as `stream_start` and `stream_state` describe it. */
export type StreamSession = {
  /** Where an OBS on this computer reaches the app: `http://127.0.0.1:23076/` */
  address: string;
  port: number;
  /** The saved port was not free: the address in OBS must be pasted again */
  moved: boolean;
  /** What opens the stream view (`?view=obs&token=…`) */
  token: string;
  /** The browser sources connected */
  viewers: number;
};

type StreamStore = {
  /** The running stream, or null while it is off */
  session: StreamSession | null;
  /** A start, a stop or new addresses are under way */
  pending: boolean;
  /** Why the last one failed */
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Replace the addresses: the sources holding the old ones are closed */
  newTokens: () => Promise<void>;
};

export const useStreamStore = create<StreamStore>()((set, get) => ({
  error: null,
  newTokens: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    try {
      const session = await invoke<StreamSession | null>("stream_new_tokens");
      set({ pending: false, session });
    } catch (error) {
      console.warn("Could not make new addresses:", error);
      set({ error: String(error), pending: false });
    }
  },
  pending: false,
  session: null,
  start: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    try {
      const session = await invoke<StreamSession>("stream_start");
      set({ pending: false, session });
      holdRun(OWNER);
    } catch (error) {
      console.warn("Could not start the stream:", error);
      set({ error: String(error), pending: false });
    }
  },
  stop: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    releaseRun(OWNER);
    try {
      await invoke("stream_stop");
      set({ pending: false, session: null });
    } catch (error) {
      console.warn("Could not stop the stream:", error);
      set({ error: String(error), pending: false });
      if (get().session) holdRun(OWNER);
    }
  },
}));

/**
 * Pick up the stream the app runs: it starts by itself at launch when it was
 * left on, and keeps running when the page loads again (a game switch). The
 * run is published at once, and again, freshly stamped, as each source joins,
 * for its timer's clock.
 */
export const attachStream = async () => {
  try {
    await listen<{ count: number }>("stream-viewers", ({ payload }) => {
      const { session } = useStreamStore.getState();
      if (!session) return;
      if (payload.count > session.viewers) publishNow();
      useStreamStore.setState({
        session: { ...session, viewers: payload.count },
      });
    });
    const session = await invoke<StreamSession | null>("stream_state");
    if (session) {
      useStreamStore.setState({ session });
      holdRun(OWNER);
    }
  } catch (error) {
    console.warn("The stream is not available:", error);
  }
};

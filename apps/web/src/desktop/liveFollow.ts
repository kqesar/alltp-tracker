// Live follow in the desktop app (docs/desktop.md, "Live follow on the LAN"):
// the Share dialog's switch starts and stops the app's relay
// (src-tauri/src/follow.rs), and while it runs the page publishes the run
// after each change (follow/publish.ts). Imported in the desktop build only.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { type Publication, publishRun } from "@/follow/publish";
import type { GameId, RunStore } from "@/games/registry";

/** A running relay, as `follow_start` and `follow_state` describe it. */
export type FollowSession = {
  /** The link a device on the network opens */
  url: string;
  port: number;
  /** Whether the app found its address on the network; else `url` is on 127.0.0.1 */
  lanFound: boolean;
  viewers: number;
};

type LiveFollowStore = {
  /** The running relay, or null while it is off */
  session: FollowSession | null;
  /** A start or a stop is under way */
  pending: boolean;
  /** Why the last start or stop failed */
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

/** The run this page tracks, which the relay gets while it runs. */
let attached: { game: GameId; store: RunStore } | null = null;
let publisher: ReturnType<typeof publishRun> | null = null;

const send = (publication: Publication) => {
  invoke("follow_publish", publication).catch((error: unknown) => {
    console.warn("Could not publish the run:", error);
  });
};

const publishWhile = (running: boolean) => {
  if (running && attached && !publisher) {
    publisher = publishRun({ ...attached, send });
  } else if (!running && publisher) {
    publisher.stop();
    publisher = null;
  }
};

/**
 * Whether the relay runs, and how many devices follow. Nothing here is a
 * run, so nothing is saved: the relay itself is the truth, asked again each
 * time the page loads (`attachRun`).
 */
export const useLiveFollowStore = create<LiveFollowStore>()((set, get) => ({
  error: null,
  pending: false,
  session: null,
  start: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    try {
      const session = await invoke<FollowSession>("follow_start");
      set({ pending: false, session });
      publishWhile(true);
    } catch (error) {
      console.warn("Could not start live follow:", error);
      set({ error: String(error), pending: false });
    }
  },
  stop: async () => {
    if (get().pending) return;
    set({ error: null, pending: true });
    publishWhile(false);
    try {
      await invoke("follow_stop");
      set({ pending: false, session: null });
    } catch (error) {
      console.warn("Could not stop live follow:", error);
      set({ error: String(error), pending: false });
      if (get().session) publishWhile(true);
    }
  },
}));

/**
 * Give live follow the run this page tracks, once its game has loaded. A
 * relay still running from before the page loaded again (a game switch
 * reloads it) is picked up, and gets this game's run at once. Each device
 * that joins gets the run again, freshly stamped, for its timer's clock.
 */
export const attachRun = async (game: GameId, store: RunStore) => {
  attached = { game, store };
  try {
    await listen<{ count: number }>("follow-viewers", ({ payload }) => {
      const { session } = useLiveFollowStore.getState();
      if (!session) return;
      if (payload.count > session.viewers) publisher?.now();
      useLiveFollowStore.setState({
        session: { ...session, viewers: payload.count },
      });
    });
    const session = await invoke<FollowSession | null>("follow_state");
    if (session) {
      useLiveFollowStore.setState({ session });
      publishWhile(true);
    }
  } catch (error) {
    console.warn("Live follow is not available:", error);
  }
};

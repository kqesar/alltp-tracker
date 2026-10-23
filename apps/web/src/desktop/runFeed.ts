// The run the desktop app's servers relay (docs/desktop.md, "Live follow on
// the LAN" and "Stream tools"): after each change, the run as the game's store
// saved it goes to the app (`run_publish`), which hands it to every device
// following and every browser source. One publisher serves them all: live
// follow and the stream view each hold it while they run, and it works while
// either does. Imported in the desktop build only.

import { invoke } from "@tauri-apps/api/core";
import { type Publication, publishRun } from "@/follow/publish";
import type { GameId, RunStore } from "@/games/registry";

/** The run this page tracks. */
let run: { game: GameId; store: RunStore } | null = null;
let publisher: ReturnType<typeof publishRun> | null = null;
/** Who needs the run published now: "follow", "stream". */
const holders = new Set<string>();

const send = (publication: Publication) => {
  invoke("run_publish", publication).catch((error: unknown) => {
    console.warn("Could not publish the run:", error);
  });
};

const sync = () => {
  if (holders.size > 0 && run && !publisher) {
    publisher = publishRun({ ...run, send });
  } else if (holders.size === 0 && publisher) {
    publisher.stop();
    publisher = null;
  }
};

/** Give the feed the run this page tracks, once its game has loaded. */
export const setRun = (game: GameId, store: RunStore) => {
  publisher?.stop();
  publisher = null;
  run = { game, store };
  sync();
};

/** `owner` needs the run published: now, then after each change. */
export const holdRun = (owner: string) => {
  holders.add(owner);
  sync();
};

/** `owner` no longer needs it; nothing is sent once nobody does. */
export const releaseRun = (owner: string) => {
  holders.delete(owner);
  sync();
};

/**
 * Publish the run again at once, freshly stamped: a device or a source just
 * joined, and its timer takes its clock's offset from the stamp.
 */
export const publishNow = () => publisher?.now();

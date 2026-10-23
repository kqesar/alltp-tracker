// The overlay API's feed, in the desktop app (docs/overlay-api.md): while the
// stream is on, the page publishes what the whitelist reads of the run, and
// the events that changed it, to the app (`overlay_publish`), which relays
// them to the clients on `/overlay`. The game's whitelist is its own module,
// loaded for the game this page tracks only. Imported in the desktop build
// only.

import { invoke } from "@tauri-apps/api/core";
import type { GameId } from "@/games/registry";
import type { OverlayPublication, OverlaySource } from "@/overlay/protocol";
import { publishOverlay } from "@/overlay/publish";

/** Each game's whitelist: a chunk of its own, loaded when the stream starts. */
export const OVERLAY_SOURCES: Readonly<
  Record<GameId, () => Promise<OverlaySource>>
> = {
  alttpr: () =>
    import("@/games/alttpr/overlay").then(({ overlaySource }) => overlaySource),
  sm: () =>
    import("@/games/sm/overlay").then(({ overlaySource }) => overlaySource),
  smz3: () =>
    import("@/games/smz3/overlay").then(({ overlaySource }) => overlaySource),
};

let game: GameId | null = null;
let stopPublishing: (() => void) | null = null;
let wanted = false;
/** Counts the starts, so a source that loads after a stop is dropped. */
let generation = 0;

const send = (publication: OverlayPublication) => {
  invoke("overlay_publish", { ...publication }).catch((error: unknown) => {
    console.warn("Could not publish the overlay state:", error);
  });
};

const sync = () => {
  const running = stopPublishing !== null;
  if (wanted && game && !running) {
    const mine = ++generation;
    // Marked as started at once, so a second call waits for the load
    stopPublishing = () => {};
    OVERLAY_SOURCES[game]().then(
      (source) => {
        if (mine !== generation) return;
        stopPublishing = publishOverlay({ send, source });
      },
      (error: unknown) => {
        if (mine === generation) stopPublishing = null;
        console.warn("The overlay API is not available:", error);
      },
    );
  } else if (!wanted && running) {
    generation++;
    stopPublishing?.();
    stopPublishing = null;
  }
};

/** The game this page tracks, once it has loaded. */
export const setOverlayGame = (id: GameId) => {
  game = id;
  sync();
};

/** The stream is on: publish the run's whitelist, now and after each change. */
export const holdOverlay = () => {
  wanted = true;
  sync();
};

/** The stream is off: nothing is sent. */
export const releaseOverlay = () => {
  wanted = false;
  sync();
};

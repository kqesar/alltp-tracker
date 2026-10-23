// The desktop app's side of the overlay API (docs/overlay-api.md): after each
// change to the run, what the whitelist reads of it, and the events that
// changed, go to the app (`overlay_publish`), which relays them to the
// clients on `/overlay`.

import { diffOverlay } from "@/overlay/diff";
import type {
  OverlayPublication,
  OverlayReading,
  OverlaySource,
} from "@/overlay/protocol";
import { trailing } from "@/utils/trailing";

/** The longest wait between a change and its publication, in ms. */
export const OVERLAY_DELAY_MS = 250;

/**
 * Publish the run as the whitelist reads it now, then after each change, at
 * most once per `OVERLAY_DELAY_MS`: a burst (autotracking's sync, an undo held
 * down) is one publication, whose events are everything that changed since
 * the last. A change that leaves the reading as it was is not sent. The first
 * publication has no events, as the one after a reload (a game switch) does:
 * clients take the state.
 * @param source - The game's run, as the whitelist reads it
 * @param send - Hands a publication to the app
 * @param now - The clock that dates what is found, the app's (the same
 * machine's)
 * @returns What stops publishing
 */
export const publishOverlay = ({
  now = Date.now,
  send,
  source,
}: {
  source: OverlaySource;
  send: (publication: OverlayPublication) => void;
  now?: () => number;
}): (() => void) => {
  let last: OverlayReading | null = null;
  let lastState = "";

  const publish = () => {
    let reading: OverlayReading;
    try {
      reading = source.read();
    } catch (error) {
      console.warn("Could not read the run for the overlay:", error);
      return;
    }
    const state = JSON.stringify(reading.state);
    if (last !== null && state === lastState) return;
    const events = diffOverlay(last, reading, now());
    last = reading;
    lastState = state;
    send({ events: JSON.stringify(events), state });
  };

  const wait = trailing(OVERLAY_DELAY_MS, publish);
  const unsubscribe = source.subscribe(wait.poke);
  publish();

  return () => {
    unsubscribe();
    wait.cancel();
  };
};

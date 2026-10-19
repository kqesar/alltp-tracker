import { useEffect } from "react";
import {
  connectAutotrack,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";

/**
 * Autotracking's lifetime in the tracker: lazy, it opens no socket and loads
 * no session code until the player connects; once they have, it connects
 * again as the tracker opens (the choice is remembered on this device), and
 * it stops with the tracker. The session reconnects on its own in between.
 * The tracker alone calls it: the stream view never connects (see
 * `connectAutotrack`).
 */
export const useAutotrack = () => {
  useEffect(() => {
    if (useAutotrackStore.getState().connectOnStart) void connectAutotrack();
    return stopAutotrack;
  }, []);
};

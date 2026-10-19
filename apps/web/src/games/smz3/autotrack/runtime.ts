// SMZ3's autotracking session, a chunk of its own: the usb2snes client, the
// poller and the SMZ3 pack load only once the player connects. The store
// (games/smz3/autotrack/store.ts) owns the one runtime.

import {
  AutotrackSession,
  type Environment,
  type SessionOptions,
} from "@alltp/autotrack";
import { SMZ3_AUTOTRACK } from "@alltp/pack-smz3";
import type { GameRuntime, GameRuntimeSink } from "@/autotrack/gameSession";
import { readSmz3, type Smz3Reading } from "@/games/smz3/autotrack/reading";

export { detectEnvironment } from "@alltp/autotrack";
// What lays the readings on the run: needed only once a session runs
export { createSmz3Follower } from "@/games/smz3/autotrack/follow";

/**
 * Start an SMZ3 session. A race seed's requirements stay unread: Race Mode
 * is on until the seed's race bit says otherwise, and every reading is
 * decoded again when it changes.
 * @param options - The session's options, the environment found among them
 * @param sink - Where statuses and readings go
 */
export const startSmz3Runtime = (
  options: Omit<SessionOptions, "pack"> & { readonly environment: Environment },
  sink: GameRuntimeSink<Smz3Reading>,
): GameRuntime => {
  const session = new AutotrackSession({ ...options, pack: SMZ3_AUTOTRACK });
  const raceActive = () => session.race?.active ?? true;
  let decodedInRace: boolean | null = null;
  const decode = (snapshot: NonNullable<AutotrackSession["snapshot"]>) => {
    decodedInRace = raceActive();
    sink.reading(readSmz3(snapshot, decodedInRace, Date.now()));
  };
  session.subscribe((status) => {
    sink.status(status, session.statusSince, session.seen);
    // Race Mode can change without memory changing: decode again under it
    const snapshot = session.snapshot;
    if (
      status.code === "connected" &&
      snapshot !== null &&
      decodedInRace !== null &&
      decodedInRace !== status.race.active
    ) {
      decode(snapshot);
    }
  });
  session.onUpdate(({ snapshot }) => decode(snapshot));
  session.start();
  return {
    retryNow: () => session.retryNow(),
    stop: () => session.stop(),
  };
};

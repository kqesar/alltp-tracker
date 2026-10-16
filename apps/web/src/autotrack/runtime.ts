// The autotracking session itself, a chunk of its own: the usb2snes client,
// the poller and the ALttPR pack load only once the player connects. The
// store (stores/autotrackStore.ts) owns the one runtime and feeds the UI from
// what it reports.

import {
  AutotrackSession,
  type BridgeInfo,
  type DeviceDescriptor,
  type Environment,
  type SessionOptions,
  type SessionStatus,
} from "@alltp/autotrack";
import { ALTTPR_AUTOTRACK } from "@alltp/pack-alttpr";
import { type AutotrackReading, readMemory } from "@/autotrack/reading";

export { detectEnvironment } from "@alltp/autotrack";
// What lays the readings on the board: needed only once a session runs
export { createFollower } from "@/autotrack/follow";

/** Where the runtime reports to. */
export type RuntimeSink = {
  /** Every status change, with when it began and what the bridge listed. */
  status: (
    status: SessionStatus,
    since: number,
    seen: {
      readonly bridge: BridgeInfo | null;
      readonly devices: readonly DeviceDescriptor[];
    },
  ) => void;
  /** The game, decoded again after every read that changed memory. */
  reading: (reading: AutotrackReading) => void;
};

/** A running session, as the store drives it. */
export type Runtime = {
  /** Skip the wait: retry now, or check the game again. */
  retryNow: () => void;
  /** Stop for good: no socket, timer or listener survives. */
  stop: () => void;
};

/**
 * Start an ALttPR session.
 * @param options - The session's options; the environment found, and for
 * tests a transport, clock, permission or visibility of their own
 * @param sink - Where statuses and readings go
 */
export const startRuntime = (
  options: Omit<SessionOptions, "pack"> & { readonly environment: Environment },
  sink: RuntimeSink,
): Runtime => {
  const session = new AutotrackSession({ ...options, pack: ALTTPR_AUTOTRACK });
  // Race Mode is on until the race flag says otherwise: fail closed
  const raceActive = () => session.race?.active ?? true;
  let decodedInRace: boolean | null = null;

  const decode = (snapshot: NonNullable<AutotrackSession["snapshot"]>) => {
    decodedInRace = raceActive();
    sink.reading(readMemory(snapshot, decodedInRace, Date.now()));
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

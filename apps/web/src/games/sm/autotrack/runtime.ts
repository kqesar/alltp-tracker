// Super Metroid's autotracking session, a chunk of its own: the usb2snes
// client, the poller and the Map Rando pack load only once the player
// connects. The store (games/sm/autotrack/store.ts) owns the one runtime.

import {
  AutotrackSession,
  type BridgeInfo,
  type DeviceDescriptor,
  type Environment,
  type SessionOptions,
  type SessionStatus,
} from "@alltp/autotrack";
import { MAP_RANDO_AUTOTRACK } from "@alltp/pack-sm";
import { readSm, type SmReading } from "@/games/sm/autotrack/reading";

export { detectEnvironment } from "@alltp/autotrack";
// What lays the readings on the run: needed only once a session runs
export { createSmFollower } from "@/games/sm/autotrack/follow";

/** Where the runtime reports to. */
export type SmRuntimeSink = {
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
  reading: (reading: SmReading) => void;
};

/** A running session, as the store drives it. */
export type SmRuntime = {
  retryNow: () => void;
  stop: () => void;
};

/**
 * Start a Map Rando session. Races restrict no tracking (the pack's race
 * profile), so every reading decodes all it reads.
 * @param options - The session's options, the environment found among them
 * @param sink - Where statuses and readings go
 */
export const startSmRuntime = (
  options: Omit<SessionOptions, "pack"> & { readonly environment: Environment },
  sink: SmRuntimeSink,
): SmRuntime => {
  const session = new AutotrackSession({
    ...options,
    pack: MAP_RANDO_AUTOTRACK,
  });
  session.subscribe((status) => {
    sink.status(status, session.statusSince, session.seen);
  });
  session.onUpdate(({ snapshot }) =>
    sink.reading(readSm(snapshot, Date.now())),
  );
  session.start();
  return {
    retryNow: () => session.retryNow(),
    stop: () => session.stop(),
  };
};

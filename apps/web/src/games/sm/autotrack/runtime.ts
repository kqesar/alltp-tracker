// Super Metroid's autotracking session, a chunk of its own: the usb2snes
// client, the poller and the Map Rando pack load only once the player
// connects. The store (games/sm/autotrack/store.ts) owns the one runtime.

import {
  AutotrackSession,
  type Environment,
  type SessionOptions,
} from "@alltp/autotrack";
import { MAP_RANDO_AUTOTRACK } from "@alltp/pack-sm";
import type { GameRuntime, GameRuntimeSink } from "@/autotrack/gameSession";
import { readSm, type SmReading } from "@/games/sm/autotrack/reading";

export { detectEnvironment } from "@alltp/autotrack";
// What lays the readings on the run: needed only once a session runs
export { createSmFollower } from "@/games/sm/autotrack/follow";

/**
 * Start a Map Rando session. Races restrict no tracking, but the pack's race
 * profile keeps two categories out of Race Mode, the RTA clock and the
 * locations: with it on, which the player does for a race (the ROM has no race
 * flag, so Auto leaves it off), a reading holds neither and decodes them as
 * unread.
 * @param options - The session's options, the environment found among them
 * @param sink - Where statuses and readings go
 */
export const startSmRuntime = (
  options: Omit<SessionOptions, "pack"> & { readonly environment: Environment },
  sink: GameRuntimeSink<SmReading>,
): GameRuntime => {
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
  // The RTA clock is read on every poll: one that changed nothing is a game
  // that stands still
  session.onSteady(() => sink.steady?.(Date.now()));
  session.start();
  return {
    retryNow: () => session.retryNow(),
    setRaceMode: (setting) => session.setRaceMode(setting),
    stop: () => session.stop(),
  };
};

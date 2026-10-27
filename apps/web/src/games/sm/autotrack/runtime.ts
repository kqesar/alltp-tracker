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
 * Start a Map Rando session. The pack's race profile keeps the RTA clock and
 * the locations out of Race Mode, and a reading in Race Mode tells only the
 * objectives done by a boss kill: with it on, which the player does for a
 * race (the ROM has no race flag, so Auto leaves it off), a reading holds
 * neither and decodes them as unread. Every reading is decoded again when
 * Race Mode changes.
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
  const raceActive = () => session.race?.active ?? true;
  let decodedInRace: boolean | null = null;
  const decode = (snapshot: NonNullable<AutotrackSession["snapshot"]>) => {
    decodedInRace = raceActive();
    sink.reading(readSm(snapshot, Date.now(), decodedInRace));
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

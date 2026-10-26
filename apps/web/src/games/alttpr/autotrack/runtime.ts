// The autotracking session itself, a chunk of its own: the usb2snes client,
// the poller and the ALttPR pack load only once the player connects. The
// store (stores/autotrackStore.ts) owns the one runtime and feeds the UI from
// what it reports.

import {
  AutotrackSession,
  type BridgeInfo,
  type DeviceDescriptor,
  type Environment,
  type RaceSetting,
  type SessionOptions,
  type SessionStatus,
} from "@alltp/autotrack";
import {
  ALTTPR_AUTOTRACK,
  DARK_ROOM_SWITCH,
  type DarkRoomReading,
  decodeDarkRoom,
} from "@alltp/pack-alttpr";
import {
  type AutotrackReading,
  readMemory,
} from "@/games/alttpr/autotrack/reading";

export { detectEnvironment } from "@alltp/autotrack";
// What lays the readings on the board: needed only once a session runs
export { createFollower } from "@/games/alttpr/autotrack/follow";

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
  /** A poll read memory and found it unchanged: the game stands still. */
  steady?: (at: number) => void;
  /**
   * The dark room Link is in without the Lamp, decoded again after every read
   * that changed what it shows; null when there is none (and in Race Mode,
   * which never reads it). Not a part of the reading: it never reaches the run.
   */
  darkRoom?: (room: DarkRoomReading | null) => void;
};

/** The ranges the dark room map reads (the pack's `dark-room-…`). */
const isDarkRoomRange = (id: string) => id.startsWith("dark-room-");
/** The equipment holding the Lamp, which the room's gate reads. */
const LAMP_RANGE = "equipment-b";

/** A running session, as the store drives it. */
export type Runtime = {
  /** Skip the wait: retry now, or check the game again. */
  retryNow: () => void;
  /** Turn the dark room map on or off: its ranges are read only while on. */
  setDarkRoom: (on: boolean) => void;
  /** Follow the player's Race Mode: the next reading is decoded under it. */
  setRaceMode: (setting: RaceSetting) => void;
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
  options: Omit<SessionOptions, "pack" | "optIn"> & {
    readonly environment: Environment;
    /** The dark room map is on (the player's choice, on by default). */
    readonly darkRoom?: boolean;
  },
  sink: RuntimeSink,
): Runtime => {
  const { darkRoom = true, ...sessionOptions } = options;
  const session = new AutotrackSession({
    ...sessionOptions,
    optIn: darkRoom ? [DARK_ROOM_SWITCH] : [],
    pack: ALTTPR_AUTOTRACK,
  });
  // Race Mode is on until the race flag says otherwise: fail closed
  const raceActive = () => session.race?.active ?? true;
  let decodedInRace: boolean | null = null;

  const decode = (snapshot: NonNullable<AutotrackSession["snapshot"]>) => {
    decodedInRace = raceActive();
    sink.reading(readMemory(snapshot, decodedInRace, Date.now()));
  };

  /** The dark room, decoded under Race Mode as it stands. */
  const showDarkRoom = (snapshot: NonNullable<AutotrackSession["snapshot"]>) =>
    sink.darkRoom?.(decodeDarkRoom(snapshot, { race: raceActive() }));

  session.subscribe((status) => {
    sink.status(status, session.statusSince, session.seen);
    // No bridge, no game: no room to show
    if (status.code !== "connected") sink.darkRoom?.(null);
    // Race Mode can change without memory changing: decode again under it
    const snapshot = session.snapshot;
    if (
      status.code === "connected" &&
      snapshot !== null &&
      decodedInRace !== null &&
      decodedInRace !== status.race.active
    ) {
      decode(snapshot);
      showDarkRoom(snapshot);
    }
  });
  session.onUpdate(({ changed, snapshot }) => {
    // Link walking changes the dark room's ranges alone: the board's reading
    // is not decoded again for them
    if (changed.some((id) => !isDarkRoomRange(id))) decode(snapshot);
    if (changed.some((id) => isDarkRoomRange(id) || id === LAMP_RANGE)) {
      showDarkRoom(snapshot);
    }
  });
  // The play frames are read on every poll: one that changed nothing is a
  // game that stands still
  session.onSteady(() => sink.steady?.(Date.now()));
  session.start();

  return {
    retryNow: () => session.retryNow(),
    setDarkRoom: (on) => {
      session.setOptIn(DARK_ROOM_SWITCH, on);
      // Off: its ranges are forgotten by the next poll; the room goes now
      if (!on) sink.darkRoom?.(null);
    },
    setRaceMode: (setting) => session.setRaceMode(setting),
    stop: () => session.stop(),
  };
};

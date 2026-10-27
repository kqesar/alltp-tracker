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
  systemClock,
} from "@alltp/autotrack";
import {
  ALTTPR_AUTOTRACK,
  ART_RANGES,
  ART_RETRY_MS,
  type ArtOutcome,
  createArtLoader,
  DARK_ROOM_ART_SWITCH,
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
  /**
   * The dark room drawn in the game's own graphics (the "Game art" style),
   * drawn again as what it is made of changes; null when there is no room or
   * the style is off. Rebuilt from the player's own console and ROM, held in
   * memory only, like the room itself.
   */
  darkRoomArt?: (art: ArtOutcome | null) => void;
};

/** The ranges the dark room map reads (the pack's `dark-room-…`). */
const isDarkRoomRange = (id: string) => id.startsWith("dark-room-");
/** The ranges its picture is drawn from (`dark-room-art-…`), or that redraw it. */
const isArtRange = (id: string) =>
  id.startsWith("dark-room-art-") ||
  id === "dark-room-room" ||
  // The sword and the shield: a new one is new graphics for Link
  id === "equipment-c";
/** The equipment holding the Lamp, which the room's gate reads. */
const LAMP_RANGE = "equipment-b";

/** A running session, as the store drives it. */
export type Runtime = {
  /** Skip the wait: retry now, or check the game again. */
  retryNow: () => void;
  /** Turn the dark room map on or off: its ranges are read only while on. */
  setDarkRoom: (on: boolean) => void;
  /** Draw the dark room in the game's graphics, or not (the plan alone). */
  setDarkRoomArt: (on: boolean) => void;
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
    /** It is drawn in the game's graphics (on by default, with the map). */
    readonly darkRoomArt?: boolean;
  },
  sink: RuntimeSink,
): Runtime => {
  const { darkRoom = true, darkRoomArt = true, ...sessionOptions } = options;
  let mapOn = darkRoom;
  let artWanted = darkRoomArt;
  const artOn = () => mapOn && artWanted;
  const session = new AutotrackSession({
    ...sessionOptions,
    optIn: [
      ...(darkRoom ? [DARK_ROOM_SWITCH] : []),
      ...(artOn() ? [DARK_ROOM_ART_SWITCH] : []),
    ],
    pack: ALTTPR_AUTOTRACK,
  });
  // Race Mode is on until the race flag says otherwise: fail closed
  const raceActive = () => session.race?.active ?? true;

  // The picture: what it is drawn from is read on demand (navigation, which
  // the session refuses in Race Mode), one draw at a time, the last asked for
  // drawn after the one under way
  // The session's own clock, so a retry runs on the tests' clock too
  const clock = sessionOptions.clock ?? systemClock;
  // Turned off, the picture's reads still waiting are dropped, never sent
  let reads = new AbortController();
  const dropReads = () => {
    reads.abort();
    reads = new AbortController();
  };
  const loader = createArtLoader(
    (ranges) =>
      session.request({ category: "navigation", ranges, signal: reads.signal }),
    () => clock.now(),
  );
  /** A draw again once a failed read's pause is over, even if nothing moves. */
  let retry: unknown = null;
  const clearRetry = () => {
    if (retry !== null) clock.clearTimeout(retry);
    retry = null;
  };
  let shownRoom = false;
  let drawing = false;
  let drawAgain = false;
  let stopped = false;
  const drawArt = async () => {
    if (drawing) {
      drawAgain = true;
      return;
    }
    drawing = true;
    do {
      drawAgain = false;
      const snapshot = session.snapshot;
      if (!shownRoom || !artOn() || raceActive() || snapshot === null) {
        sink.darkRoomArt?.(null);
        break;
      }
      // The device could not serve the picture's memory: it never comes, so
      // say so rather than wait
      const status = session.status;
      if (
        status.code === "connected" &&
        status.unreadable.some((id) =>
          (ART_RANGES as readonly string[]).includes(id),
        )
      ) {
        sink.darkRoomArt?.({ reason: "unreadable", status: "unavailable" });
        break;
      }
      const outcome = await loader.update(snapshot);
      if (stopped) return;
      clearRetry();
      if (
        outcome?.status === "unavailable" &&
        outcome.reason === "read-failed"
      ) {
        retry = clock.setTimeout(() => {
          retry = null;
          void drawArt();
        }, ART_RETRY_MS);
      }
      // The room may have gone, or Race Mode come, while it was drawn
      sink.darkRoomArt?.(
        shownRoom && artOn() && !raceActive() ? outcome : null,
      );
    } while (drawAgain);
    drawing = false;
  };
  let decodedInRace: boolean | null = null;

  const decode = (snapshot: NonNullable<AutotrackSession["snapshot"]>) => {
    decodedInRace = raceActive();
    sink.reading(readMemory(snapshot, decodedInRace, Date.now()));
  };

  /** The dark room, decoded under Race Mode as it stands. */
  const showDarkRoom = (
    snapshot: NonNullable<AutotrackSession["snapshot"]>,
  ) => {
    const room = decodeDarkRoom(snapshot, { race: raceActive() });
    sink.darkRoom?.(room);
    const was = shownRoom;
    shownRoom = room !== null;
    if (was && !shownRoom) sink.darkRoomArt?.(null);
  };

  session.subscribe((status) => {
    sink.status(status, session.statusSince, session.seen);
    // No bridge, no game: no room to show
    if (status.code !== "connected") {
      shownRoom = false;
      sink.darkRoom?.(null);
      sink.darkRoomArt?.(null);
    } else if (shownRoom && artOn() && status.unreadable.length > 0) {
      // A range the device cannot serve: the picture may be one of them
      void drawArt();
    }
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
      void drawArt();
    }
  });
  session.onUpdate(({ changed, snapshot }) => {
    // Link walking changes the dark room's ranges alone: the board's reading
    // is not decoded again for them
    if (changed.some((id) => !isDarkRoomRange(id))) decode(snapshot);
    if (changed.some((id) => isDarkRoomRange(id) || id === LAMP_RANGE)) {
      showDarkRoom(snapshot);
    }
    if (artOn() && shownRoom && changed.some(isArtRange)) void drawArt();
  });
  // The play frames are read on every poll: one that changed nothing is a
  // game that stands still
  session.onSteady(() => sink.steady?.(Date.now()));
  session.start();

  return {
    retryNow: () => session.retryNow(),
    setDarkRoom: (on) => {
      mapOn = on;
      session.setOptIn(DARK_ROOM_SWITCH, on);
      session.setOptIn(DARK_ROOM_ART_SWITCH, artOn());
      // Off: its ranges are forgotten by the next poll; the room goes now
      if (!on) {
        shownRoom = false;
        dropReads();
        sink.darkRoom?.(null);
        sink.darkRoomArt?.(null);
      }
    },
    setDarkRoomArt: (on) => {
      artWanted = on;
      session.setOptIn(DARK_ROOM_ART_SWITCH, artOn());
      if (!on) {
        dropReads();
        sink.darkRoomArt?.(null);
      }
    },
    setRaceMode: (setting) => session.setRaceMode(setting),
    stop: () => {
      stopped = true;
      clearRetry();
      session.stop();
    },
  };
};

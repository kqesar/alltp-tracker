import type {
  BridgeInfo,
  DeviceDescriptor,
  Environment,
  SessionOptions,
  SessionStatus,
} from "@alltp/autotrack";
import { seedHashOf } from "@alltp/pack-alttpr";
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { bridgeOptions } from "@/autotrack/bridge";
import { createAutotrackLock } from "@/autotrack/lock";
import { mergeRaceChoice, type RaceChoice } from "@/autotrack/raceChoice";
import {
  isRaceModeOn,
  onRaceRestored,
  onRunReplaced,
  rememberRace,
} from "@/autotrack/raceMode";
import { onResync } from "@/autotrack/resync";
import { shownStatus } from "@/autotrack/status";
import type { Follower } from "@/games/alttpr/autotrack/follow";
import type { AutotrackReading } from "@/games/alttpr/autotrack/reading";
import type { Runtime, RuntimeSink } from "@/games/alttpr/autotrack/runtime";
import {
  checkSeed,
  revealedText,
  type SeedCheck,
  switchedText,
} from "@/games/alttpr/autotrack/seed";
import {
  loadSeedFile,
  type SeedFileResult,
  withSeedFile,
} from "@/games/alttpr/autotrack/seedFile";
import { withoutEscape } from "@/games/alttpr/logic/packItems";
import { useDarkRoomStore } from "@/games/alttpr/stores/darkRoomStore";
import { isFreshRun, useGameStore } from "@/games/alttpr/stores/gameStore";
import { syncAcrossTabs } from "@/games/syncAcrossTabs";
import { isObsView } from "@/utils/view";

type AutotrackState = {
  /**
   * Connect as the tracker opens. Connect sets it and Disconnect clears it,
   * so a player who autotracks once finds it on at the next visit, on this
   * device. The only field saved.
   */
  connectOnStart: boolean;
  /** A session runs, or loads: from Connect until Disconnect. */
  active: boolean;
  /**
   * Another tab of the tracker holds the session: this one waits, and takes
   * over when that one closes or disconnects.
   */
  elsewhere: boolean;
  /** The session's status, as it reports it (the diagnostic report's). */
  status: SessionStatus;
  /** The status the UI shows: a retry keeps the failure it retries. */
  shown: SessionStatus;
  /** When the session entered `status`, in ms since the epoch. */
  since: number;
  /** The bridge and the devices it listed, as last seen. */
  bridge: BridgeInfo | null;
  devices: readonly DeviceDescriptor[];
  /** The system and browser, once detected. */
  environment: Environment | null;
  /**
   * The game as last read, or null before the first read. The settings its
   * ROM does not state are the seed's file's once `seedFile` holds them.
   */
  reading: AutotrackReading | null;
  /**
   * The seed's file on alttpr.com, asked once per connection for a seed
   * whose name is a hash, outside Race Mode: its settings, or why there are
   * none, or "loading" while asked.
   */
  seedFile: {
    readonly hash: string;
    readonly result: SeedFileResult | "loading";
  } | null;
  /**
   * The seed whose run type the player chose to keep theirs for: no prompt
   * for it, now or at the next visit. Saved.
   */
  keptSeed: string | null;
  /**
   * What autotracking did of its own, which the live region says with the
   * status, then once more with the next one (a status that comes right
   * after would otherwise silence it), then drops.
   */
  news: { readonly text: string; readonly repeated: boolean } | null;
  /**
   * The session's code could not be fetched: offline before it was ever
   * cached, or a release since this page loaded replaced it.
   */
  unavailable: boolean;
  /**
   * Race Mode as the player set it: the ROM's race flag decides ("auto"),
   * or it is always on. Saved; the session follows a change at once.
   */
  raceChoice: RaceChoice;
  /**
   * This run's seed was read as a race's, and nobody called the race over:
   * Race Mode holds through a Disconnect and a reload (`autotrack/raceMode.ts`).
   * Saved.
   */
  raceSeen: boolean;
  /**
   * Draw a dark room's plan and Link's place in it while he has no Lamp (never
   * in Race Mode). On by default; a device setting, saved, that the session
   * follows at once: off, its memory is not read at all.
   */
  darkRoomMap: boolean;
  /**
   * How the dark room is drawn: in the game's own graphics, rebuilt from the
   * player's console and ROM ("art", the default, the plan while they load
   * or when they cannot be), or as the plan alone. A device setting, saved;
   * the session reads the picture's memory only for "art".
   */
  darkRoomStyle: DarkRoomStyle;
  setConnectOnStart: (connectOnStart: boolean) => void;
  setRaceChoice: (raceChoice: RaceChoice) => void;
  /** The player says the race is over: Race Mode is the run's again. */
  endRace: () => void;
  setDarkRoomMap: (darkRoomMap: boolean) => void;
  setDarkRoomStyle: (darkRoomStyle: DarkRoomStyle) => void;
};

/** The dark room map's styles: the game's graphics, or the plan. */
export type DarkRoomStyle = "art" | "plan";

/** The saved fields over the fresh ones: Race Mode and the dark room map checked. */
const mergeSaved = (
  persisted: unknown,
  current: AutotrackState,
): AutotrackState => {
  const saved =
    typeof persisted === "object" && persisted !== null
      ? (persisted as Partial<AutotrackState>)
      : {};
  return {
    ...mergeRaceChoice(persisted, current),
    // Absent from a save before the option, or not a boolean: the default, on
    darkRoomMap:
      typeof saved.darkRoomMap === "boolean" ? saved.darkRoomMap : true,
    // Absent, or a style this version does not know: the game's graphics
    darkRoomStyle: saved.darkRoomStyle === "plan" ? "plan" : "art",
  };
};

const IDLE: SessionStatus = { code: "idle" };
const STOPPED: SessionStatus = { code: "stopped" };

/**
 * Autotracking's state: the session's status and what it read. Kept apart
 * from the game store, so a status change never re-renders the board, and
 * nothing of it is saved but the player's wish to connect on start, the
 * seed whose run type they kept, and their Race Mode.
 */
export const useAutotrackStore = create<AutotrackState>()(
  persist(
    (set) => ({
      active: false,
      bridge: null,
      connectOnStart: false,
      darkRoomMap: true,
      darkRoomStyle: "art",
      devices: [],
      elsewhere: false,
      endRace: () => set({ raceSeen: false }),
      environment: null,
      keptSeed: null,
      news: null,
      raceChoice: "auto",
      raceSeen: false,
      reading: null,
      seedFile: null,
      setConnectOnStart: (connectOnStart) => set({ connectOnStart }),
      setDarkRoomMap: (darkRoomMap) => set({ darkRoomMap }),
      setDarkRoomStyle: (darkRoomStyle) => set({ darkRoomStyle }),
      setRaceChoice: (raceChoice) => set({ raceChoice }),
      shown: IDLE,
      since: 0,
      status: IDLE,
      unavailable: false,
    }),
    {
      merge: mergeSaved,
      name: "alltp-tracker-autotrack",
      partialize: ({
        connectOnStart,
        darkRoomMap,
        darkRoomStyle,
        keptSeed,
        raceChoice,
        raceSeen,
      }) => ({
        connectOnStart,
        darkRoomMap,
        darkRoomStyle,
        keptSeed,
        raceChoice,
        raceSeen,
      }),
      version: 1,
    },
  ),
);

const set = useAutotrackStore.setState;

// A race read is remembered; the run replaced (New game, Import, a shared
// link) ends it, and Undo back to the race's board brings it back
rememberRace(useAutotrackStore);
onRunReplaced((game) => {
  if (game !== "alttpr") return false;
  const held = useAutotrackStore.getState().raceSeen;
  set({ raceSeen: false });
  return held;
});
onRaceRestored((game) => {
  if (game === "alttpr") set({ raceSeen: true });
});

/** The one session of this page, once started. */
let runtime: Runtime | null = null;

/**
 * Race Mode as the UI shows it (`isRaceModeOn`, which `isRaceModeOrPending`
 * extends), for the decoders: a race remembered (`raceSeen`) holds them in a
 * race though the ROM's flag says open, so nothing a race keeps back is
 * decoded while the page says Race Mode. Left out: the last reading's own
 * `race`, which this decides, and the pending case, a flag not read yet,
 * which the session fails closed on itself (Race Mode until the flag says
 * open) and the store's copy of its status only follows.
 */
const raceHeldByPage = (state = useAutotrackStore.getState()) =>
  isRaceModeOn({ ...state, reading: null });

/**
 * Forget Standard's escape as autotracking read it: Race Mode came on (v2.0
 * forbids telling Zelda's rescue in a race), or no session reads it any
 * more. The escape then counts done, as by hand: the value never sticks.
 */
const forgetEscape = () =>
  useGameStore.getState().applyGameNews((board) => {
    const items = withoutEscape(board.items);
    return items === board.items ? null : { items };
  });

// The session follows the player's Race Mode as it changes, here or in
// another tab of the tracker (the choice is saved, and read again from
// storage): a tab that waits for the session can set it too
useAutotrackStore.subscribe((state, before) => {
  if (isRaceModeOn(state) && !isRaceModeOn(before)) forgetEscape();
  if (state.raceChoice !== before.raceChoice) {
    runtime?.setRaceMode(state.raceChoice);
  }
  if (raceHeldByPage(state) !== raceHeldByPage(before)) {
    runtime?.raceChanged();
  }
  if (state.darkRoomMap !== before.darkRoomMap) {
    runtime?.setDarkRoom(state.darkRoomMap);
    if (!state.darkRoomMap) useDarkRoomStore.getState().show(null);
  }
  if (state.darkRoomStyle !== before.darkRoomStyle) {
    runtime?.setDarkRoomArt(state.darkRoomStyle === "art");
    if (state.darkRoomStyle !== "art") {
      useDarkRoomStore.getState().showArt(null);
    }
  }
});
syncAcrossTabs(useAutotrackStore);

/** The board's side of the session: what it read, laid on the run. */
let follower: Follower | null = null;

// A run replaced under a connected session (New game, Import, a shared link,
// a new run type): the game lays on the new board at once, not only when it
// next changes. Not connected: the next reading does
onResync((game) => {
  if (game === "alttpr") {
    follower?.resync(useAutotrackStore.getState().status.code === "connected");
  }
});

/**
 * Bumped by every connect and stop: a start that loses a race with a stop
 * (a double click, StrictMode's double effect) finds it changed and gives up.
 */
let generation = 0;

/** Session options of the tests' own: a transport, a clock... */
let overrides: Partial<Omit<SessionOptions, "pack">> = {};

/**
 * Replace the session's defaults (the usb2snes transport at the bridge's
 * address, the system clock, permission and visibility). For tests.
 */
export const setAutotrackOptions = (
  options: Partial<Omit<SessionOptions, "pack">>,
) => {
  overrides = options;
};

const loadRuntime = () => import("@/games/alttpr/autotrack/runtime");

/**
 * Fetch the session's code ahead of a click on Connect: the dialog asks as it
 * opens, so the connection starts in the same moment as the click, while the
 * browser still counts it as the player's (its permission prompt answers one).
 */
export const preloadAutotrack = () => {
  loadRuntime().catch(() => {});
};

/** The seed this page switched the run type to, which it never does twice. */
let switched: string | null = null;

/** Start the seed's run type, the game laid on it, as one undo step. */
const switchRun = (check: Extract<SeedCheck, { kind: "differs" }>) => {
  switched = check.seed;
  if (follower) follower.switchRun(check.presetId, check.settings);
  else useGameStore.getState().applyRun(check.presetId, check.settings);
};

/**
 * Hold the seed read against the board's run type: on a fresh board, a seed
 * of another run type switches it at once, and the live region says so;
 * else SeedPrompt asks the player (useSeedCheck), unless they kept their run
 * type for this seed or the page already switched to it once.
 * @param reading - The reading, its seed's file laid on it
 * @param fresh - Whether the board holds nothing of the player's: fresh,
 * before the reading is laid on it
 */
const followSeed = (
  reading: AutotrackReading,
  fresh = isFreshRun(useGameStore.getState()),
) => {
  const check = checkSeed(reading.seed, useGameStore.getState());
  // A Mystery run takes what the seed reveals at once, as the game's news
  if (check.kind === "reveals") {
    useGameStore.getState().revealSettings(check.change);
    set({ news: { repeated: false, text: revealedText(check) } });
    return;
  }
  if (
    check.kind === "differs" &&
    check.seed !== switched &&
    check.seed !== useAutotrackStore.getState().keptSeed &&
    fresh
  ) {
    switchRun(check);
    set({ news: { repeated: false, text: switchedText(check) } });
  }
};

/** A reading with its seed's file laid on it, once the file is in. */
const withFile = (reading: AutotrackReading): AutotrackReading => {
  const file = useAutotrackStore.getState().seedFile;
  return reading.race || file === null || typeof file.result === "string"
    ? reading
    : { ...reading, seed: withSeedFile(reading.seed, file.result) };
};

/**
 * The seed's hash, when alttpr.com keeps a file for it and the tracker may
 * ask for it: never in Race Mode. The file holds the seed's patch, every
 * item placement with it, and the ALTTPR Auto-tracker Rules v2.0 bar a
 * tracker from accessing location contents before or during a race; the run
 * type is then the racer's to pick.
 */
const hashOf = (reading: AutotrackReading): string | null => {
  if (reading.race) return null;
  const name = reading.seed.seed;
  // A name of another generator's is no alttpr.com hash
  return name !== null && seedHashOf(name) === name ? name : null;
};

/** Whether the seed's run type waits for its file, still on its way. */
const awaitsFile = (reading: AutotrackReading): boolean => {
  const hash = hashOf(reading);
  const file = useAutotrackStore.getState().seedFile;
  return hash !== null && (file?.hash !== hash || file.result === "loading");
};

/**
 * Ask alttpr.com for the seed's file, once per connection and outside Race
 * Mode only: it states what the ROM does not (item placement, accessibility,
 * item pool and functionality, whether it is a Mystery seed). When it comes,
 * or cannot, the seed's run type is held against the board's.
 */
const askSeedFile = (reading: AutotrackReading, mine: number) => {
  const hash = hashOf(reading);
  if (hash === null || useAutotrackStore.getState().seedFile?.hash === hash) {
    return;
  }
  set({ seedFile: { hash, result: "loading" } });
  void loadSeedFile(hash).then((result) => {
    // Another seed may have been loaded since
    const asked = useAutotrackStore.getState().seedFile?.hash === hash;
    if (mine !== generation || !asked) return;
    set({ seedFile: { hash, result } });
    const last = useAutotrackStore.getState().reading;
    if (last === null) return;
    const reading = withFile(last);
    if (reading !== last) set({ reading });
    // The game is on the board by now: it is fresh if it holds nothing else
    followSeed(reading, follower?.holdsGameOnly() ?? false);
  });
};

/**
 * Reports from the runtime of `mine`. A status from one since stopped (the
 * "stopped" its stop() reports) is dropped: what replaced it decides.
 */
const sinkFor = (mine: number): RuntimeSink => ({
  // The dark room has a store of its own: it never touches the reading, so
  // the board and the run know nothing of it
  darkRoom: (room) => {
    if (mine === generation) useDarkRoomStore.getState().show(room);
  },
  // Its picture too: memory only, beside it
  darkRoomArt: (art) => {
    if (mine === generation) useDarkRoomStore.getState().showArt(art);
  },
  // A stopped session never reads again: no reading outlives its session
  reading: (read) => {
    if (mine !== generation) return;
    // Race Mode turned on mid-session: a file asked before is let go
    if (read.race && useAutotrackStore.getState().seedFile !== null) {
      set({ seedFile: null });
    }
    const reading = withFile(read);
    // A seed with a file on alttpr.com is held against the board once the
    // file has settled (askSeedFile): the two never switch it twice
    if (!awaitsFile(reading)) followSeed(reading);
    set({ reading });
    follower?.read(reading);
    askSeedFile(reading, mine);
  },
  status: (status, since, { bridge, devices }) => {
    if (mine !== generation) return;
    // The game no longer read: the escape it said goes, and comes back with
    // the next reading in play
    if (
      status.code !== "connected" &&
      useAutotrackStore.getState().status.code === "connected"
    ) {
      forgetEscape();
      follower?.resume();
    }
    set((state) => ({
      ...(status.code !== state.status.code && {
        news:
          state.news === null || state.news.repeated
            ? null
            : { ...state.news, repeated: true },
      }),
      // The session stops itself on a bug only (a read Race Mode refused)
      ...(status.code === "stopped" && { active: false }),
      bridge,
      devices,
      shown: shownStatus(state.shown, status),
      since,
      status,
    }));
  },
  steady: (at) => {
    if (mine === generation) follower?.steady(at);
  },
});

/** The Web Lock one tab of the tracker holds while it autotracks. */
const lock = createAutotrackLock();

/**
 * Start autotracking: load the session's code if needed, then connect, and
 * keep connecting until Disconnect. Never more than one session: a second
 * call while one runs does nothing, and across the tracker's tabs the first
 * to connect holds the session while the others wait (`elsewhere`). The
 * stream view (`?view=obs`) never connects: the tracker it shows on stream
 * holds the session, and the view follows the run through the shared
 * storage.
 */
export const connectAutotrack = async () => {
  if (isObsView() || useAutotrackStore.getState().active) return;
  const mine = ++generation;
  set({
    active: true,
    connectOnStart: true,
    elsewhere: false,
    news: null,
    reading: null,
    seedFile: null,
    shown: IDLE,
    status: IDLE,
    unavailable: false,
  });
  try {
    const loading = loadRuntime();
    // Waiting for another tab must not leave a failed fetch unhandled
    loading.catch(() => {});
    const held = await lock.take(
      () => mine === generation,
      (elsewhere) => set({ elsewhere }),
    );
    if (!held) return;
    const { createFollower, detectEnvironment, startRuntime } = await loading;
    const environment =
      useAutotrackStore.getState().environment ?? (await detectEnvironment());
    const bridge = await bridgeOptions();
    if (mine !== generation) return;
    set({ environment });
    follower = createFollower();
    runtime = startRuntime(
      {
        environment,
        ...bridge,
        darkRoom: useAutotrackStore.getState().darkRoomMap,
        darkRoomArt: useAutotrackStore.getState().darkRoomStyle === "art",
        raceHeld: raceHeldByPage,
        raceSetting: useAutotrackStore.getState().raceChoice,
        ...overrides,
      },
      sinkFor(mine),
    );
  } catch {
    if (mine === generation) set({ active: false, unavailable: true });
  }
};

/**
 * Stop the session, if any, and forget what it read; the wish to connect on
 * start stays. The tracker calls it as it goes away.
 */
export const stopAutotrack = () => {
  generation++;
  runtime?.stop();
  runtime = null;
  follower = null;
  forgetEscape();
  useDarkRoomStore.getState().show(null);
  lock.release();
  set({
    active: false,
    elsewhere: false,
    news: null,
    reading: null,
    seedFile: null,
    shown: STOPPED,
    since: Date.now(),
    status: STOPPED,
  });
};

/** Stop autotracking at the player's word: no reconnection on the next visit. */
export const disconnectAutotrack = () => {
  stopAutotrack();
  set({ connectOnStart: false, unavailable: false });
};

/** Retry now rather than after the session's wait. */
export const retryAutotrack = () => runtime?.retryNow();

/**
 * Set the board to what the game holds, the player's marks beyond it
 * included: one undo step.
 * @returns How many values changed, or null before any game in play was read
 */
export const syncFromGame = (): number | null => follower?.sync() ?? null;

/**
 * What the seed last read says of the board's run type, kept in step with
 * both: null before a reading.
 */
export const useSeedCheck = (): SeedCheck | null => {
  const seed = useAutotrackStore((state) => state.reading?.seed ?? null);
  const presetId = useGameStore((state) => state.presetId);
  const settings = useGameStore((state) => state.settings);
  return useMemo(
    () => (seed === null ? null : checkSeed(seed, { presetId, settings })),
    [seed, presetId, settings],
  );
};

/** The seed's check now, for an action. */
const seedCheckNow = (): SeedCheck | null => {
  const { reading } = useAutotrackStore.getState();
  return reading === null
    ? null
    : checkSeed(reading.seed, useGameStore.getState());
};

/**
 * Switch the run type to the seed's, the player's answer to SeedPrompt: a
 * new run with what the game holds laid on it, one undo step.
 */
export const switchToSeed = () => {
  const check = seedCheckNow();
  if (check?.kind !== "differs") return;
  switchRun(check);
  set({ news: { repeated: false, text: switchedText(check) } });
};

/** Keep the player's run type for this seed: no prompt for it again. */
export const keepRunType = () => {
  const check = seedCheckNow();
  if (check?.kind === "differs") set({ keptSeed: check.seed });
};

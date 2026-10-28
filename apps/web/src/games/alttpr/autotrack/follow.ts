// The board following the game, for one autotracking session: each reading
// laid on the run as it comes, and the player's "Sync from game".
//
// A reading lays only its news, what the game says that it did not at the
// last reading: the board changes when the game does, and a mark the player
// changed by hand stays as they left it until the game changes that value
// again. The first reading of a session lays everything, towards progress
// only. Nothing is laid while no game is in play (the title screen, the file
// select): memory there is not the run's.
//
// The seed the game names in its header (race seeds too: the title is on
// the screen) is recorded as the run's `seed`.
//
// Outside Race Mode, the doors and holes Link goes through are noted in a run
// whose shuffled entrances the assistant knows: the entrance tables load on
// demand, as for the assistant, and the notes land as the game's news.

import type { EntranceReading } from "@alltp/pack-alttpr";
import {
  type GameView,
  gameView,
  isEmptyView,
  medallionsShown,
  mergeView,
  newsOf,
  syncView,
} from "@/games/alttpr/autotrack/apply";
import type { AutotrackReading } from "@/games/alttpr/autotrack/reading";
import { entrancesKnown, type RunSettings } from "@/games/alttpr/data/presets";
import { gameClockOf, timerNews } from "@/games/alttpr/logic/timer";
import {
  createProgress,
  useGameStore,
  withNotes,
} from "@/games/alttpr/stores/gameStore";
import { recordSeed } from "@/games/seedId";
import { type GameClock, isRunning } from "@/utils/runTimer";

/** The board's side of a session. */
export type Follower = {
  /** Lay a reading's news on the board. */
  read: (reading: AutotrackReading) => void;
  /**
   * A poll read memory and found it unchanged at `at`: the game stands still
   * (a paused emulator), so a timer set on its clock stops at its last time
   * until a reading moves it again.
   */
  steady: (at: number) => void;
  /**
   * Set the board to all the game holds, as one undo step.
   * @returns How many values changed, or null before any game in play was read
   */
  sync: () => number | null;
  /**
   * Start a new run of the seed's run type with what the game holds laid on
   * it, as one undo step: undoing it brings the board back as it was.
   */
  switchRun: (presetId: string, settings: RunSettings) => void;
  /**
   * Whether the board holds the game alone: a new run of its run type with
   * what the game holds laid on it, nothing the player marked beyond.
   */
  holdsGameOnly: () => boolean;
  /**
   * Lay all the game says at the next reading, as at the first: the board
   * lost a value the game still holds (the escape, forgotten when the
   * connection dropped).
   */
  resume: () => void;
  /**
   * The board was replaced by another run (New game, Import, a shared link, a
   * new run type): lay all the game says on it, as at the first reading.
   * @param now - Whether the game is read now; else it waits for the next
   * reading, as after `resume`
   */
  resync: (now: boolean) => void;
};

/** Two records or arrays with the same values under the same keys. */
const sameValues = (a: object, b: object) => {
  const entries = Object.entries(a);
  return (
    entries.length === Object.keys(b).length &&
    entries.every(
      ([key, value]) => (b as Record<string, unknown>)[key] === value,
    )
  );
};

/** Start following the game, for a new session. */
export const createFollower = (): Follower => {
  /** The last reading of a game in play, and the view taken of it. */
  let last: AutotrackReading | null = null;
  let shown: GameView | null = null;
  /** Whether the last reading was of a game in play, `last` being its. */
  let playing = false;
  /**
   * Whether the reading before was before play (the title, the file select,
   * the spawn select), for the timer to see a game start; undefined until a
   * reading says.
   */
  let beforePlay: boolean | undefined;
  /** Whether the reading before was at the goal. */
  let atGoal = false;
  /** The game's frame counter at the last reading, if it was read. */
  let frames: number | undefined;
  /** The game's clock the timer was last set on, to hold it if the game stops. */
  let lastClock: GameClock | undefined;
  /**
   * The medallions the game has shown, by slot of the board's `medallions`:
   * a reading shows one only while its pad's screen is in view (or its
   * entrance open), so the session keeps what was shown. The game never
   * un-shows one; Race Mode, if a race seed replaces the game in the session,
   * starts it over.
   */
  const known: Record<number, number> = {};
  /**
   * Whether a reading saw Link carry the big bomb, which only its purchase
   * gives him: memory keeps no flag of the Bomb Merchant, and the bomb goes
   * once it blows up, so the session keeps that it was bought. Outside Race
   * Mode only, which starts it over as it does the medallions.
   */
  let bombBought = false;
  /** The doors and holes last noted, to note only what the game shows anew. */
  let noted: string | null = null;
  /** The seed the last reading in play named. */
  let seedName: string | null = null;

  /**
   * Forget what the session kept of the run it followed: the medallions
   * shown, the bomb bought, the entrances noted. The run was replaced, or the
   * game is on another seed: none of it is this run's.
   */
  const forget = () => {
    for (const slot of Object.keys(known)) delete known[Number(slot)];
    bombBought = false;
    noted = null;
  };

  /**
   * Note where the game shows Link went, once per change, in a run whose
   * entrances the assistant knows. A note it contradicts gives way.
   */
  const noteEntrances = (links: EntranceReading) => {
    if (typeof links === "string" || links.length === 0) return;
    if (!entrancesKnown(useGameStore.getState().settings)) return;
    const key = JSON.stringify(links);
    if (key === noted) return;
    noted = key;
    void import("@/games/alttpr/logic/entrances").then(
      ({ gameNotes, poolOf }) =>
        useGameStore.getState().applyGameNews((board) => {
          const pool = poolOf(board.settings);
          if (pool === null) return null;
          const notes = gameNotes(pool, board.entrances, links);
          const entrances = withNotes(board.entrances, notes);
          return entrances === null ? null : { entrances };
        }),
    );
  };

  /**
   * Lay a reading of a game in play on the board: the news against the view
   * shown before, all of it when none was.
   */
  const lay = (reading: AutotrackReading) => {
    const name = reading.seed.seed;
    if (seedName !== null && name !== null && name !== seedName) forget();
    if (name !== null) seedName = name;
    noteEntrances(reading.entrances);
    recordSeed(useGameStore, reading.seed.seed);
    const store = useGameStore.getState();
    if (reading.race) {
      for (const slot of Object.keys(known)) delete known[Number(slot)];
      bombBought = false;
    } else {
      Object.assign(known, medallionsShown(reading));
      if (reading.progress.bigBomb === true) bombBought = true;
    }
    const view = gameView(reading, store, known, bombBought);
    const news = shown === null ? view : newsOf(shown, view);
    last = reading;
    shown = view;
    if (isEmptyView(news)) return;
    store.applyGameNews((board) => mergeView(board, news)?.next ?? null);
  };

  return {
    holdsGameOnly: () => {
      const store = useGameStore.getState();
      const fresh = createProgress(store.presetId, store.settings);
      const game =
        last === null
          ? null
          : syncView(fresh, gameView(last, fresh, known, bombBought))?.next;
      const run = { ...fresh, ...game };
      return (
        sameValues(run.items, store.items) &&
        sameValues(run.checked, store.checked) &&
        sameValues(run.medallions, store.medallions) &&
        sameValues(run.smallKeys, store.smallKeys)
      );
    },
    read: (reading) => {
      // The run timer follows the game: set on the game's own clock if the
      // player chose that and it can be read, else started and stopped by
      // the game if the player lets it
      const game = useGameStore.getState();
      const clock =
        game.timerClock === "game"
          ? gameClockOf(reading.race, reading.progress, frames)
          : "unavailable";
      const { romStats } = reading.progress;
      frames =
        reading.race || typeof romStats === "string"
          ? undefined
          : romStats.playFrames;
      lastClock = typeof clock === "object" ? clock : undefined;
      if (typeof clock === "object") game.alignTimer(clock, reading.at);
      else if (clock === "unloaded") {
        // The title or the file select: the game's time is not there to read
        if (isRunning(game.timer)) game.pauseTimer(reading.at);
      } else if (game.autoTimer) {
        const news = timerNews(
          beforePlay,
          reading.progress,
          game.timer,
          atGoal,
        );
        if (news === "start") game.startTimer(reading.at);
        if (news === "finish") game.finishTimer(reading.at);
      }
      const { beforePlay: now } = reading.progress;
      if (typeof now === "boolean") beforePlay = now;
      atGoal = reading.progress.goal === true;
      playing = reading.progress.started === true;
      if (!playing) return;
      lay(reading);
    },
    resume: () => {
      shown = null;
    },
    resync: (now) => {
      shown = null;
      // Nothing the session kept belongs to the run replaced
      forget();
      if (now && playing && last !== null) lay(last);
    },
    steady: (at) => {
      const game = useGameStore.getState();
      if (game.timerClock === "game" && lastClock?.status === "running") {
        game.alignTimer({ ms: lastClock.ms, status: "paused" }, at);
        lastClock = { ms: lastClock.ms, status: "paused" };
      }
    },
    switchRun: (presetId, settings) => {
      const reading = last;
      useGameStore.getState().applyRun(
        presetId,
        settings,
        (fresh) =>
          reading === null
            ? null
            : (syncView(fresh, gameView(reading, fresh, known, bombBought))
                ?.next ?? null),
        // The timer the game just started goes on in the seed's run
        true,
      );
    },
    sync: () => {
      if (last === null) return null;
      const store = useGameStore.getState();
      const laid = syncView(store, gameView(last, store, known, bombBought));
      if (laid !== null) store.syncWithGame(laid.next);
      return laid?.count ?? 0;
    },
  };
};

// The SMZ3 run following the game, for one autotracking session: each
// reading's news laid on the run as the game's (no undo step), towards
// progress only, as the other boards follow theirs (games/sm/autotrack/
// follow.ts). Nothing is laid while the running game is not in play.
//
// - An item takes the game's count when that count changes, or more if the
//   player marked more: the game never takes back a find.
// - A location the game says checked is checked; one it does not stays as
//   the player left it.
// - The seed's guid, outside races, is recorded as the run's `seed`.
// - The settings the ROM states (Super Metroid's logic, keysanity) and,
//   outside races, its requirements and medallions follow the seed.
//
// The run timer follows the game too, whether or not a game is in play: the
// player's "Start and stop with the game" starts it on the first reading in
// play after one before play (in whichever game the file starts in) and stops
// it when the credits run, and "Game time" sets it on the games' frame
// counters, summed (the pack's `decodeGameClock`).

import { type Smz3Settings, smz3Ms } from "@alltp/pack-smz3";
import { gameClockOf, timerNews } from "@/games/gameTimer";
import { recordSeed } from "@/games/seedId";
import type { Smz3Reading } from "@/games/smz3/autotrack/reading";
import {
  type Smz3Pads,
  type Smz3Progress,
  useSmz3Store,
} from "@/games/smz3/store";
import { type GameClock, isIdle, timerState } from "@/utils/runTimer";

/** What the game says, kept to tell news from what it said before. */
type View = {
  items: Readonly<Record<string, number>>;
  checked: ReadonlySet<string>;
  settings: Partial<Smz3Settings>;
  pads: Partial<Smz3Pads>;
};

/** The entries whose value memory told: none null or undefined. */
const known = <T extends object>(
  entries: {
    [K in keyof T]?: T[K] | null;
  },
): Partial<T> =>
  Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value != null),
  ) as Partial<T>;

const viewOf = (reading: Smz3Reading): View => {
  const seed = typeof reading.seed === "string" ? null : reading.seed;
  const asked =
    typeof reading.requirements === "string" ? null : reading.requirements;
  return {
    checked: new Set(
      typeof reading.checked === "string" ? [] : reading.checked,
    ),
    items: typeof reading.items === "string" ? {} : reading.items,
    pads: known<Smz3Pads>({
      mire: asked?.mire,
      turtleRock: asked?.turtleRock,
    }),
    settings: known<Smz3Settings>({
      ganonCrystals: asked?.ganonCrystals,
      keysanity: seed?.keysanity,
      smLogic: seed?.smLogic,
      tourianBosses: asked?.tourianBosses,
      towerCrystals: asked?.towerCrystals,
    }),
  };
};

/** The entries of `now` that are new to `before`. */
const newIn = <T extends object>(now: T, before: T | undefined) =>
  Object.fromEntries(
    Object.entries(now).filter(
      ([key, value]) =>
        before === undefined || before[key as keyof T] !== value,
    ),
  ) as Partial<T>;

/** Start following the game, for a new session. */
export const createSmz3Follower = () => {
  let shown: View | null = null;
  /** The last reading of a game in play, and whether the last one was. */
  let last: Smz3Reading | null = null;
  let playing = false;
  /**
   * Whether a reading before play came since the last one in play, for the
   * timer to see a game start; the readings between (a portal, a load) leave
   * it as it is, so a file that starts in either game starts the timer.
   */
  let armed = false;
  /** Whether the reading before was at the goal. */
  let atGoal = false;
  /** The sum of the counters as last read, to tell a game that stands still. */
  let frames: number | undefined;
  /** The game's clock the timer was last set on, to hold it if the game stops. */
  let lastGame: GameClock | undefined;

  /**
   * The run timer follows the game: started and stopped by it if the player
   * lets it, set on the game's time if the player chose that. The time is the
   * game's: a death or a reload sets both counters back to the last save, and
   * the timer goes back with them, as the credits' total would.
   */
  const followTimer = (reading: Smz3Reading) => {
    const run = useSmz3Store.getState();
    const now =
      typeof reading.clock === "object" ? reading.clock.frames : undefined;
    const moving = now !== frames;
    frames = now;

    const news = run.autoTimer
      ? timerNews(armed, reading, run.timer, atGoal)
      : null;
    if (news === "start") run.startTimer(reading.at);
    const after = useSmz3Store.getState();
    lastGame = undefined;
    // On game time the credits' own total is the stop: the tick that sees
    // the credits has not read the counters yet (a new mode), and a timer
    // finished on real time could not be set right
    const awaitsClock =
      after.timerClock === "game" && reading.clock === "not-read";
    // Game time: only a timer that has begun is set on the counters
    if (
      after.timerClock === "game" &&
      now !== undefined &&
      !isIdle(after.timer) &&
      timerState(after.timer) !== "finished"
    ) {
      lastGame = gameClockOf(
        smz3Ms(now),
        reading.goal,
        moving,
        after.autoTimer,
      );
      after.alignTimer(lastGame, reading.at);
    } else if (news === "finish" && !awaitsClock) {
      after.finishTimer(reading.at);
    }
    if (reading.beforePlay === true) armed = true;
    else if (reading.inPlay === true) armed = false;
    // The goal not yet taken in (the counters unread) is still to come
    atGoal = reading.goal === true && !awaitsClock;
  };

  /** Lay a reading in play on the run: the news against the view shown. */
  const lay = (reading: Smz3Reading) => {
    recordSeed(
      useSmz3Store,
      typeof reading.guid === "string" ? null : reading.guid.guid,
    );
    const now = viewOf(reading);
    const before = shown;
    shown = now;
    const itemNews = Object.entries(newIn(now.items, before?.items));
    const checkNews = [...now.checked].filter(
      (id) => before === null || !before.checked.has(id),
    );
    const settingNews = newIn(now.settings, before?.settings);
    const padNews = newIn(now.pads, before?.pads);
    if (
      itemNews.length === 0 &&
      checkNews.length === 0 &&
      Object.keys(settingNews).length === 0 &&
      Object.keys(padNews).length === 0
    ) {
      return;
    }
    useSmz3Store.getState().applyGameNews((run) => {
      const change: Partial<Smz3Progress> = {};
      if (itemNews.length > 0) {
        const items = { ...run.items };
        for (const [id, count] of itemNews) {
          items[id] = Math.max(items[id] ?? 0, count ?? 0);
        }
        change.items = items;
      }
      if (checkNews.length > 0) {
        change.checked = [...new Set([...run.checked, ...checkNews])];
      }
      if (Object.keys(settingNews).length > 0) {
        change.settings = { ...run.settings, ...settingNews };
      }
      if (Object.keys(padNews).length > 0) {
        change.pads = { ...run.pads, ...padNews };
      }
      return change;
    });
  };

  return {
    /** Lay a reading's news on the run. */
    read: (reading: Smz3Reading) => {
      followTimer(reading);
      playing = reading.inPlay === true;
      if (!playing) return;
      last = reading;
      lay(reading);
    },
    /**
     * The run was replaced (New game, Import, a shared link): lay all the
     * game says on the new one, now if the game in play was read last, else
     * with the next reading in play.
     */
    resync: (now: boolean) => {
      shown = null;
      if (now && playing && last !== null) lay(last);
    },
    /**
     * A poll read memory and found it unchanged at `at`: the game stands
     * still (a paused emulator), so a timer set on its counters stops at its
     * last time until a reading moves it again.
     */
    steady: (at: number) => {
      const run = useSmz3Store.getState();
      if (run.timerClock === "game" && lastGame?.status === "running") {
        lastGame = { ms: lastGame.ms, status: "paused" };
        run.alignTimer(lastGame, at);
      }
    },
  };
};

// The Super Metroid run following the game, for one autotracking session:
// each reading's news laid on the run as the game's (no undo step), towards
// progress only, as ALttPR's board follows its game (games/alttpr/autotrack/
// follow.ts). Nothing is laid while no game is in play.
//
// - An item takes the game's count when that count changes, or more if the
//   player marked more: the game never takes back a find.
// - The seed's objectives are the ROM's: its table says which the seed asks
//   for. An objective the game says done is done; one it does not say done
//   stays as the player left it. In Race Mode (on by default: Map Rando's ROM
//   has no race flag) the table is not read: the player sets the objectives,
//   and the game marks done those of them a boss kill completes.
// - The seed's name is recorded as the run's `seed` (outside Race Mode).
// - The items the seed adds (the Wall Jump Boots, the split Speed Booster)
//   follow its settings (outside Race Mode; the player's in it).
// - A location the game says collected is added to the run's `found` with
//   the run timer's reading and the instant it was seen, and never taken
//   back, as an item is not. The decoder leaves the Nothing locations out,
//   and Race Mode never reads the bits, so a run tracked in Race Mode keeps
//   none.
//
// The run timer follows the game too, outside Race Mode, whether or not a game
// is in play: the player's "Start and stop with the game" starts it on the
// first reading in play after one before play and stops it at the goal, and
// "Game time" sets it on Map Rando's RTA clock (timer.ts).

import {
  type ClockReading,
  clockStraddled,
  type LocationKey,
  type SmItemId,
} from "@alltp/pack-sm";
import { gameClockOf, timerNews } from "@/games/gameTimer";
import { recordSeed } from "@/games/seedId";
import type { SmReading } from "@/games/sm/autotrack/reading";
import { clockBaseOf } from "@/games/sm/autotrack/timer";
import { type SmProgress, useSmStore } from "@/games/sm/store";
import { stampOf } from "@/games/stamp";
import { type GameClock, isIdle, timerState } from "@/utils/runTimer";

/** What the game says, kept to tell news from what it said before. */
type View = {
  found: ReadonlySet<LocationKey>;
  items: Readonly<Record<string, number>>;
  objectives: string;
  done: readonly string[];
  wallJump: boolean | null;
  splitSpeed: boolean | null;
};

const NO_LOCATIONS: ReadonlySet<LocationKey> = new Set();

/**
 * The objectives the game says done. In Race Mode, which reads neither the
 * seed's objectives nor the events, the boss kills among those the player
 * set (`objectives`, the run's).
 */
const doneOf = (
  reading: SmReading,
  objectives: readonly string[],
): readonly string[] => {
  if (reading.race) {
    return typeof reading.bossKills === "string"
      ? []
      : reading.bossKills.filter((id) => objectives.includes(id));
  }
  return typeof reading.objectives === "string"
    ? []
    : reading.objectives
        .filter(({ done }) => done)
        .map(({ objective }) => objective.id);
};

const viewOf = (reading: SmReading, objectives: readonly string[]): View => ({
  done: doneOf(reading, objectives),
  found:
    typeof reading.collected === "string" ? NO_LOCATIONS : reading.collected,
  items: typeof reading.items === "string" ? {} : reading.items,
  objectives:
    typeof reading.objectives === "string"
      ? ""
      : reading.objectives.map(({ objective }) => objective.id).join(","),
  splitSpeed: typeof reading.seed === "string" ? null : reading.seed.splitSpeed,
  wallJump: typeof reading.seed === "string" ? null : reading.seed.wallJump,
});

/** Start following the game, for a new session. */
export const createSmFollower = () => {
  let shown: View | null = null;
  /** The last reading of a game in play, and whether the last one was. */
  let last: SmReading | null = null;
  let playing = false;
  /**
   * Whether the reading before was before play, for the timer to see a game
   * start; undefined until a reading says.
   */
  let beforePlay: boolean | undefined;
  /** The RTA clock as last read, and the frames of the last reading taken. */
  let lastClock: ClockReading | undefined;
  let frames: number | undefined;
  /** The game's clock the timer was last set on, to hold it if the game stops. */
  let lastGame: GameClock | undefined;

  /**
   * The run timer follows the game: started and stopped by it if the player
   * lets it, set on the RTA clock if the player chose that.
   */
  const followTimer = (reading: SmReading) => {
    const run = useSmStore.getState();
    // A reading split by a flush of the clock is no time: the timer goes on
    // from the last one
    let now: number | undefined;
    if (typeof reading.clock === "object") {
      if (!clockStraddled(lastClock, reading.clock)) now = reading.clock.frames;
      lastClock = reading.clock;
    } else lastClock = undefined;
    const moving = now !== frames;
    if (now !== undefined) frames = now;
    else if (reading.clock === "not-read") frames = undefined;

    // In Race Mode the timer is the player's: no Map Rando race rule speaks
    // of a tracker starting or stopping it
    const news =
      run.autoTimer && !reading.race
        ? timerNews(beforePlay, reading, run.timer)
        : null;
    if (news === "start") {
      // The clock's frames at the run's 0: the game's time counts from here
      if (now !== undefined) run.setClockBase(now);
      run.startTimer(reading.at);
    }
    const after = useSmStore.getState();
    lastGame = undefined;
    // Game time: only a timer that has begun is set on the clock
    if (
      after.timerClock === "game" &&
      now !== undefined &&
      !isIdle(after.timer) &&
      timerState(after.timer) !== "finished"
    ) {
      const { base, ms } = clockBaseOf(
        now,
        after.clockBase,
        after.timer,
        reading.at,
      );
      if (base !== after.clockBase) after.setClockBase(base);
      lastGame = gameClockOf(ms, reading.goal, moving, after.autoTimer);
      after.alignTimer(lastGame, reading.at);
    } else if (news === "finish") after.finishTimer(reading.at);
    if (typeof reading.beforePlay === "boolean") {
      beforePlay = reading.beforePlay;
    }
  };

  /** Lay a reading in play on the run: the news against the view shown. */
  const lay = (reading: SmReading, at: number) => {
    recordSeed(
      useSmStore,
      typeof reading.seed === "string" ? null : reading.seed.name,
    );
    const now = viewOf(reading, useSmStore.getState().objectives);
    const before = shown;
    shown = now;
    const itemNews = Object.entries(now.items).filter(
      ([id, count]) => before === null || before.items[id] !== count,
    );
    const objectivesNews =
      now.objectives !== "" &&
      (before === null || before.objectives !== now.objectives);
    const doneNews = now.done.filter(
      (id) => before === null || !before.done.includes(id),
    );
    const foundNews = [...now.found].filter(
      (key) => before === null || !before.found.has(key),
    );
    const options = (["wallJump", "splitSpeed"] as const).filter(
      (option) =>
        now[option] !== null &&
        (before === null || before[option] !== now[option]),
    );
    if (
      itemNews.length === 0 &&
      !objectivesNews &&
      doneNews.length === 0 &&
      foundNews.length === 0 &&
      options.length === 0
    ) {
      return;
    }
    // One stamp for the reading, taken after the timer followed it
    const stamp = stampOf(useSmStore.getState().timer, at);
    useSmStore.getState().applyGameNews((run) => {
      const change: Partial<SmProgress> = {};
      if (itemNews.length > 0) {
        const items = { ...run.items };
        for (const [id, count] of itemNews) {
          items[id as SmItemId] = Math.max(items[id as SmItemId] ?? 0, count);
        }
        change.items = items;
      }
      const objectives = objectivesNews
        ? now.objectives.split(",")
        : run.objectives;
      if (objectivesNews) change.objectives = objectives;
      if (objectivesNews || doneNews.length > 0) {
        change.done = [...new Set([...run.done, ...doneNews])].filter((id) =>
          objectives.includes(id),
        );
      }
      // A location found keeps its first stamp, and is never taken back
      const fresh = foundNews.filter((key) => run.found[key] === undefined);
      if (fresh.length > 0) {
        change.found = {
          ...run.found,
          ...Object.fromEntries(fresh.map((key) => [key, stamp])),
        };
      }
      for (const option of options) {
        change[option] = now[option] === true;
      }
      return change;
    });
  };

  return {
    /** Lay a reading's news on the run. */
    read: (reading: SmReading) => {
      followTimer(reading);
      playing = reading.inPlay === true;
      if (!playing) return;
      last = reading;
      lay(reading, reading.at);
    },
    /**
     * The run was replaced (New game, Import, a shared link): lay all the
     * game says on the new one, now if the game in play was read last, else
     * with the next reading in play.
     */
    resync: (now: boolean) => {
      shown = null;
      if (now && playing && last !== null) lay(last, Date.now());
    },
    /**
     * A poll read memory and found it unchanged at `at`: the game stands
     * still (a paused emulator), so a timer set on its clock stops at its
     * last time until a reading moves it again.
     */
    steady: (at: number) => {
      const run = useSmStore.getState();
      if (run.timerClock === "game" && lastGame?.status === "running") {
        lastGame = { ms: lastGame.ms, status: "paused" };
        run.alignTimer(lastGame, at);
      }
    },
  };
};

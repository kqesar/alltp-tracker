// The Super Metroid run following the game, for one autotracking session:
// each reading's news laid on the run as the game's (no undo step), towards
// progress only, as ALttPR's board follows its game (games/alttpr/autotrack/
// follow.ts). Nothing is laid while no game is in play.
//
// - An item takes the game's count when that count changes, or more if the
//   player marked more: the game never takes back a find.
// - The seed's objectives are the ROM's: its table says which the seed asks
//   for. An objective the game says done is done; one it does not say done
//   stays as the player left it.
// - The items the seed adds (the Wall Jump Boots, the split Speed Booster)
//   follow its settings.
//
// The run timer follows the game too, whether or not a game is in play: the
// player's "Start and stop with the game" starts it on the first reading in
// play after one before play and stops it at the goal, and "Game time" sets
// it on Map Rando's RTA clock (timer.ts).

import {
  type ClockReading,
  clockStraddled,
  type SmItemId,
} from "@alltp/pack-sm";
import { gameClockOf, timerNews } from "@/games/gameTimer";
import type { SmReading } from "@/games/sm/autotrack/reading";
import { clockBaseOf } from "@/games/sm/autotrack/timer";
import { type SmProgress, useSmStore } from "@/games/sm/store";
import { type GameClock, isIdle, timerState } from "@/utils/runTimer";

/** What the game says, kept to tell news from what it said before. */
type View = {
  items: Readonly<Record<string, number>>;
  objectives: string;
  done: readonly string[];
  wallJump: boolean | null;
  splitSpeed: boolean | null;
};

const viewOf = (reading: SmReading): View => ({
  done:
    typeof reading.objectives === "string"
      ? []
      : reading.objectives
          .filter(({ done }) => done)
          .map(({ objective }) => objective.id),
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

    const news = run.autoTimer
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

  return {
    /** Lay a reading's news on the run. */
    read: (reading: SmReading) => {
      followTimer(reading);
      if (reading.inPlay !== true) return;
      const now = viewOf(reading);
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
      const options = (["wallJump", "splitSpeed"] as const).filter(
        (option) =>
          now[option] !== null &&
          (before === null || before[option] !== now[option]),
      );
      if (
        itemNews.length === 0 &&
        !objectivesNews &&
        doneNews.length === 0 &&
        options.length === 0
      ) {
        return;
      }
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
        for (const option of options) {
          change[option] = now[option] === true;
        }
        return change;
      });
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

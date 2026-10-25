// What ALttPR's own progress does to the run timer (`utils/runTimer.ts`)
// while autotracking reads the game and the player lets it start and stop
// the timer: pure, every step reading the progress and the timer only.
import { type ProgressReading, playTimeMs } from "@alltp/pack-alttpr";
import {
  type GameClock,
  isIdle,
  isRunning,
  type RunTimer,
} from "@/utils/runTimer";

/**
 * What the game's own progress does to the timer, while the player lets it
 * start and stop with the game: start an idle timer when a reading in play
 * follows one before play (the title, the file select or the spawn select:
 * a menu during play is no new start), stop a running one once the goal is
 * reached. `before` is whether the reading before was before play, or
 * undefined when there was none.
 */
export const timerNews = (
  before: boolean | undefined,
  progress: Pick<ProgressReading, "goal" | "started">,
  timer: RunTimer,
): "finish" | "start" | null => {
  if (progress.goal === true) return isRunning(timer) ? "finish" : null;
  return before === true && progress.started === true && isIdle(timer)
    ? "start"
    : null;
};

/**
 * The game's own clock, for a timer set on the game: what the ROM counts
 * (`romStats.playFrames`, NMI frames, menus and lag included, as the game's
 * credits show it), which stops at the goal.
 *
 * - `"unavailable"`: Race Mode, or memory not settled; the timer counts real
 *   time, as races time.
 * - `"unloaded"`: the counter reads 0, as it does at the title and the file
 *   select, which clear the save data in WRAM; never a time to set a timer on.
 * - Otherwise the clock: counting in play (a menu or a text box included),
 *   paused before it (the spawn select, where the file is loaded), over at the
 *   goal.
 */
export const gameClockOf = (
  race: boolean,
  progress: Pick<ProgressReading, "beforePlay" | "goal" | "romStats">,
): GameClock | "unavailable" | "unloaded" => {
  const { romStats } = progress;
  if (race || typeof romStats === "string") return "unavailable";
  if (romStats.playFrames === 0) return "unloaded";
  const ms = playTimeMs(romStats.playFrames);
  if (progress.goal === true) return { ms, status: "over" };
  return { ms, status: progress.beforePlay === false ? "running" : "paused" };
};

// What ALttPR's own progress does to the run timer (`utils/runTimer.ts`)
// while autotracking reads the game and the player lets it start and stop
// the timer: pure, every step reading the progress and the timer only.
import type { ProgressReading } from "@alltp/pack-alttpr";
import { isIdle, isRunning, type RunTimer } from "@/utils/runTimer";

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

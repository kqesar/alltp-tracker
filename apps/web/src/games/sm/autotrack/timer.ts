// What Super Metroid's RTA clock does to the run timer (`utils/runTimer.ts`):
// pure. The steps every game's follower shares, the game's start and stop and
// its clock's state, are `games/gameTimer.ts`; `follow.ts` applies them.

import { rtaFrames, rtaMs } from "@alltp/pack-sm";
import { type RunTimer, timerMs } from "@/utils/runTimer";

/**
 * Where the RTA clock's count since the timer's 0 puts the timer.
 * @param frames - The clock's frames now
 * @param base - The clock's frames when the timer was at 0, or null if not
 * known, or past the clock (the SRAM was set up again): then the timer's own
 * time is the point to go on from
 * @param timer - The timer, which gives that time
 * @param at - When the clock was read
 * @returns The base to keep, and the game's time since it
 */
export const clockBaseOf = (
  frames: number,
  base: number | null,
  timer: RunTimer,
  at: number,
): { base: number; ms: number } => {
  const kept =
    base !== null && base <= frames
      ? base
      : Math.max(0, frames - rtaFrames(timerMs(timer, at)));
  return { base: kept, ms: rtaMs(frames - kept) };
};

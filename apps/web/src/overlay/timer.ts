// The run timer as the overlay API tells it (docs/overlay-api.md, "The
// timer"): data, not a time that goes stale. Whichever clock the player
// chose, it is the timer their page shows. Every game that keeps one uses it.

import type { OverlayTimer } from "@/overlay/protocol";
import { type RunTimer, timerState } from "@/utils/runTimer";

export const overlayTimerOf = (timer: RunTimer): OverlayTimer => ({
  elapsedMs: timer.elapsedMs,
  startedAt: timer.startedAt,
  state: timerState(timer),
});

// When a run may be reviewed against its seed's spoiler log: only once it is
// over, and never in Race Mode. Pure; each game's hook reads its own stores
// (`games/<id>/review/`) and asks this.

import type { RunTimer } from "@/utils/runTimer";

/**
 * Where the gate stands: `open` (the run is over, no race), `race-mode`
 * (refused, whatever the timer says) or `not-over` (the timer has not been
 * stopped for good, by the goal or by End run).
 */
export type ReviewGate = "open" | "race-mode" | "not-over";

/**
 * @param timer - The run's timer: over once `finished`
 * @param race - Race Mode is on for this device
 */
export const reviewGate = ({
  race,
  timer,
}: {
  timer: RunTimer;
  race: boolean;
}): ReviewGate => {
  if (race) return "race-mode";
  return timer.finished ? "open" : "not-over";
};

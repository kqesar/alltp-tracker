// SMZ3's hooks over the shared review (`review/`): where the gate stands for
// this run, the review that is open for it, and the rule that closes it.

import { isRaceModeOn } from "@/autotrack/raceMode";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { useSmz3Store } from "@/games/smz3/store";
import { useActiveReview, useDropStaleReview } from "@/review/active";
import { type ReviewGate, reviewGate } from "@/review/gate";
import type { Loaded } from "@/review/store";

/** Whether this run may be reviewed now: over, and not in Race Mode. */
export const useReviewGate = (): ReviewGate => {
  const timer = useSmz3Store((state) => state.timer);
  const race = smz3Autotrack.useStore(isRaceModeOn);
  return reviewGate({ race, timer });
};

/** The review open for this run, or null: SMZ3's, on the seed it was bound to. */
export const useReview = (): Loaded | null =>
  useActiveReview(
    "smz3",
    useReviewGate(),
    useSmz3Store((state) => state.seed),
  );

/**
 * Drops the review the moment it stops being the run's (Reset, New game, an
 * import put the timer back to idle; Race Mode came on; the run is on another
 * seed). The tracker's board calls it once.
 */
export const useCloseReview = (): void =>
  useDropStaleReview(
    "smz3",
    useReviewGate(),
    useSmz3Store((state) => state.seed),
  );

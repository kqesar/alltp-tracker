// ALttPR's hooks over the shared review (`review/`): where the gate stands for
// this run, the review that is open for it, and the rule that closes it.

import { isRaceModeOn } from "@/autotrack/raceMode";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useActiveReview, useDropStaleReview } from "@/review/active";
import { type ReviewGate, reviewGate } from "@/review/gate";
import type { Loaded } from "@/review/store";

/** Whether this run may be reviewed now: over, and not in Race Mode. */
export const useReviewGate = (): ReviewGate => {
  const timer = useGameStore((state) => state.timer);
  const race = useAutotrackStore(isRaceModeOn);
  return reviewGate({ race, timer });
};

/**
 * The review open for this run, or null: one that is for ALttPR, while the
 * gate stands open and the run is still the seed it was bound to.
 */
export const useReview = (): Loaded | null =>
  useActiveReview(
    "alttpr",
    useReviewGate(),
    useGameStore((state) => state.seed),
  );

/**
 * Drops the review the moment it stops being the run's (Reset, New game,
 * Import and a shared run put the timer back to idle; Race Mode came on; the
 * run is on another seed). The tracker's board calls it once.
 */
export const useCloseReview = (): void =>
  useDropStaleReview(
    "alttpr",
    useReviewGate(),
    useGameStore((state) => state.seed),
  );

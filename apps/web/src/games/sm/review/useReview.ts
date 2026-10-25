// Super Metroid's hooks over the shared review (`review/`): where the gate
// stands for this run, the review that is open for it, and the rule that
// closes it.

import { isRaceModeOn } from "@/autotrack/raceMode";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";
import { useActiveReview, useDropStaleReview } from "@/review/active";
import { type ReviewGate, reviewGate } from "@/review/gate";
import type { Loaded } from "@/review/store";

/** Whether this run may be reviewed now: over, and not in Race Mode. */
export const useReviewGate = (): ReviewGate => {
  const timer = useSmStore((state) => state.timer);
  // Map Rando has no race flag in the ROM: the player's choice, or a session that says race
  const race = useSmAutotrackStore((state) =>
    isRaceModeOn({ ...state, reading: null }),
  );
  return reviewGate({ race, timer });
};

/** The review open for this run, or null: Super Metroid's, on the seed it was bound to. */
export const useReview = (): Loaded | null =>
  useActiveReview(
    "sm",
    useReviewGate(),
    useSmStore((state) => state.seed),
  );

/**
 * Drops the review the moment it stops being the run's (Reset, New game,
 * Import and a shared run put the timer back to idle; Race Mode came on; the
 * run is on another seed). The board calls it once.
 */
export const useCloseReview = (): void =>
  useDropStaleReview(
    "sm",
    useReviewGate(),
    useSmStore((state) => state.seed),
  );

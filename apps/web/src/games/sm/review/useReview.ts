// Super Metroid's hooks over the shared review (`review/`): where the gate
// stands for this run, the review that is open for it, and the rule that
// closes it.

import { useEffect } from "react";
import { isRaceModeOn } from "@/autotrack/raceMode";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";
import { type ReviewGate, reviewGate } from "@/review/gate";
import { type Loaded, useReviewStore } from "@/review/store";

/** Whether this run may be reviewed now: over, and not in Race Mode. */
export const useReviewGate = (): ReviewGate => {
  const timer = useSmStore((state) => state.timer);
  // Map Rando has no race flag in the ROM: the player's choice, or a session that says race
  const race = useSmAutotrackStore((state) =>
    isRaceModeOn({ ...state, reading: null }),
  );
  return reviewGate({ race, timer });
};

/**
 * The review open for this run, or null: one that is for Super Metroid, while
 * the gate stands open and the run is still the seed it was bound to. Anything
 * else is no review, whatever the store holds (`useCloseReview` drops it).
 */
export const useReview = (): Loaded | null => {
  const gate = useReviewGate();
  const seed = useSmStore((state) => state.seed);
  const review = useReviewStore((state) => state.review);
  return review !== null &&
    review.game === "sm" &&
    gate === "open" &&
    review.boundSeed === seed
    ? review
    : null;
};

/**
 * Drops the review the moment it stops being the run's: the run is not over
 * any more (Reset, New game, Import and a shared run all put the timer back to
 * idle), Race Mode came on, or the run is on another seed. The board calls it
 * once.
 */
export const useCloseReview = (): void => {
  const gate = useReviewGate();
  const seed = useSmStore((state) => state.seed);
  const review = useReviewStore((state) => state.review);
  const close = useReviewStore((state) => state.close);
  useEffect(() => {
    if (review === null) return;
    if (review.game !== "sm" || gate !== "open" || review.boundSeed !== seed) {
      close();
    }
  }, [review, gate, seed, close]);
};

// Which review, if any, is the one on a game's board: shared by every game
// that reviews a run, over its own gate and seed. The store holds whatever
// was opened last; this says whether it is still the run's.

import type { SpoilerGame } from "@alltp/spoiler";
import { useEffect } from "react";
import type { ReviewGate } from "@/review/gate";
import { type Loaded, useReviewStore } from "@/review/store";

/**
 * The review for a game's run, or null: one of that game's, while the gate
 * stands open and the run is still on the seed it was bound to.
 */
export const activeReview = (
  review: Loaded | null,
  game: SpoilerGame,
  gate: ReviewGate,
  seed: string | null,
): Loaded | null =>
  review !== null &&
  review.game === game &&
  gate === "open" &&
  review.boundSeed === seed
    ? review
    : null;

/**
 * The review open for a game's run, or null. Anything else is no review,
 * whatever the store holds (`useDropStaleReview` empties it).
 */
export const useActiveReview = (
  game: SpoilerGame,
  gate: ReviewGate,
  seed: string | null,
): Loaded | null =>
  activeReview(
    useReviewStore((state) => state.review),
    game,
    gate,
    seed,
  );

/**
 * Drops the review the moment it stops being the run's: the run is not over
 * any more, Race Mode came on, the run is on another seed, or the review is
 * another game's. A game's board calls it once.
 */
export const useDropStaleReview = (
  game: SpoilerGame,
  gate: ReviewGate,
  seed: string | null,
): void => {
  const review = useReviewStore((state) => state.review);
  const close = useReviewStore((state) => state.close);
  useEffect(() => {
    if (review !== null && activeReview(review, game, gate, seed) === null) {
      close();
    }
  }, [review, game, gate, seed, close]);
};

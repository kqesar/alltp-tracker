import type { Loaded } from "@/review/store";

/** How the review relates to the run, in words: proven, or why it is not. */
export const bindingText = (review: Loaded): string => {
  const { binding, boundSeed, log } = review;
  if (binding.verdict === "verified") {
    return `Seed ${log.seed.id}: the log's seed is this run's (matched by ${log.seed.from === "content" ? "its hash" : "its file name"}).`;
  }
  // Map Rando's log never names its seed, whatever the run knows
  const why =
    log.game === "sm"
      ? "Map Rando's log names no seed"
      : boundSeed === null
        ? "this run does not know its seed"
        : "the file names no seed";
  const agreed =
    binding.facts === 0
      ? ""
      : ` ${binding.facts} settings and facts agree with the run.`;
  return `Not verified: ${why}, so the tracker cannot prove this is the run's seed.${agreed}`;
};

/**
 * The review's standing banner: that the board is in review, which log, how
 * it relates to the run, and the way out. Shown over every tab of the map
 * panel while a review is open.
 */
export const ReviewNotice = ({
  onClose,
  review,
}: {
  review: Loaded;
  onClose: () => void;
}) => (
  <div className="review-notice" data-testid="review-notice" role="status">
    <p className="review-notice__text">
      <strong className="review-notice__badge">Review</strong>{" "}
      <span data-testid="review-binding">{bindingText(review)}</span>{" "}
      <span className="review-notice__hint">
        The board shows what each place held: markers, Checks and the grid.
      </span>
    </p>
    <button
      className="modal-btn modal-btn--ghost"
      data-testid="review-close"
      onClick={onClose}
      type="button"
    >
      Close review
    </button>
  </div>
);

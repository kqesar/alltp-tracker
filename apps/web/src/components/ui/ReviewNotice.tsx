import type { Loaded } from "@/review/store";

/** How the review relates to the run, in words: proven, or why it is not. */
export const bindingText = (review: Loaded): string => {
  const { binding, boundSeed, log } = review;
  if (binding.verdict === "verified") {
    return `Seed ${log.seed.id}: the log's seed is this run's (matched by ${log.seed.from === "content" ? (review.game === "smz3" ? "its guid" : "its hash") : "its file name"}).`;
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
      : binding.facts === 1
        ? " 1 setting or fact agrees with the run."
        : ` ${binding.facts} settings and facts agree with the run.`;
  return `Not verified: ${why}, so the tracker cannot prove this is the run's seed.${agreed}`;
};

/**
 * The review's standing banner: that the board is in review, which log, how
 * it relates to the run, where the game's board shows the seed (`hint`, its
 * own words), and the way out.
 */
export const ReviewNotice = ({
  hint,
  onClose,
  review,
}: {
  hint: string;
  review: Loaded;
  onClose: () => void;
}) => (
  <div className="review-notice" data-testid="review-notice" role="status">
    <p className="review-notice__text">
      <strong className="review-notice__badge">Review</strong>{" "}
      <span data-testid="review-binding">{bindingText(review)}</span>{" "}
      <span className="review-notice__hint">{hint}</span>
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

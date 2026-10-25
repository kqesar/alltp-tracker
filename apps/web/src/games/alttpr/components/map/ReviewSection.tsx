import { lazy, Suspense, useId } from "react";
import { lazyDialog } from "@/components/ui/lazyDialog";
import { useReview, useReviewGate } from "@/games/alttpr/review/useReview";
import { refusalWords } from "@/review/words";

// The dialog and the comparison are chunks of their own: a player who never
// reviews a run downloads neither
export const reviewDialog = lazyDialog(
  () =>
    import("@/games/alttpr/components/map/AlttprReviewDialog").then(
      (m) => m.default,
    ),
  {
    message:
      "The review could not be loaded. Reload the page: your run is saved.",
    title: "Review this run",
  },
);
const ReviewResult = lazy(
  () => import("@/games/alttpr/components/map/ReviewResult"),
);

/**
 * The button that opens the import: beside the run timer, only while the run
 * is over, outside Race Mode and with no review open. Absent during play.
 */
export const ReviewButton = () => {
  const gate = useReviewGate();
  const review = useReview();
  const { open, shown } = reviewDialog.useDialog();
  if (gate !== "open" || review !== null) return null;
  return (
    <>
      <button
        className="review-button"
        data-testid="review-open"
        onClick={open}
        type="button"
        {...reviewDialog.handlers}
      >
        Review run
      </button>
      {shown}
    </>
  );
};

/**
 * The Run tab's top section: before a review, whether one may open and the
 * way to import the log; with one, the comparison of the run with the seed.
 */
export const ReviewSection = () => {
  const gate = useReviewGate();
  const review = useReview();
  const titleId = useId();
  const { open, shown } = reviewDialog.useDialog();
  return (
    <section
      aria-labelledby={titleId}
      className="run-section review-section"
      data-testid="review-section"
    >
      <h3 className="run-section__title" id={titleId}>
        Review
      </h3>
      {review !== null ? (
        <Suspense fallback={<p className="run-section__empty">Loading…</p>}>
          <ReviewResult review={review} />
        </Suspense>
      ) : gate === "open" ? (
        <>
          <p className="run-section__empty">
            This run is over. Import the spoiler log of its seed to compare the
            run with it: what was found in order, late or missed.
          </p>
          <div>
            <button
              className="modal-btn modal-btn--primary"
              data-testid="review-import"
              onClick={open}
              type="button"
              {...reviewDialog.handlers}
            >
              Import the spoiler log…
            </button>
          </div>
          {shown}
        </>
      ) : (
        <p className="run-section__empty" data-testid="review-gate-note">
          {refusalWords(
            {
              error: gate === "race-mode" ? "race-mode" : "not-over",
              ok: false,
            },
            "A Link to the Past",
          )}
        </p>
      )}
    </section>
  );
};

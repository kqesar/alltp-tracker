import { lazy, Suspense } from "react";
import { lazyDialog } from "@/components/ui/lazyDialog";
import { ReviewNotice } from "@/components/ui/ReviewNotice";
import { useReview, useReviewGate } from "@/games/sm/review/useReview";
import { useReviewStore } from "@/review/store";

// The dialog and the comparison are chunks of their own: a player who never
// reviews a run downloads neither
const reviewDialog = lazyDialog(
  () => import("@/games/sm/components/SmReviewDialog").then((m) => m.default),
  {
    message:
      "The review could not be loaded. Reload the page: your run is saved.",
    title: "Review this run",
  },
);
const SmReviewResult = lazy(
  () => import("@/games/sm/components/SmReviewResult"),
);

/**
 * The button that opens the import: beside the run timer, only while the run
 * is over, outside Race Mode and with no review open. Absent during play.
 */
export const SmReviewButton = () => {
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
 * The standing banner while a review is open: that the board is in review,
 * how the log relates to the run, and the way out.
 */
export const SmReviewNotice = () => {
  const review = useReview();
  const close = useReviewStore((state) => state.close);
  return review === null ? null : (
    <ReviewNotice
      hint="Each grid cell says where the seed put its item; the review below lists every place."
      onClose={close}
      review={review}
    />
  );
};

/** The review itself, under the board: nothing while no review is open. */
export const SmReviewSection = () => {
  const review = useReview();
  if (review === null) return null;
  return (
    <Suspense fallback={<p className="run-section__empty">Loading…</p>}>
      <SmReviewResult review={review} />
    </Suspense>
  );
};

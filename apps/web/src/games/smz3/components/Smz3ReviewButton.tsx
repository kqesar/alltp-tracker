import { lazyDialog } from "@/components/ui/lazyDialog";
import { ReviewNotice } from "@/components/ui/ReviewNotice";
import { useReview, useReviewGate } from "@/games/smz3/review/useReview";
import { useReviewStore } from "@/review/store";

// The dialog is a chunk of its own: a player who never reviews a run
// downloads neither it nor the parser behind it
const reviewDialog = lazyDialog(
  () =>
    import("@/games/smz3/components/Smz3ReviewDialog").then((m) => m.default),
  {
    message:
      "The review could not be loaded. Reload the page: your run is saved.",
    title: "Review this run",
  },
);

/**
 * The button that opens the import: beside the run timer, only while the run
 * is over, outside Race Mode and with no review open. Absent during play.
 */
export const Smz3ReviewButton = () => {
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

/** The standing banner while a review is open: which log, how it was bound, the way out. */
export const Smz3ReviewBanner = () => {
  const review = useReview();
  const close = useReviewStore((state) => state.close);
  return review === null ? null : (
    <ReviewNotice
      hint="The board shows what each place held: the maps' markers and the grid."
      onClose={close}
      review={review}
    />
  );
};

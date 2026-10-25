import type { MapRandoLog } from "@alltp/pack-sm";
import type { SpoilerLog } from "@alltp/spoiler";
import ReviewDialog from "@/components/ui/ReviewDialog";
import { bindRun } from "@/games/sm/review/adapter";
import { useReviewGate } from "@/games/sm/review/useReview";
import { useSmStore } from "@/games/sm/store";

/**
 * Super Metroid's review dialog: the shared one, bound to this run (its
 * objectives and extra items as they stand when the file is read). Map
 * Rando's log names no seed, so it opens "not verified" unless a fact
 * contradicts the run.
 */
const SmReviewDialog = ({ onClose }: { onClose: () => void }) => {
  const gate = useReviewGate();
  const seed = useSmStore((state) => state.seed);
  return (
    <ReviewDialog
      bind={(log: SpoilerLog) =>
        bindRun(log as MapRandoLog, useSmStore.getState())
      }
      game="sm"
      gameName="Super Metroid"
      gate={gate}
      onClose={onClose}
      runSeed={seed}
    />
  );
};

export default SmReviewDialog;

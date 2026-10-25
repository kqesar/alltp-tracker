import type { SpoilerLog } from "@alltp/spoiler";
import ReviewDialog from "@/components/ui/ReviewDialog";
import { bindRun } from "@/games/smz3/review/adapter";
import type { Smz3SpoilerLog } from "@/games/smz3/review/labels";
import { useReviewGate } from "@/games/smz3/review/useReview";
import { useSmz3Store } from "@/games/smz3/store";

/**
 * SMZ3's review dialog: the shared one, bound to this run (its guid, its
 * settings and the medallions it knows, as they stand when the file is read).
 */
const Smz3ReviewDialog = ({ onClose }: { onClose: () => void }) => {
  const gate = useReviewGate();
  const seed = useSmz3Store((state) => state.seed);
  return (
    <ReviewDialog
      bind={(log: SpoilerLog) =>
        bindRun(log as Smz3SpoilerLog, useSmz3Store.getState())
      }
      game="smz3"
      gameName="SMZ3"
      gate={gate}
      onClose={onClose}
      runSeed={seed}
    />
  );
};

export default Smz3ReviewDialog;

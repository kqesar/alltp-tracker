import type { AlttprSpoilerLog } from "@alltp/pack-alttpr";
import type { SpoilerLog } from "@alltp/spoiler";
import ReviewDialog from "@/components/ui/ReviewDialog";
import { bindRun } from "@/games/alttpr/review/adapter";
import { useReviewGate } from "@/games/alttpr/review/useReview";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * ALttPR's review dialog: the shared one, bound to this run (its seed, its
 * settings, its medallions and prizes as they stand when the file is read),
 * which then shows the Run tab where the comparison is.
 */
const AlttprReviewDialog = ({ onClose }: { onClose: () => void }) => {
  const gate = useReviewGate();
  const seed = useGameStore((state) => state.seed);
  const setMapView = useGameStore((state) => state.setMapView);
  return (
    <ReviewDialog
      bind={(log: SpoilerLog) =>
        bindRun(log as AlttprSpoilerLog, useGameStore.getState())
      }
      game="alttpr"
      gameName="A Link to the Past"
      gate={gate}
      onClose={onClose}
      onOpened={() => setMapView("run")}
      runSeed={seed}
    />
  );
};

export default AlttprReviewDialog;

import { GameShell } from "@/components/ui/GameShell";
import { useSmAutotrack } from "@/games/sm/components/SmAutotrack";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import {
  SmReviewButton,
  SmReviewNotice,
  SmReviewSection,
} from "@/games/sm/components/SmReview";
import { SmRunTimer } from "@/games/sm/components/SmRunTimer";
import { useCloseReview } from "@/games/sm/review/useReview";
import { useSmStore } from "@/games/sm/store";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";

/**
 * The Super Metroid tracker: Map Rando's items and the seed's objectives, and
 * the run timer on a row of its own above them. No map and no logic: Map
 * Rando reconnects the game's rooms, and players follow the game's own map
 * (packs/sm README). Its actions show as icons once their labels no longer
 * fit on one row: it has no More menu, so the label fold is the one it takes.
 * Once the run is over it can be reviewed against the seed's spoiler log
 * (docs/review.md): a banner over the board, the review under it.
 */
const SmApp = () => {
  useUndoShortcuts(useSmStore);
  useSmAutotrack();
  useCloseReview();
  return (
    <GameShell game="sm" toolbar={<SmControls />}>
      <div className="sm-layout" data-testid="layout">
        <div className="board-run">
          <SmRunTimer />
          <SmReviewButton />
        </div>
        <SmReviewNotice />
        <SmGrid />
        <SmObjectives />
        <SmReviewSection />
      </div>
    </GameShell>
  );
};

export default SmApp;

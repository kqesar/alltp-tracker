import { GameShell } from "@/components/ui/GameShell";
import { useSmAutotrack } from "@/games/sm/components/SmAutotrack";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import { useSmStore } from "@/games/sm/store";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";

/**
 * The Super Metroid tracker: Map Rando's items and the seed's objectives. No
 * map and no logic: Map Rando reconnects the game's rooms, and players follow
 * the game's own map (packs/sm README). Its actions show as icons once their
 * labels no longer fit on one row: it has no More menu, so the label fold is
 * the one it takes.
 */
const SmApp = () => {
  useUndoShortcuts(useSmStore);
  useSmAutotrack();
  return (
    <GameShell game="sm" toolbar={<SmControls />}>
      <div className="sm-layout" data-testid="layout">
        <SmGrid />
        <SmObjectives />
      </div>
    </GameShell>
  );
};

export default SmApp;

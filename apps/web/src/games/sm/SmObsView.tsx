import type { ObsViewProps } from "@/games/registry";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SM_COLUMNS, smGrid } from "@/games/sm/data";
import { useSmStore } from "@/games/sm/store";
import { useObsStage } from "@/hooks/useObsStage";

/**
 * Super Metroid's stream view (`?view=obs`): the item grid alone on a
 * transparent page, sized to keep the pixel art crisp, following the tracker
 * through storage. It takes new versions at once: nobody clicks in a source.
 * No run timer yet: `&timer=1` draws nothing more here.
 */
export const SmObsView = ({ background }: ObsViewProps) => {
  const wallJump = useSmStore((state) => state.wallJump);
  const splitSpeed = useSmStore((state) => state.splitSpeed);
  const rows = smGrid({ splitSpeed, wallJump }).length;
  const stageRef = useObsStage({ columns: SM_COLUMNS, rows });

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={background ? { backgroundColor: background } : undefined}
    >
      <SmGrid />
    </main>
  );
};

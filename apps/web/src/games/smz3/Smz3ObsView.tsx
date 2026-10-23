import type { ObsViewProps } from "@/games/registry";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { gridOf, SMZ3_COLUMNS } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";
import { useObsStage } from "@/hooks/useObsStage";

/**
 * SMZ3's stream view (`?view=obs`): the item grid alone on a
 * transparent page, sized to keep the pixel art crisp, following the tracker
 * through storage. It takes new versions at once: nobody clicks in a source.
 * No run timer yet: `&timer=1` draws nothing more here.
 */
export const Smz3ObsView = ({ background, relay }: ObsViewProps) => {
  const rows = gridOf(useSmz3Store((state) => state.settings.keysanity)).length;
  const stageRef = useObsStage({
    columns: SMZ3_COLUMNS,
    rows,
    view: relay === "follow" ? "follow" : "obs",
  });

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={background ? { backgroundColor: background } : undefined}
    >
      <Smz3Grid />
    </main>
  );
};

import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { StreamTimer } from "@/games/alttpr/components/ui/StreamTimer";
import { ITEMS_PER_ROW } from "@/games/alttpr/constants";
import { itemGridFor } from "@/games/alttpr/data/items";
import { useCrossedLogic } from "@/games/alttpr/hooks/useCrossedLogic";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { visibleRows } from "@/games/alttpr/utils";
import type { ObsViewProps } from "@/games/registry";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";
import { useObsStage } from "@/hooks/useObsStage";

/** Grid columns: seven cells and the two half cells at its sides. */
const GRID_COLUMNS = ITEMS_PER_ROW + 1;

/**
 * The stream view (`?view=obs`): the item grid alone, on a transparent page,
 * for an OBS browser source. It fills the source, centred, at a size that
 * keeps the pixel art crisp, and follows the run live through the store's
 * cross-tab sync. Its items stay clickable, and its undo and item shortcuts
 * work, for OBS's Interact window. With `&timer=1` the run timer sits on a
 * row of its own under the grid, sized as the grid's rows are.
 * Nothing else of the app is drawn here: no header, toolbar, map or tooltip.
 * Nor the update notice: nobody clicks in a browser source, so the view takes
 * a new version as soon as it is ready. It only shows the run, which is saved
 * in localStorage, so the reload loses nothing.
 */
export const ObsView = ({ background, timer = false }: ObsViewProps) => {
  useUndoShortcuts(useGameStore);
  useItemShortcuts();
  useCrossedLogic();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const grid = useGameStore((state) => itemGridFor(state.settings));
  const rows = visibleRows(grid, bigKeysVisible).length;
  const stageRef = useObsStage({
    columns: GRID_COLUMNS,
    extraRows: timer ? 1 : 0,
    rows,
  });

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={background ? { backgroundColor: background } : undefined}
    >
      <TrackerGrid itemLayout={grid} />
      {timer && <StreamTimer />}
    </main>
  );
};

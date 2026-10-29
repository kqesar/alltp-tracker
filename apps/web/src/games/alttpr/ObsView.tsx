import {
  type CSSProperties,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { StreamTimer } from "@/games/alttpr/components/ui/StreamTimer";
import { ITEMS_PER_ROW } from "@/games/alttpr/constants";
import { itemGridFor, streamGridFor } from "@/games/alttpr/data/items";
import { useCrossedLogic } from "@/games/alttpr/hooks/useCrossedLogic";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { visibleRows } from "@/games/alttpr/utils";
import type { ObsViewProps } from "@/games/registry";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";
import { useObsStage } from "@/hooks/useObsStage";
import { obsGrid } from "@/utils/view";

/** The stream view's keyboard: undo, redo and the item shortcuts. */
const ObsShortcuts = () => {
  useUndoShortcuts(useGameStore);
  useItemShortcuts();
  return null;
};

const PORTRAIT = "(orientation: portrait)";

/** Follows whether the page is taller than wide. */
const subscribePortrait = (onChange: () => void) => {
  const query = window.matchMedia?.(PORTRAIT);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

/** Whether the page is taller than wide: a phone following the run. */
const usePortrait = (): boolean =>
  useSyncExternalStore(
    subscribePortrait,
    () => window.matchMedia?.(PORTRAIT).matches ?? false,
    () => false,
  );

/**
 * The stream view (`?view=obs`): the items alone, on a transparent page,
 * for an OBS browser source, as a band twelve cells wide (`streamGridFor`):
 * the equipment, the Y items, the bottles and the crystals, then the
 * dungeons from Castle Tower to Ganon's Tower, their key cells under them
 * while those show. On a page taller than wide (a phone following the run)
 * the band folds in two, six cells wide (seven with Hyrule Castle's key
 * cell). With `&layout=grid` it draws the app's grid instead, seven cells
 * between two half cells, the layout a source sized for the grid before the
 * band (512 × 448) keeps whole-pixel. It fills the source, centred, at a
 * size that keeps the pixel art crisp, and follows the run live through the
 * store's cross-tab sync. Its items stay clickable, and its undo and item
 * shortcuts work, for OBS's Interact window. With `&timer=1` the run timer
 * sits on a row of its own under the band, sized as its rows are.
 * Nothing else of the app is drawn here: no header, toolbar, map or tooltip.
 * `relay`, set when the desktop app relays the run, takes no key.
 * Nor the update notice: nobody clicks in a browser source, so the view takes
 * a new version as soon as it is ready. It only shows the run, which is saved
 * in localStorage, so the reload loses nothing.
 */
export const ObsView = ({ background, relay, timer = false }: ObsViewProps) => {
  useCrossedLogic();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const mode = useGameStore((state) => state.settings.mode);
  const goal = useGameStore((state) => state.settings.goal);
  const hidden = useGameStore((state) => state.settings.hidden);
  const narrow = usePortrait();
  const [asGrid] = useState(obsGrid);
  const grid = useMemo(
    () =>
      asGrid
        ? itemGridFor({ goal, hidden, mode })
        : streamGridFor({ goal, hidden, mode }, bigKeysVisible, narrow),
    [asGrid, goal, hidden, mode, bigKeysVisible, narrow],
  );
  const rows = visibleRows(grid, bigKeysVisible);
  // The grid's seven cells and its two half cells; the band's own width
  const columns = asGrid
    ? ITEMS_PER_ROW + 1
    : Math.max(...rows.map((row) => row.length));
  const stageRef = useObsStage({
    columns,
    extraRows: timer ? 1 : 0,
    rows: rows.length,
    view: relay === "follow" ? "follow" : "obs",
  });

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={
        {
          "--obs-columns": columns,
          ...(background ? { backgroundColor: background } : {}),
        } as CSSProperties
      }
    >
      {!relay && <ObsShortcuts />}
      <TrackerGrid band={!asGrid} itemLayout={grid} />
      {timer && <StreamTimer />}
    </main>
  );
};

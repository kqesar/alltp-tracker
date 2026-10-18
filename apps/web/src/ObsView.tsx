import { useEffect, useLayoutEffect, useRef } from "react";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { StreamTimer } from "@/components/ui/StreamTimer";
import { itemGridFor } from "@/data/items";
import { useCrossedLogic } from "@/hooks/useCrossedLogic";
import { useItemShortcuts } from "@/hooks/useItemShortcuts";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import { useGameStore } from "@/stores/gameStore";
import { useUpdateStore } from "@/stores/updateStore";
import { visibleRows } from "@/utils";
import { fitObsGrid } from "@/utils/view";

type ObsViewProps = {
  /** A solid background, already validated by `obsBackground`; none when null */
  background: string | null;
  /** Whether to draw the run timer under the grid (`&timer=1`) */
  timer?: boolean;
};

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
  useUndoShortcuts();
  useItemShortcuts();
  useCrossedLogic();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const grid = useGameStore((state) => itemGridFor(state.settings));
  const rows = visibleRows(grid, bigKeysVisible).length;
  const stageRef = useRef<HTMLElement>(null);
  const applyUpdate = useUpdateStore((state) => state.apply);

  useEffect(() => {
    applyUpdate?.();
  }, [applyUpdate]);

  // The page itself must be transparent too: base.css paints the body
  useLayoutEffect(() => {
    const root = document.documentElement;
    const title = document.title;
    root.dataset.view = "obs";
    document.title = "ALLTP Tracker stream view";
    return () => {
      delete root.dataset.view;
      document.title = title;
    };
  }, []);

  // Sized from the viewport on every resize, written straight to CSS custom
  // properties: resizing the source never re-renders the grid.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const { cell, left, top } = fitObsGrid({
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
        rows: timer ? rows + 1 : rows,
        width: window.innerWidth,
      });
      stage.style.setProperty("--cell", `${cell}px`);
      stage.style.setProperty("--obs-left", `${left}px`);
      stage.style.setProperty("--obs-top", `${top}px`);
      stage.style.setProperty("--obs-timer-top", `${top + rows * cell}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [rows, timer]);

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

import { useLayoutEffect, useRef } from "react";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { defaultItemGrid } from "@/data/items";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import { useGameStore } from "@/stores/gameStore";
import { visibleRows } from "@/utils";
import { fitObsGrid } from "@/utils/view";

type ObsViewProps = {
  /** A solid background, already validated by `obsBackground`; none when null */
  background: string | null;
};

/**
 * The stream view (`?view=obs`): the item grid alone, on a transparent page,
 * for an OBS browser source. It fills the source, centred, at a size that
 * keeps the pixel art crisp, and follows the run live through the store's
 * cross-tab sync. Its items stay clickable, for OBS's Interact window.
 * Nothing else of the app is drawn here: no header, toolbar, map or tooltip.
 */
export const ObsView = ({ background }: ObsViewProps) => {
  useUndoShortcuts();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const rows = visibleRows(defaultItemGrid, bigKeysVisible).length;
  const stageRef = useRef<HTMLElement>(null);

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
        rows,
        width: window.innerWidth,
      });
      stage.style.setProperty("--cell", `${cell}px`);
      stage.style.setProperty("--obs-left", `${left}px`);
      stage.style.setProperty("--obs-top", `${top}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [rows]);

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={background ? { backgroundColor: background } : undefined}
    >
      <TrackerGrid itemLayout={defaultItemGrid} />
    </main>
  );
};

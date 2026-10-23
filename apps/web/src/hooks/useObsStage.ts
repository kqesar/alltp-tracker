import { useEffect, useLayoutEffect, useRef } from "react";
import { PRODUCT_NAME } from "@/games/registry";
import { useUpdateStore } from "@/stores/updateStore";
import { fitObsGrid } from "@/utils/view";

/**
 * What every game's stream view (`?view=obs`) does around its grid: take a
 * new version at once (nobody clicks in a browser source, and the run is
 * saved, so the reload loses nothing), make the page itself transparent (and
 * titled), and fit the grid to the source on every resize.
 * @param columns - The grid's columns
 * @param rows - The grid's rows
 * @param extraRows - Rows under the grid that the source's size leaves room
 * for (the run timer's)
 * @returns The ref of the stage (`<main className="obs-view">`), which takes
 * `--cell`, `--obs-left`, `--obs-top` and the row under the grid, `--obs-timer-top`
 */
export const useObsStage = ({
  columns,
  extraRows = 0,
  rows,
}: {
  columns: number;
  extraRows?: number;
  rows: number;
}) => {
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
    document.title = `${PRODUCT_NAME} stream view`;
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
        columns,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
        rows: rows + extraRows,
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
  }, [columns, extraRows, rows]);

  return stageRef;
};

import { useEffect, useLayoutEffect, useRef } from "react";
import { PRODUCT_NAME } from "@/games/registry";
import { useUpdateStore } from "@/stores/updateStore";
import { fitObsGrid } from "@/utils/view";

/** Each view's page title. */
const TITLES = {
  follow: `${PRODUCT_NAME} live`,
  obs: `${PRODUCT_NAME} stream view`,
} as const;

/**
 * What every game's stream view (`?view=obs`) does around its grid: take a
 * new version at once (nobody clicks in a browser source, and the run is
 * saved, so the reload loses nothing), make the page itself transparent (and
 * titled), and fit the grid to the source on every resize.
 *
 * The followed view (`?view=follow`, a phone watching the desktop app) draws
 * the same grid on an opaque page under its banner: the grid then fits the
 * stage's own box, which the banner leaves, not the whole viewport.
 * @param columns - The grid's columns
 * @param rows - The grid's rows
 * @param extraRows - Rows under the grid that the source's size leaves room
 * for (the run timer's)
 * @param view - Which page draws it: `:root[data-view]` styles each
 * @returns The ref of the stage (`<main className="obs-view">`), which takes
 * `--cell`, `--obs-left`, `--obs-top` and the row under the grid, `--obs-timer-top`
 */
export const useObsStage = ({
  columns,
  extraRows = 0,
  rows,
  view = "obs",
}: {
  columns: number;
  extraRows?: number;
  rows: number;
  view?: "follow" | "obs";
}) => {
  const stageRef = useRef<HTMLElement>(null);
  const applyUpdate = useUpdateStore((state) => state.apply);

  useEffect(() => {
    applyUpdate?.();
  }, [applyUpdate]);

  // The stream view's page must be transparent too: base.css paints the body
  useLayoutEffect(() => {
    const root = document.documentElement;
    const title = document.title;
    root.dataset.view = view;
    document.title = TITLES[view];
    return () => {
      delete root.dataset.view;
      document.title = title;
    };
  }, [view]);

  // Sized on every resize, written straight to CSS custom properties:
  // resizing the source never re-renders the grid.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const followed = view === "follow";
      const { cell, left, top } = fitObsGrid({
        columns,
        height: followed ? stage.clientHeight : window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
        rows: rows + extraRows,
        width: followed ? stage.clientWidth : window.innerWidth,
      });
      stage.style.setProperty("--cell", `${cell}px`);
      stage.style.setProperty("--obs-left", `${left}px`);
      stage.style.setProperty("--obs-top", `${top}px`);
      stage.style.setProperty("--obs-timer-top", `${top + rows * cell}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    // The followed view's stage also moves with its banner's height
    const observer =
      view === "follow" && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(fit)
        : null;
    observer?.observe(stage);
    return () => {
      window.removeEventListener("resize", fit);
      observer?.disconnect();
    };
  }, [columns, extraRows, rows, view]);

  return stageRef;
};

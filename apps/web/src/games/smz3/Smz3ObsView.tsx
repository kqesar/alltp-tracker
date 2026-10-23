import { useEffect, useLayoutEffect, useRef } from "react";
import type { ObsViewProps } from "@/games/registry";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { gridOf, SMZ3_COLUMNS } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";
import { useUpdateStore } from "@/stores/updateStore";
import { fitObsGrid } from "@/utils/view";

/**
 * SMZ3's stream view (`?view=obs`): the item grid alone on a
 * transparent page, sized to keep the pixel art crisp, following the tracker
 * through storage. It takes new versions at once: nobody clicks in a source.
 * No run timer yet: `&timer=1` draws nothing more here.
 */
export const Smz3ObsView = ({ background }: ObsViewProps) => {
  const rows = gridOf(useSmz3Store((state) => state.settings.keysanity)).length;
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
    document.title = "Rando Atlas stream view";
    return () => {
      delete root.dataset.view;
      document.title = title;
    };
  }, []);

  // Sized from the viewport on every resize, straight into CSS properties
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const { cell, left, top } = fitObsGrid({
        columns: SMZ3_COLUMNS,
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
      <Smz3Grid />
    </main>
  );
};

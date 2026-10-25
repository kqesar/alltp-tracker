import type { CSSProperties } from "react";
import { StreamTimer } from "@/components/ui/StreamTimer";
import type { StreamSize } from "@/components/ui/StreamTools";
import type { ObsViewProps } from "@/games/registry";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SM_COLUMNS, smGrid } from "@/games/sm/data";
import { useSmStore } from "@/games/sm/store";
import { useObsStage } from "@/hooks/useObsStage";

/** A cell's crisp size in a source, in pixels: four times the 16 px sprites. */
const NATIVE_CELL = 64;

/**
 * The browser source's size for this board's stream view, with or without the
 * run timer's row (the Stream view dialogs).
 * @param rows - The grid's rows (`smGrid`)
 */
export const streamSize =
  (rows: number) =>
  (timer: boolean): StreamSize => ({
    height: (rows + (timer ? 1 : 0)) * NATIVE_CELL,
    width: SM_COLUMNS * NATIVE_CELL,
  });

/** The run's timer, drawn as every game's stream view draws it. */
const SmStreamTimer = () => (
  <StreamTimer timer={useSmStore((state) => state.timer)} />
);

/**
 * Super Metroid's stream view (`?view=obs`): the item grid alone on a
 * transparent page, sized to keep the pixel art crisp, following the tracker
 * through storage. It takes new versions at once: nobody clicks in a source.
 * With `&timer=1`, the run timer on a row of its own under the grid, as every
 * game's stream view draws it.
 */
export const SmObsView = ({
  background,
  relay,
  timer = false,
}: ObsViewProps) => {
  const wallJump = useSmStore((state) => state.wallJump);
  const splitSpeed = useSmStore((state) => state.splitSpeed);
  const rows = smGrid({ splitSpeed, wallJump }).length;
  const stageRef = useObsStage({
    columns: SM_COLUMNS,
    extraRows: timer ? 1 : 0,
    rows,
    view: relay === "follow" ? "follow" : "obs",
  });
  const style = {
    "--obs-columns": SM_COLUMNS,
    ...(background ? { backgroundColor: background } : {}),
  } as CSSProperties;

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={style}
    >
      <SmGrid />
      {timer && <SmStreamTimer />}
    </main>
  );
};

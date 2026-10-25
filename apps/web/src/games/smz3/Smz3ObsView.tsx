import type { CSSProperties } from "react";
import { StreamTimer } from "@/components/ui/StreamTimer";
import type { ObsViewProps } from "@/games/registry";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { gridOf, SMZ3_COLUMNS } from "@/games/smz3/data";
import { useSmz3Store } from "@/games/smz3/store";
import { useObsStage } from "@/hooks/useObsStage";
import { gridStreamSize } from "@/utils/view";

/**
 * The browser source's size for this board's stream view, with or without the
 * run timer's row (the Stream view dialogs).
 * @param rows - The grid's rows (`gridOf`)
 */
export const streamSize = (rows: number) => gridStreamSize(SMZ3_COLUMNS, rows);

/** The run's timer, drawn as every game's stream view draws it. */
const Smz3StreamTimer = () => (
  <StreamTimer timer={useSmz3Store((state) => state.timer)} />
);

/**
 * SMZ3's stream view (`?view=obs`): the item grid alone on a
 * transparent page, sized to keep the pixel art crisp, following the tracker
 * through storage. It takes new versions at once: nobody clicks in a source.
 * With `&timer=1`, the run timer on a row of its own under the grid, as every
 * game's stream view draws it.
 */
export const Smz3ObsView = ({
  background,
  relay,
  timer = false,
}: ObsViewProps) => {
  const rows = gridOf(useSmz3Store((state) => state.settings.keysanity)).length;
  const stageRef = useObsStage({
    columns: SMZ3_COLUMNS,
    extraRows: timer ? 1 : 0,
    rows,
    view: relay === "follow" ? "follow" : "obs",
  });

  const style = {
    "--obs-columns": SMZ3_COLUMNS,
    ...(background ? { backgroundColor: background } : {}),
  } as CSSProperties;

  return (
    <main
      className="obs-view"
      data-testid="obs-view"
      ref={stageRef}
      style={style}
    >
      <Smz3Grid />
      {timer && <Smz3StreamTimer />}
    </main>
  );
};

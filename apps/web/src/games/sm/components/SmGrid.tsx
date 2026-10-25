import { type MapRandoLog, type SmItemId, smItem } from "@alltp/pack-sm";
import type { Placement } from "@alltp/spoiler";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { SPRITE_FRAME, smGrid } from "@/games/sm/data";
import { cellWords, placesByItem } from "@/games/sm/review/adapter";
import { useReview } from "@/games/sm/review/useReview";
import { useSmStore } from "@/games/sm/store";
import {
  GridFocusProvider,
  useGridFocusable,
  useGridNavigation,
} from "@/hooks/useGridNavigation";

/** A cell's state in words: held or not, or how many of how many. */
const describe = (id: SmItemId, value: number) => {
  const { max } = smItem(id);
  if (max === 1) return value > 0 ? "obtained" : "not obtained";
  return `${value} of ${max}`;
};

type SmCellProps = {
  id: SmItemId;
  row: number;
  col: number;
  /** In a review, where the seed put the item. */
  places?: readonly Placement[];
};

/**
 * One item of the grid: its sprite from Map Rando's sheet, greyed while not
 * held, and for packs and tanks how many. A click adds one, a right-click or
 * "-" takes one away, wrapping within the pool, as ALttPR's cells step. In a
 * review its name also says where the seed put the item.
 */
const SmCell = ({ id, row, col, places }: SmCellProps) => {
  const value = useSmStore((state) => state.items[id] ?? 0);
  const step = useSmStore((state) => state.step);
  const counted = smItem(id).max > 1;
  const focusable = useGridFocusable({ col, row, slot: 0 });
  const where = cellWords(places);
  return (
    <button
      {...focusable}
      aria-label={`${smItem(id).name}, ${describe(id, value)}. Click to change state.${where === null ? "" : ` ${where}`}`}
      className={`griditem grid-item-base sm-cell${value === 0 ? " griditem--dimmed" : ""}`}
      data-testid={`sm-item-${id}`}
      onClick={() => step(id, 1)}
      onContextMenu={(event: MouseEvent) => {
        event.preventDefault();
        step(id, -1);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "-") {
          event.preventDefault();
          step(id, -1);
        }
      }}
      style={{ "--frame": SPRITE_FRAME[id] } as CSSProperties}
      title={where ?? undefined}
      type="button"
    >
      {counted && value > 0 && (
        <span aria-hidden="true" className="board-cell__count">
          {value}
        </span>
      )}
    </button>
  );
};

/**
 * The Super Metroid grid, its cells as the seed's settings have them: a
 * single Tab stop, arrow keys moving inside it (useGridNavigation).
 */
export const SmGrid = () => {
  const wallJump = useSmStore((state) => state.wallJump);
  const splitSpeed = useSmStore((state) => state.splitSpeed);
  const { containerRef, focus } = useGridNavigation();
  const review = useReview();
  const places =
    review === null ? null : placesByItem(review.log as MapRandoLog);
  return (
    <section
      aria-label="Item tracker grid"
      className="board-grid"
      data-testid="item-grid"
      ref={containerRef}
    >
      <h2 className="sr-only">Items</h2>
      <GridFocusProvider value={focus}>
        <div className="board-grid__cells sm-grid__cells">
          {smGrid({ splitSpeed, wallJump }).map((row, rowIndex) =>
            row.map((id, colIndex) =>
              id === "" ? (
                <div
                  aria-hidden="true"
                  className="grid-item-base"
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed place in the grid
                  key={`${rowIndex}-${colIndex}`}
                />
              ) : (
                <SmCell
                  col={colIndex}
                  id={id}
                  key={id}
                  places={places?.get(id)}
                  row={rowIndex}
                />
              ),
            ),
          )}
        </div>
      </GridFocusProvider>
    </section>
  );
};

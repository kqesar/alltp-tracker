import { type SmItemId, smItem } from "@alltp/pack-sm";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { SPRITE_FRAME, smGrid } from "@/games/sm/data";
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

type SmCellProps = { id: SmItemId; row: number; col: number };

/**
 * One item of the grid: its sprite from Map Rando's sheet, greyed while not
 * held, and for packs and tanks how many. A click adds one, a right-click or
 * "-" takes one away, wrapping within the pool, as ALttPR's cells step.
 */
const SmCell = ({ id, row, col }: SmCellProps) => {
  const value = useSmStore((state) => state.items[id] ?? 0);
  const step = useSmStore((state) => state.step);
  const counted = smItem(id).max > 1;
  const focusable = useGridFocusable({ col, row, slot: 0 });
  return (
    <button
      {...focusable}
      aria-label={`${smItem(id).name}, ${describe(id, value)}. Click to change state.`}
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
      type="button"
    >
      {counted && value > 0 && (
        <span aria-hidden="true" className="sm-cell__count">
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
  return (
    <section
      aria-label="Item tracker grid"
      className="sm-grid"
      data-testid="item-grid"
      ref={containerRef}
    >
      <h2 className="sr-only">Items</h2>
      <GridFocusProvider value={focus}>
        <div className="sm-grid__cells">
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
                <SmCell col={colIndex} id={id} key={id} row={rowIndex} />
              ),
            ),
          )}
        </div>
      </GridFocusProvider>
    </section>
  );
};

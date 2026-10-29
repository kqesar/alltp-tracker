import type { CSSProperties } from "react";
import { GridItem } from "@/games/alttpr/components/tracker/grid/GridItem";
import { ITEMS_PER_ROW } from "@/games/alttpr/constants";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { visibleRows } from "@/games/alttpr/utils";
import {
  GridFocusProvider,
  useGridNavigation,
} from "@/hooks/useGridNavigation";

type TrackerGridProps = {
  /** Grid layout data - array of rows containing item identifiers */
  itemLayout: string[][];
  /**
   * The stream view's band: its own columns (as many as its widest row),
   * without the half cells at the sides
   */
  band?: boolean;
};

/**
 * The item grid, laid out with CSS Grid. It is a single Tab stop: arrow keys
 * move between its controls (see useGridNavigation). The app's grid has
 * seven columns between two half cells; the stream view's band
 * (`streamGridFor`) as many as its widest row, edge to edge.
 * @param itemLayout - 2D array representing the grid layout with item identifiers
 * @param band - Whether it is the stream view's band
 */
export const TrackerGrid = ({ itemLayout, band = false }: TrackerGridProps) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const rows = visibleRows(itemLayout, bigKeysVisible);
  const columns = band
    ? Math.max(...rows.map((row) => row.length))
    : ITEMS_PER_ROW;

  const { containerRef, focus } = useGridNavigation();

  return (
    <section
      aria-label="Item tracker grid"
      className="itemdiv"
      data-testid="item-grid"
      id="itemdiv"
      ref={containerRef}
    >
      <h2 className="sr-only">Item Tracker</h2>
      <GridFocusProvider value={focus}>
        <div
          className={`tracker${band ? " tracker--band" : ""}`}
          style={{ "--grid-columns": columns } as CSSProperties}
        >
          {rows.map((row: string[], rowIndex: number) => (
            <div
              className="tracker-row"
              data-row-index={rowIndex}
              data-row-length={row.length}
              data-testid="grid-row"
              // biome-ignore lint/suspicious/noArrayIndexKey: Row indices are stable and semantically meaningful in grid layout
              key={`row-${rowIndex}`}
            >
              {/* Left halfcell spacer */}
              {!band && <div aria-hidden="true" className="halfcell" />}

              {/* Grid items, a short row padded so the columns stay aligned */}
              {Array.from(
                { length: columns },
                (_, colIndex) => row[colIndex] ?? "",
              ).map((item: string, colIndex: number) => (
                <GridItem
                  col={colIndex}
                  item={item}
                  // biome-ignore lint/suspicious/noArrayIndexKey: Grid positions are fixed and semantically meaningful in the layout
                  key={`grid-${rowIndex}-${colIndex}-${item || "empty"}`}
                  row={rowIndex}
                />
              ))}

              {/* Right halfcell spacer */}
              {!band && <div aria-hidden="true" className="halfcell" />}
            </div>
          ))}
        </div>
      </GridFocusProvider>
    </section>
  );
};

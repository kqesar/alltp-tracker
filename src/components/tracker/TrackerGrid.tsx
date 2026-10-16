import { GridItem } from "@/components/tracker/grid/GridItem";
import { ITEMS_PER_ROW } from "@/constants";
import {
  GridFocusProvider,
  useGridNavigation,
} from "@/hooks/useGridNavigation";
import { useGameStore } from "@/stores/gameStore";

type TrackerGridProps = {
  /** Grid layout data - array of rows containing item identifiers */
  itemLayout: string[][];
};

/**
 * The item grid, laid out with CSS Grid. It is a single Tab stop: arrow keys
 * move between its controls (see useGridNavigation).
 * @param itemLayout - 2D array representing the grid layout with item identifiers
 */
export const TrackerGrid = ({ itemLayout }: TrackerGridProps) => {
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  // A row of nothing but key cells would be empty while they are hidden
  const rows = bigKeysVisible
    ? itemLayout
    : itemLayout.filter(
        (row) => !row.every((item) => item.startsWith("bigkey")),
      );

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
        <div className="tracker">
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
              <div aria-hidden="true" className="halfcell" />

              {/* Grid items */}
              {row
                .slice(0, ITEMS_PER_ROW)
                .map((item: string, colIndex: number) => (
                  <GridItem
                    col={colIndex}
                    item={item}
                    // biome-ignore lint/suspicious/noArrayIndexKey: Grid positions are fixed and semantically meaningful in the layout
                    key={`grid-${rowIndex}-${colIndex}-${item || "empty"}`}
                    row={rowIndex}
                  />
                ))}

              {/* Right halfcell spacer */}
              <div aria-hidden="true" className="halfcell" />
            </div>
          ))}
        </div>
      </GridFocusProvider>
    </section>
  );
};

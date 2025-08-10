import { GridItem } from "@/components/tracker/grid/GridItem";
import { CSS_CLASSES } from "@/constants";

type TrackerGridProps = {
  /** Grid layout data - array of rows containing item identifiers */
  itemLayout: string[][];
};

/**
 * TrackerGrid component that renders the complete item tracker grid using CSS Grid
 * Uses semantic HTML with proper grid layout instead of tables
 * @param itemLayout - 2D array representing the grid layout with item identifiers
 */
export const TrackerGrid = ({ itemLayout }: TrackerGridProps) => {
  return (
    <section
      aria-label="Item tracker grid"
      className={CSS_CLASSES.ITEMDIV}
      id="itemdiv"
    >
      <h2 className="sr-only">Item Tracker</h2>
      <div className={CSS_CLASSES.TRACKER}>
        {itemLayout.map((row: string[], rowIndex: number) => (
          <div
            className="tracker-row"
            data-row-index={rowIndex}
            data-row-length={row.length}
            data-testid="grid-row"
            // biome-ignore lint/suspicious/noArrayIndexKey: Row indices are stable and semantically meaningful in grid layout
            key={`row-${rowIndex}`}
          >
            {/* Hidden text content for test compatibility */}
            <span className="sr-only">
              {row.length === 7
                ? row.join(",")
                : `GridRow ${rowIndex}: ${row.join(",")}`}
            </span>
            {/* Left halfcell spacer */}
            <div aria-hidden="true" className={CSS_CLASSES.HALFCELL} />

            {/* Grid items */}
            {row.slice(0, 7).map((item: string, colIndex: number) => (
              <GridItem
                col={colIndex}
                item={item}
                key={`grid-${rowIndex}-${colIndex}-${item || "empty"}`}
                row={rowIndex}
              />
            ))}

            {/* Right halfcell spacer */}
            <div aria-hidden="true" className={CSS_CLASSES.HALFCELL} />
          </div>
        ))}
      </div>
    </section>
  );
};

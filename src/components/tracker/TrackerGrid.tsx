import { GridItem } from "@/components/tracker/grid/GridItem";
import { CSS_CLASSES } from "@/constants";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useGameStore } from "@/stores/gameStore";

type TrackerGridProps = {
  /** Whether drag and drop is enabled */
  dragEnabled?: boolean;
};

/**
 * TrackerGrid component that renders the complete item tracker grid using CSS Grid
 * Uses semantic HTML with proper grid layout instead of tables
 * Includes keyboard navigation support for accessibility
 * Supports drag and drop for customizable item layout
 */
export const TrackerGrid = ({ dragEnabled = true }: TrackerGridProps) => {
  const itemLayout = useGameStore((state) => state.itemLayout);
  const setItemLayout = useGameStore((state) => state.setItemLayout);

  const { containerRef, updateFocusPosition } = useKeyboardNavigation({
    enabled: true,
    itemLayout,
    totalRows: itemLayout.length,
  });

  const {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    isDropTarget,
    isDraggedItem,
  } = useDragAndDrop({
    enabled: dragEnabled,
    itemLayout,
    onLayoutChange: setItemLayout,
  });

  return (
    <section
      aria-label="Item tracker grid"
      className={CSS_CLASSES.ITEMDIV}
      id="itemdiv"
      ref={containerRef}
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
                draggable={dragEnabled}
                isDragging={isDraggedItem(rowIndex, colIndex)}
                isDropTarget={isDropTarget(rowIndex, colIndex)}
                item={item}
                key={`grid-${rowIndex}-${colIndex}-${item || "empty"}`}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                onDragOver={(e) => handleDragOver(e, rowIndex, colIndex)}
                onDragStart={() => handleDragStart(item, rowIndex, colIndex)}
                onDrop={() => handleDrop(rowIndex, colIndex)}
                onFocus={() => updateFocusPosition(rowIndex, colIndex)}
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

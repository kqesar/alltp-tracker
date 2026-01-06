import { BossItem } from "@/components/tracker/items/BossItem";
import { RegularItem } from "@/components/tracker/items/RegularItem";
import { CSS_CLASSES } from "@/constants";

type GridItemProps = {
  /** Grid row index */
  row: number;
  /** Grid column index */
  col: number;
  /** Item identifier from the grid layout */
  item: string;
  /** Callback when item receives focus for keyboard navigation */
  onFocus?: () => void;
  /** Whether this item is draggable */
  draggable?: boolean;
  /** Handler for drag start event */
  onDragStart?: () => void;
  /** Handler for drag over event */
  onDragOver?: (e: React.DragEvent) => void;
  /** Handler for drag leave event */
  onDragLeave?: () => void;
  /** Handler for drop event */
  onDrop?: () => void;
  /** Handler for drag end event */
  onDragEnd?: () => void;
  /** Whether this item is the current drop target */
  isDropTarget?: boolean;
  /** Whether this item is being dragged */
  isDragging?: boolean;
};

/**
 * GridItem component that determines whether to render a boss item or regular item
 * Based on the item identifier, routes to the appropriate component
 * Supports drag and drop for reordering items
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - Item identifier from the layout grid
 * @param onFocus - Callback when item receives focus
 * @param draggable - Whether the item can be dragged
 * @param onDragStart - Callback when drag starts
 * @param onDragOver - Callback when dragging over this item
 * @param onDragLeave - Callback when drag leaves this item
 * @param onDrop - Callback when item is dropped here
 * @param onDragEnd - Callback when drag ends
 * @param isDropTarget - Whether this is the current drop target
 * @param isDragging - Whether this item is being dragged
 */
export const GridItem = ({
  row,
  col,
  item,
  onFocus,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDropTarget = false,
  isDragging = false,
}: GridItemProps) => {
  // Render empty spacer for empty cells to maintain grid layout
  if (!item || item === "") {
    return (
      <div
        aria-hidden="true"
        className={`${CSS_CLASSES.GRID_SPACER}${isDropTarget ? " drop-target" : ""}`}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
    );
  }

  const dragProps = draggable
    ? {
        draggable: true,
        isDragging,
        isDropTarget,
        onDragEnd,
        onDragLeave,
        onDragOver,
        onDragStart,
        onDrop,
      }
    : {};

  if (item?.startsWith("boss")) {
    const bossNumber = parseInt(item.replace("boss", ""), 10);
    return (
      <BossItem
        bossNumber={bossNumber}
        col={col}
        item={item}
        onFocus={onFocus}
        row={row}
        {...dragProps}
      />
    );
  }

  return (
    <RegularItem
      col={col}
      item={item}
      onFocus={onFocus}
      row={row}
      {...dragProps}
    />
  );
};

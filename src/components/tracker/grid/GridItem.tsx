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
};

/**
 * GridItem component that determines whether to render a boss item or regular item
 * Based on the item identifier, routes to the appropriate component
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - Item identifier from the layout grid
 * @param onFocus - Callback when item receives focus
 */
export const GridItem = ({ row, col, item, onFocus }: GridItemProps) => {
  // Render empty spacer for empty cells to maintain grid layout
  if (!item || item === "") {
    return <div aria-hidden="true" className={CSS_CLASSES.GRID_SPACER} />;
  }

  if (item?.startsWith("boss")) {
    const bossNumber = parseInt(item.replace("boss", ""), 10);
    return (
      <BossItem
        bossNumber={bossNumber}
        col={col}
        item={item}
        onFocus={onFocus}
        row={row}
      />
    );
  }

  return <RegularItem col={col} item={item} onFocus={onFocus} row={row} />;
};

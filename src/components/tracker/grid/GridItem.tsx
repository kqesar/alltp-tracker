import { BigKeyCell } from "@/components/tracker/items/BigKeyCell";
import { Item } from "@/components/tracker/items/Item";

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
 * Routes a layout cell to the component that can render it. Empty cells still
 * emit a spacer so the surrounding columns stay aligned.
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - Item identifier from the layout grid
 * @param onFocus - Callback when item receives focus
 */
export const GridItem = ({ row, col, item, onFocus }: GridItemProps) => {
  if (!item) return <div aria-hidden="true" className="grid-spacer" />;

  if (item.startsWith("bigkey")) {
    return <BigKeyCell col={col} item={item} row={row} />;
  }

  return <Item col={col} item={item} onFocus={onFocus} row={row} />;
};

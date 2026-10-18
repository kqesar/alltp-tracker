import { BigKeyCell } from "@/components/tracker/items/BigKeyCell";
import { BossCell } from "@/components/tracker/items/BossCell";
import { Item } from "@/components/tracker/items/Item";
import { KeyLabel } from "@/components/tracker/items/KeyLabel";

type GridItemProps = {
  /** Grid row index */
  row: number;
  /** Grid column index */
  col: number;
  /** Item identifier from the grid layout */
  item: string;
};

/**
 * Routes a layout cell to the component that can render it. Empty cells still
 * emit a spacer so the surrounding columns stay aligned.
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - Item identifier from the layout grid
 */
export const GridItem = ({ row, col, item }: GridItemProps) => {
  if (!item) return <div aria-hidden="true" className="grid-spacer" />;

  if (item.startsWith("keylabel")) {
    return <KeyLabel col={col} item={item} row={row} />;
  }

  if (item.startsWith("keys")) {
    return <BigKeyCell col={col} item={item} row={row} />;
  }

  if (item.startsWith("boss")) {
    return <BossCell col={col} item={item} row={row} />;
  }

  return <Item col={col} item={item} row={row} />;
};

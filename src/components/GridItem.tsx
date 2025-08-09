import { BossItem } from "./BossItem";
import { RegularItem } from "./RegularItem";

type GridItemProps = {
  /** Grid row index */
  row: number;
  /** Grid column index */
  col: number;
  /** Item identifier from the grid layout */
  item: string;
};

/**
 * GridItem component that determines whether to render a boss item or regular item
 * Based on the item identifier, routes to the appropriate component
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - Item identifier from the layout grid
 */
export const GridItem = ({ row, col, item }: GridItemProps) => {
  if (item?.startsWith("boss")) {
    const bossNumber = parseInt(item.replace("boss", ""));
    return <BossItem bossNumber={bossNumber} col={col} item={item} row={row} />;
  }

  return <RegularItem col={col} item={item} row={row} />;
};

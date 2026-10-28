import { Item } from "@/games/alttpr/components/tracker/items/Item";
import { HeartCounter } from "@/games/alttpr/components/tracker/overlays/HeartCounter";

type TunicCellProps = {
  row: number;
  col: number;
};

/**
 * The tunic's cell: the mail, and beside it in the same cell Link's hearts
 * on screen, siblings grouped under one name, never a button inside a
 * button.
 */
export const TunicCell = ({ row, col }: TunicCellProps) => (
  <fieldset aria-label="Mail and hearts" className="grid-item-base boss-cell">
    <Item col={col} item="tunic" row={row} />
    <HeartCounter col={col} row={row} />
  </fieldset>
);

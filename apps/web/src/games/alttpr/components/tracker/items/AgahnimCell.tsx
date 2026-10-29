import { Item } from "@/games/alttpr/components/tracker/items/Item";
import { SHORT_NAMES } from "@/games/alttpr/components/tracker/items/KeyLabel";

type AgahnimCellProps = {
  row: number;
  col: number;
};

/**
 * Castle Tower's cell: Agahnim, beaten or not, under the tower's short name
 * (decorative, as a boss cell's: Agahnim's own name says the cell), at the
 * head of the Light World's dungeons and of Castle Tower's key cell.
 */
export const AgahnimCell = ({ row, col }: AgahnimCellProps) => (
  <div className="grid-item-base agahnim-cell">
    <Item col={col} item="agahnim" row={row} />
    <span aria-hidden="true" className="boss-cell__name">
      {SHORT_NAMES["castle-tower"]}
    </span>
  </div>
);

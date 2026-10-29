import { AgahnimCell } from "@/games/alttpr/components/tracker/items/AgahnimCell";
import { BigKeyCell } from "@/games/alttpr/components/tracker/items/BigKeyCell";
import { BombsCell } from "@/games/alttpr/components/tracker/items/BombsCell";
import { BossCell } from "@/games/alttpr/components/tracker/items/BossCell";
import { BottleCell } from "@/games/alttpr/components/tracker/items/BottleCell";
import { BowCell } from "@/games/alttpr/components/tracker/items/BowCell";
import { GoalCell } from "@/games/alttpr/components/tracker/items/GoalCell";
import { Item } from "@/games/alttpr/components/tracker/items/Item";
import { KeyLabel } from "@/games/alttpr/components/tracker/items/KeyLabel";
import { PiecesCell } from "@/games/alttpr/components/tracker/items/PiecesCell";
import {
  CrystalsCell,
  PendantsCell,
} from "@/games/alttpr/components/tracker/items/PrizeCells";
import { TunicCell } from "@/games/alttpr/components/tracker/items/TunicCell";
import {
  bottleSlotOf,
  GOAL_CELLS,
  type GoalCell as GoalCellId,
  PIECES_ITEM,
} from "@/games/alttpr/data/items";

type GridItemProps = {
  /** Grid row index */
  row: number;
  /** Grid column index */
  col: number;
  /** Item identifier from the layout grid */
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

  // Castle Tower's boss, under the tower's short name
  if (item === "agahnim") return <AgahnimCell col={col} row={row} />;

  // A triforce hunt's pieces found, over the pieces its goal asks for
  if (item === PIECES_ITEM) return <PiecesCell col={col} row={row} />;

  // The tunic's cell carries Link's hearts beside the mail, the bow's the
  // arrows' capacity
  if (item === "tunic") return <TunicCell col={col} row={row} />;
  if (item === "bow") return <BowCell col={col} row={row} />;

  // The bombs and their capacity, each bottle and what it holds
  if (item === "bombcapacity") return <BombsCell col={col} row={row} />;
  const slot = bottleSlotOf(item);
  if (slot !== null) return <BottleCell col={col} row={row} slot={slot} />;

  // What the goal asks for in crystals, and the prizes held
  if (Object.hasOwn(GOAL_CELLS, item)) {
    return <GoalCell col={col} item={item as GoalCellId} row={row} />;
  }
  if (item === "pendants") return <PendantsCell />;
  if (item === "crystals") return <CrystalsCell />;

  return <Item col={col} item={item} row={row} />;
};

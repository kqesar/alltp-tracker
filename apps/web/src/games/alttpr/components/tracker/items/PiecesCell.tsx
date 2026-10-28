import { PIECES_ITEM } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useTooltip } from "@/hooks/useTooltip";
import { mergeHandlers } from "@/utils/mergeHandlers";

type PiecesCellProps = {
  row: number;
  col: number;
};

/**
 * A Triforce Hunt's cell: the Triforce pieces found over the pieces the goal
 * asks for, as the game's HUD counts them ("12/20"). Click adds a piece,
 * right-click or "-" takes one off, stopping at none and at the most a goal
 * holds. Dimmed while none is found. Autotracking sets both numbers from the
 * game (the pieces in Race Mode too: v2.0 lists them among the items).
 */
export const PiecesCell = ({ row, col }: PiecesCellProps) => {
  const found = useGameStore((state) => state.items[PIECES_ITEM] as number);
  const asked = useGameStore((state) => state.items.goalpieces as number);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(PIECES_ITEM, direction),
      useControlShortcuts(PIECES_ITEM).aria,
    ),
    useTooltip({ item: PIECES_ITEM, kind: "item" }),
  );
  const label = `Triforce pieces: ${found}/${asked}.`;

  return (
    <button
      {...handlers}
      aria-label={`${label} Click to add a piece.`}
      className={`griditem grid-item-base pieces-cell${found === 0 ? " griditem--dimmed" : ""}${found >= asked ? " pieces-cell--enough" : ""}`}
      data-testid={`item-${PIECES_ITEM}`}
      style={{ backgroundImage: `url(${getAssetPath("triforce.png")})` }}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="pieces-cell__count">
        {found}/{asked}
      </span>
    </button>
  );
};

import { CAPACITIES } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { mergeHandlers } from "@/utils/mergeHandlers";

const ID = "bombcapacity";

type BombsCellProps = {
  row: number;
  col: number;
};

/**
 * The bombs and how many Link can hold, as a count in the corner, green at
 * the most a seed gives (50). A click adds an upgrade of 5, round from 50 to
 * the 10 a run starts with; a right-click or "-" takes one off
 * (`capacityAfter`). Autotracking reads it outside Race Mode only: v2.0 does
 * not name the capacity upgrades, and what it does not name it forbids.
 */
export const BombsCell = ({ row, col }: BombsCellProps) => {
  const capacity = useGameStore((state) => Number(state.items[ID]));
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(ID, direction),
      useControlShortcuts(ID).aria,
    ),
  );
  const most = capacity >= (CAPACITIES[ID]?.top ?? Number.POSITIVE_INFINITY);

  return (
    <button
      {...handlers}
      aria-label={`Bombs, capacity ${capacity}. Click to add an upgrade.`}
      className="griditem grid-item-base"
      data-testid={`item-${ID}`}
      style={{ backgroundImage: `url(${getAssetPath("bomb.png")})` }}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`cell-count${most ? " cell-count--most" : ""}`}
      >
        {capacity}
      </span>
    </button>
  );
};

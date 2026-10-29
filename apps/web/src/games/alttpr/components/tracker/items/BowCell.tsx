import { Item } from "@/games/alttpr/components/tracker/items/Item";
import { CAPACITIES } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useGridFocusable } from "@/hooks/useGridNavigation";

const ID = "arrowcapacity";

type BowCellProps = {
  row: number;
  col: number;
};

/**
 * The bow's cell: the bow and silver arrows, and in the bottom right corner
 * how many arrows Link can hold, siblings grouped under one name, never a
 * button inside a button (as the tunic's cell carries the hearts). The
 * count is green at the most a seed gives (70); a click adds an upgrade of
 * 5, round from 70 to the 30 a run starts with, a right-click or "-" takes
 * one off (`capacityAfter`). Autotracking reads it outside Race Mode only.
 */
export const BowCell = ({ row, col }: BowCellProps) => {
  const capacity = useGameStore((state) => Number(state.items[ID]));
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const most = capacity >= (CAPACITIES[ID]?.top ?? Number.POSITIVE_INFINITY);

  return (
    <fieldset aria-label="Bow and arrows" className="grid-item-base boss-cell">
      <Item col={col} item="bow" row={row} />
      <button
        {...useGridFocusable({ col, row, slot: 1 })}
        {...useStepHandlers(
          (direction) => handleItemClick(ID, direction),
          useControlShortcuts(ID).aria,
        )}
        aria-label={`Arrow capacity ${capacity}. Click to add an upgrade.`}
        className="overlay-base overlay--bottom-right capacity-overlay"
        data-testid={`item-${ID}`}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`cell-count${most ? " cell-count--most" : ""}`}
        >
          {capacity}
        </span>
      </button>
    </fieldset>
  );
};

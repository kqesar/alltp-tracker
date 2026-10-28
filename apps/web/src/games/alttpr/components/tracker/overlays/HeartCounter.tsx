import { heartsOf, heartsShown, heartsText } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getAssetPath } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";

type HeartCounterProps = {
  row: number;
  col: number;
};

/**
 * Link's hearts on screen (`hearts`) and the pieces toward the next one
 * (`heartquarters`), on the tunic's cell (bottom right): the count over a
 * heart filled by quarters as the game's menu draws the pieces (heart0.png
 * to heart3.png), "?" while not set, which the logic reads as unknown
 * (maybe, never out of logic). Click adds a quarter, the fourth making a
 * heart; right-click or "-" takes one off, stopping at not set and at 20
 * (heartsAfter). Autotracking sets it from the game.
 */
export const HeartCounter = ({ row, col }: HeartCounterProps) => {
  const hearts = useGameStore((state) => state.items.hearts as number);
  const quarters = useGameStore(
    (state) => state.items.heartquarters as number | undefined,
  );
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const held = heartsOf({ heartquarters: quarters ?? 0, hearts });
  const shown = heartsShown(held.hearts);
  const text = heartsText(held);
  const label =
    text === null
      ? "Hearts: not set. Click to count them."
      : `Hearts: ${text}. Click to add a quarter.`;
  const icon = shown === null ? "heart.png" : `heart${held.quarters}.png`;

  return (
    <button
      {...useGridFocusable({ col, row, slot: 1 })}
      {...useStepHandlers(
        (direction) => handleItemClick("hearts", direction),
        useControlShortcuts("hearts").aria,
      )}
      aria-label={label}
      className={`overlay-base overlay--bottom-right heart-counter${shown === null ? " griditem--dimmed" : ""}`}
      data-quarters={held.quarters}
      data-testid="hearts-overlay"
      style={{ backgroundImage: `url(${getAssetPath(icon)})` }}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="heart-counter__count">
        {shown ?? "?"}
      </span>
    </button>
  );
};

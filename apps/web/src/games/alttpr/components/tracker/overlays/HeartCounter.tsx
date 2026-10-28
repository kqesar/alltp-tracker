import { heartsShown } from "@/games/alttpr/data/items";
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
 * Link's hearts on screen (`hearts`), on the tunic's cell (bottom right): a
 * heart with the count over it, "?" while not set, which the logic reads as
 * unknown (maybe, never out of logic). Click adds a heart, right-click or
 * "-" takes one off; past 20 it goes back to not set. Autotracking sets it
 * from the game.
 */
export const HeartCounter = ({ row, col }: HeartCounterProps) => {
  const value = useGameStore((state) => state.items.hearts as number);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const shown = heartsShown(value);
  const label =
    shown === null
      ? "Hearts: not set. Click to count them."
      : `Hearts: ${shown}. Click to change.`;

  return (
    <button
      {...useGridFocusable({ col, row, slot: 1 })}
      {...useStepHandlers(
        (direction) => handleItemClick("hearts", direction),
        useControlShortcuts("hearts").aria,
      )}
      aria-label={label}
      className={`overlay-base overlay--bottom-right heart-counter${shown === null ? " griditem--dimmed" : ""}`}
      data-testid="hearts-overlay"
      style={{ backgroundImage: `url(${getAssetPath("heart.png")})` }}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="heart-counter__count">
        {shown ?? "?"}
      </span>
    </button>
  );
};

import { itemLabels, itemsMin, TOGGLE_ITEMS } from "@/games/alttpr/data/items";
import { useControlShortcuts } from "@/games/alttpr/hooks/useControlShortcuts";
import { useStepHandlers } from "@/games/alttpr/hooks/useStepHandlers";
import { placesText, useCellHeld } from "@/games/alttpr/review/labels";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { getItemBackground, isItemDimmed } from "@/games/alttpr/utils";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useTooltip } from "@/hooks/useTooltip";
import { mergeHandlers } from "@/utils/mergeHandlers";

type ItemProps = {
  row: number;
  col: number;
  item: string;
};

/**
 * Describe an item's current value for screen readers.
 * @param item - The item identifier
 * @param value - Its value in the store
 */
const describeState = (item: string, value: number | boolean): string => {
  if (!item || item === "blank") return "empty";
  // A shop is found, not obtained
  if (item.startsWith("shop")) return value ? "found" : "not found";
  if (typeof value === "boolean") return value ? "obtained" : "not obtained";
  if (typeof value !== "number") return "unknown state";
  if (TOGGLE_ITEMS.has(item)) return value > 0 ? "obtained" : "not obtained";
  return value > (itemsMin[item] ?? 0) ? `level ${value}` : "not obtained";
};

/**
 * A single item cell of the tracker grid. Click steps it forward (toggles or
 * levels up), right-click or "-" steps it back.
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The item identifier, e.g. "bow"
 */
export const Item = ({ row, col, item }: ItemProps) => {
  const value = useGameStore((state) => state.items[item]);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  // In a review: where the seed had it
  const places = useCellHeld(item);
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers(
      (direction) => handleItemClick(item, direction),
      useControlShortcuts(item).aria,
    ),
    useTooltip({ item, kind: "item" }),
  );

  return (
    <button
      {...handlers}
      aria-label={`${itemLabels(item)}, ${describeState(item, value)}${places ? `, ${placesText(places)}` : ""}. Click to change state.`}
      className={`griditem grid-item-base${isItemDimmed(item, value) ? " griditem--dimmed" : ""}`}
      data-places={places ? "" : undefined}
      data-testid={`item-${item}`}
      disabled={item === "blank"}
      style={{ backgroundImage: getItemBackground(item, value) }}
      type="button"
    />
  );
};

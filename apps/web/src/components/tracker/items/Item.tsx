import { itemLabels, itemsMin } from "@/data/items";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { useTooltip } from "@/hooks/useTooltip";
import { useGameStore } from "@/stores/gameStore";
import { getItemBackground, isItemDimmed } from "@/utils";
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
  if (typeof value === "boolean") return value ? "obtained" : "not obtained";
  if (typeof value !== "number") return "unknown state";
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
  const handlers = mergeHandlers(
    useGridFocusable({ col, row, slot: 0 }),
    useStepHandlers((direction) => handleItemClick(item, direction)),
    useTooltip({ item, kind: "item" }),
  );

  return (
    <button
      {...handlers}
      aria-label={`${itemLabels(item)}, ${describeState(item, value)}. Click to change state.`}
      className={`griditem grid-item-base${isItemDimmed(item, value) ? " griditem--dimmed" : ""}`}
      data-testid={`item-${item}`}
      disabled={item === "blank"}
      style={{ backgroundImage: getItemBackground(item, value) }}
      type="button"
    />
  );
};

import {
  CounterOverlay,
  MedaillonOverlay,
} from "@/components/tracker/overlays/BossOverlays";
import { itemLabels, itemsMin } from "@/data/items";
import { useGameStore } from "@/stores/gameStore";
import { getGridItemStyles } from "@/utils";

type ItemProps = {
  row: number;
  col: number;
  item: string;
  /** Callback when item receives focus for keyboard navigation */
  onFocus?: () => void;
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
  if (item.startsWith("boss")) return value > 0 ? "defeated" : "not defeated";
  return value > (itemsMin[item] ?? 0) ? `level ${value}` : "not obtained";
};

/**
 * A single cell of the tracker grid. Boss cells additionally carry the
 * medallion, chest-count and reward overlays.
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The item identifier, e.g. "bow" or "boss3"
 * @param onFocus - Callback when the cell receives focus
 */
export const Item = ({ row, col, item, onFocus }: ItemProps) => {
  const { items, handleItemClick } = useGameStore();

  const bossNumber = item.startsWith("boss")
    ? Number.parseInt(item.slice("boss".length), 10)
    : null;

  return (
    <button
      aria-label={`${itemLabels(item)}, ${describeState(item, items[item])}. Click to change state.`}
      className={`griditem grid-item-base${bossNumber === null ? "" : " grid-item-relative"}`}
      data-grid-col={col}
      data-grid-row={row}
      disabled={item === "blank"}
      onClick={() => handleItemClick(item)}
      onFocus={onFocus}
      style={getGridItemStyles(item, items)}
      type="button"
    >
      {bossNumber !== null && (
        <>
          <MedaillonOverlay bossNumber={bossNumber} />
          <CounterOverlay bossNumber={bossNumber} kind="chest" />
          <CounterOverlay bossNumber={bossNumber} kind="reward" />
        </>
      )}
    </button>
  );
};

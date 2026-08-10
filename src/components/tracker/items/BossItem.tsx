import { CornerTable } from "@/components/CornerTable";
import { ChestOverlay } from "@/components/tracker/overlays/ChestOverlay";
import { MedaillonOverlay } from "@/components/tracker/overlays/MedaillonOverlay";
import { RewardOverlay } from "@/components/tracker/overlays/RewardOverlay";
import { useGameStore } from "@/stores/gameStore";
import { getGridItemStyles } from "@/utils";

type BossItemProps = {
  row: number;
  col: number;
  item: string;
  bossNumber: number;
  /** Callback when item receives focus for keyboard navigation */
  onFocus?: () => void;
};

/**
 * BossItem component renders a boss item with overlays in the tracker grid
 * Used for all boss items that require medallion, chest, and reward overlays
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The boss item identifier
 * @param bossNumber - The boss number (0-9)
 * @param onFocus - Callback when item receives focus
 */
export const BossItem = ({
  row,
  col,
  item,
  bossNumber,
  onFocus,
}: BossItemProps) => {
  const { items, handleItemClick } = useGameStore();

  /**
   * Get boss name for accessibility
   * @param bossNumber - The boss number
   * @returns Human-readable boss name
   */
  const getBossName = (bossNumber: number): string => {
    const bossNames: Record<number, string> = {
      0: "Armos Knights",
      1: "Lanmolas",
      2: "Moldorm",
      3: "Helmasaur King",
      4: "Arrghus",
      5: "Mothula",
      6: "Blind the Thief",
      7: "Kholdstare",
      8: "Vitreous",
      9: "Trinexx",
    };
    return bossNames[bossNumber] || `Boss ${bossNumber}`;
  };

  /**
   * Get boss state description for accessibility
   * @param item - The item identifier
   * @returns Description of current state
   */
  const getBossStateDescription = (item: string): string => {
    if (typeof items[item] === "number") {
      const state = items[item] as number;
      return state > 0 ? "defeated" : "not defeated";
    }
    return "unknown state";
  };

  return (
    <button
      aria-label={`${getBossName(bossNumber)}, ${getBossStateDescription(item)}. Click to change state.`}
      className="griditem grid-item-base grid-item-relative"
      data-grid-col={col}
      data-grid-row={row}
      onClick={() => handleItemClick(item)}
      onFocus={onFocus}
      style={getGridItemStyles(item, items)}
      type="button"
    >
      <MedaillonOverlay bossNumber={bossNumber} />
      <ChestOverlay bossNumber={bossNumber} />
      <RewardOverlay bossNumber={bossNumber} />
      <CornerTable />
    </button>
  );
};

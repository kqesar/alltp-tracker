import { KeyToggle } from "@/components/tracker/items/KeyToggle";
import { SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { useGameStore } from "@/stores/gameStore";

type BigKeyCellProps = {
  row: number;
  col: number;
  /** The bigkey item identifier, e.g. "bigkey3" */
  item: string;
};

/**
 * BigKeyCell renders the keysanity 2x2 cell for a dungeon: big key, small key,
 * and the small-key count. When big keys are hidden it renders an empty,
 * non-interactive placeholder so the grid layout stays stable.
 */
export const BigKeyCell = ({ row, col, item }: BigKeyCellProps) => {
  const { bigKeysVisible, smallKeys } = useGameStore();
  const dungeonIndex = parseInt(item.replace("bigkey", ""), 10);

  if (!bigKeysVisible) {
    return (
      <div
        className="griditem grid-item-base"
        data-grid-col={col}
        data-grid-row={row}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    );
  }

  const keyCount = smallKeys[dungeonIndex] || 0;
  const isMaxed = keyCount === SMALL_KEYS_MAX_BY_INDEX[dungeonIndex];

  return (
    <div
      className="griditem grid-item-base bigkey-container"
      data-grid-col={col}
      data-grid-row={row}
    >
      {/* 2x2 Grid Layout */}
      <div className="bigkey-grid">
        {/* Top Left - Empty */}
        <div className="bigkey-quadrant bigkey-quadrant--top-left"></div>

        {/* Top Right - Big Key */}
        <div className="bigkey-quadrant bigkey-quadrant--top-right">
          <KeyToggle
            col={col}
            dungeonIndex={dungeonIndex}
            row={row}
            variant="big-key"
          />
        </div>

        {/* Bottom Left - Small Key */}
        <div className="bigkey-quadrant bigkey-quadrant--bottom-left">
          <KeyToggle
            col={col}
            dungeonIndex={dungeonIndex}
            row={row}
            variant="small-key"
          />
        </div>

        {/* Bottom Right - Small Keys Count Display */}
        <div className="bigkey-quadrant bigkey-quadrant--bottom-right">
          <div
            className={`bigkey-count ${isMaxed ? "bigkey-count--maxed" : ""}`}
          >
            {keyCount}
          </div>
        </div>
      </div>
    </div>
  );
};

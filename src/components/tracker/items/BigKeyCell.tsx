import { BigKey } from "@/components/tracker/items/BigKey";
import { SmallKey } from "@/components/tracker/items/SmallKey";
import { CSS_CLASSES, SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
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
        className={`${CSS_CLASSES.GRIDITEM} ${CSS_CLASSES.GRID_ITEM_BASE}`}
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
      className={`${CSS_CLASSES.GRIDITEM} ${CSS_CLASSES.GRID_ITEM_BASE} bigkey-container`}
      data-grid-col={col}
      data-grid-row={row}
    >
      {/* 2x2 Grid Layout */}
      <div className="bigkey-grid">
        {/* Top Left - Empty */}
        <div className="bigkey-quadrant bigkey-quadrant--top-left"></div>

        {/* Top Right - Big Key */}
        <div className="bigkey-quadrant bigkey-quadrant--top-right">
          <BigKey col={col} dungeonIndex={dungeonIndex} row={row} />
        </div>

        {/* Bottom Left - Small Key */}
        <div className="bigkey-quadrant bigkey-quadrant--bottom-left">
          <SmallKey col={col} dungeonIndex={dungeonIndex} row={row} />
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

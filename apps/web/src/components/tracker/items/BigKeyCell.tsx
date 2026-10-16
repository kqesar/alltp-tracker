import { KeyToggle } from "@/components/tracker/items/KeyToggle";
import { smallKeysMax } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";

type BigKeyCellProps = {
  row: number;
  col: number;
  /** The bigkey item identifier, e.g. "bigkey3" */
  item: string;
};

/**
 * BigKeyCell renders the keysanity 2x2 cell for a dungeon: big key, small key,
 * and the small-key count. A dungeon without small keys (Eastern Palace in
 * v31) has neither the small key nor its count. When big keys are hidden it
 * renders an empty, non-interactive placeholder so the grid layout stays
 * stable.
 */
export const BigKeyCell = ({ row, col, item }: BigKeyCellProps) => {
  const dungeonIndex = parseInt(item.replace("bigkey", ""), 10);
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const keyCount = useGameStore((state) => state.smallKeys[dungeonIndex] || 0);

  if (!bigKeysVisible) {
    return (
      <div
        aria-hidden="true"
        className="grid-spacer"
        data-grid-col={col}
        data-grid-row={row}
      />
    );
  }

  const maxKeys = smallKeysMax(dungeonIndex);
  const isMaxed = keyCount === maxKeys;

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

        {/* Bottom Left - Small Key, for a dungeon that has some */}
        <div className="bigkey-quadrant bigkey-quadrant--bottom-left">
          {maxKeys > 0 && (
            <KeyToggle
              col={col}
              dungeonIndex={dungeonIndex}
              row={row}
              variant="small-key"
            />
          )}
        </div>

        {/* Bottom Right - Small Keys Count, which the key's name also says */}
        <div className="bigkey-quadrant bigkey-quadrant--bottom-right">
          {maxKeys > 0 && (
            <div
              aria-hidden="true"
              className={`bigkey-count ${isMaxed ? "bigkey-count--maxed" : ""}`}
            >
              {keyCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

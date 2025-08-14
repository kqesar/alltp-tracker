import { CSS_CLASSES, SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type SmallKeyProps = {
  /** Dungeon index (0-9) */
  dungeonIndex: number;
  /** Grid row index for positioning */
  row: number;
  /** Grid column index for positioning */
  col: number;
};

/**
 * SmallKey component displays and manages small key count for a specific dungeon
 * Shows as an overlay using the standard overlay system
 * @param dungeonIndex - The dungeon index (0-9)
 * @param row - Grid row for positioning
 * @param col - Grid column for positioning
 */
export const SmallKey = ({ dungeonIndex, row, col }: SmallKeyProps) => {
  const { smallKeys, handleSmallKeyClick } = useGameStore();

  const count = smallKeys[dungeonIndex] || 0;
  const maxKeys = SMALL_KEYS_MAX_BY_INDEX[dungeonIndex] || 0;
  const isMaxed = count === maxKeys;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleSmallKeyClick(dungeonIndex);
  };

  return (
    <button
      aria-label={`Small keys for dungeon ${dungeonIndex}: ${count}/${maxKeys}`}
      className={`${CSS_CLASSES.OVERLAY_BASE} small-key-overlay ${isMaxed ? "small-key-overlay--maxed" : ""}`}
      data-dungeon={dungeonIndex}
      data-grid-col={col}
      data-grid-row={row}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      tabIndex={0}
      title={`Small keys: ${count}/${maxKeys}`}
      type="button"
    >
      <div
        className="small-key-icon"
        style={{
          backgroundImage: `url(${getAssetPath("smallkey.png")})`,
        }}
      />
    </button>
  );
};

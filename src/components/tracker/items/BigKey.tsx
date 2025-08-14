import { CSS_CLASSES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type BigKeyProps = {
  /** Dungeon index (0-9) */
  dungeonIndex: number;
  /** Grid row index for positioning */
  row: number;
  /** Grid column index for positioning */
  col: number;
};

/**
 * BigKey component displays and manages big key state for a specific dungeon
 * Shows as an overlay using the standard overlay system
 * @param dungeonIndex - The dungeon index (0-9)
 * @param row - Grid row for positioning
 * @param col - Grid column for positioning
 */
export const BigKey = ({ dungeonIndex, row, col }: BigKeyProps) => {
  const { items, handleItemClick } = useGameStore();

  const bigKeyKey = `bigkey${dungeonIndex}`;
  const isObtained = (items[bigKeyKey] as number) === 1;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleItemClick(bigKeyKey);
  };

  return (
    <button
      aria-label={`Big key for dungeon ${dungeonIndex}: ${isObtained ? "obtained" : "not obtained"}`}
      className={`${CSS_CLASSES.OVERLAY_BASE} big-key-overlay ${isObtained ? "big-key-overlay--obtained" : ""}`}
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
      title={`Big key for dungeon ${dungeonIndex}: ${isObtained ? "obtained" : "not obtained"}`}
      type="button"
    >
      <div
        className="big-key-icon"
        style={{
          backgroundImage: `url(${getAssetPath("bigkey.png")})`,
        }}
      />
    </button>
  );
};

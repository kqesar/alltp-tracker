import { SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type KeyToggleProps = {
  /** Dungeon index (0-9) */
  dungeonIndex: number;
  /** Grid row index for positioning */
  row: number;
  /** Grid column index for positioning */
  col: number;
  /** Which of the two keysanity keys this button drives */
  variant: "big-key" | "small-key";
};

/**
 * A keysanity key button layered into a dungeon's grid cell.
 *
 * The big key (held or not) and the small key counter share the same button,
 * differing only in the store slice they read and the asset they draw.
 * @param dungeonIndex - The dungeon index (0-9)
 * @param row - Grid row for positioning
 * @param col - Grid column for positioning
 * @param variant - "big-key" or "small-key"
 */
export const KeyToggle = ({
  dungeonIndex,
  row,
  col,
  variant,
}: KeyToggleProps) => {
  const { items, smallKeys, handleItemClick, handleSmallKeyClick } =
    useGameStore();

  const isBigKey = variant === "big-key";
  const maxKeys = SMALL_KEYS_MAX_BY_INDEX[dungeonIndex] || 0;
  const count = smallKeys[dungeonIndex] || 0;
  const obtained = (items[`bigkey${dungeonIndex}`] as number) === 1;

  const isComplete = isBigKey ? obtained : count === maxKeys;
  const label = isBigKey
    ? `Big key for dungeon ${dungeonIndex}: ${obtained ? "obtained" : "not obtained"}`
    : `Small keys for dungeon ${dungeonIndex}: ${count}/${maxKeys}`;

  return (
    <button
      aria-label={label}
      className={`overlay-base ${variant}-overlay ${
        isComplete
          ? `${variant}-overlay--${isBigKey ? "obtained" : "maxed"}`
          : ""
      }`}
      data-dungeon={dungeonIndex}
      data-grid-col={col}
      data-grid-row={row}
      onClick={(event) => {
        // Keep the click from also toggling the cell underneath.
        event.preventDefault();
        event.stopPropagation();
        if (isBigKey) handleItemClick(`bigkey${dungeonIndex}`);
        else handleSmallKeyClick(dungeonIndex);
      }}
      title={isBigKey ? label : `Small keys: ${count}/${maxKeys}`}
      type="button"
    >
      <div
        className={`${variant}-icon`}
        style={{
          backgroundImage: `url(${getAssetPath(
            isBigKey ? "bigkey.png" : "smallkey.png",
          )})`,
        }}
      />
    </button>
  );
};

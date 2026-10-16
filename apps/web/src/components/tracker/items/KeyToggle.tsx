import { SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { dungeons } from "@/data/dungeons";
import { useGridFocusable } from "@/hooks/useGridNavigation";
import { useStepHandlers } from "@/hooks/useStepHandlers";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";
import { placeName } from "@/utils/caption";

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
  const bigKey = useGameStore((state) => state.items[`bigkey${dungeonIndex}`]);
  const count = useGameStore((state) => state.smallKeys[dungeonIndex] || 0);
  const handleItemClick = useGameStore((state) => state.handleItemClick);
  const handleSmallKeyClick = useGameStore(
    (state) => state.handleSmallKeyClick,
  );

  const isBigKey = variant === "big-key";
  const focusable = useGridFocusable({ col, row, slot: isBigKey ? 0 : 1 });
  const steps = useStepHandlers((direction) => {
    if (isBigKey) handleItemClick(`bigkey${dungeonIndex}`, direction);
    else handleSmallKeyClick(dungeonIndex, direction);
  });
  const dungeon = placeName(dungeons[dungeonIndex].name);
  const maxKeys = SMALL_KEYS_MAX_BY_INDEX[dungeonIndex] || 0;
  const obtained = bigKey === 1;

  const isComplete = isBigKey ? obtained : count === maxKeys;
  const label = isBigKey
    ? `${dungeon} big key: ${obtained ? "obtained" : "not obtained"}`
    : `${dungeon} small keys: ${count} of ${maxKeys}`;

  return (
    <button
      aria-label={label}
      className={`overlay-base ${variant}-overlay ${
        isComplete
          ? `${variant}-overlay--${isBigKey ? "obtained" : "maxed"}`
          : ""
      }`}
      {...focusable}
      {...steps}
      data-dungeon={dungeonIndex}
      data-testid={`${variant}-${dungeonIndex}`}
      title={label}
      type="button"
    >
      <span
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

import { CSS_CLASSES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type ChestOverlayProps = {
  bossNumber: number;
};

/**
 * ChestOverlay component renders chest count overlay for dungeons
 * Used in the item grid to show dungeon chest counts
 * @param bossNumber - The boss number (0-9) used to get individual chest count
 */
export const ChestOverlay = ({ bossNumber }: ChestOverlayProps) => {
  const { items, handleItemClick } = useGameStore();

  const chestKey = `chest${bossNumber}`;
  const chestValue = items[chestKey] as number;

  return (
    <div
      className={`${CSS_CLASSES.OVERLAY_BASE} ${CSS_CLASSES.OVERLAY_BOTTOM_LEFT}`}
      data-testid={`chest-overlay-${bossNumber}`}
      onClick={(e) => {
        e.stopPropagation();
        handleItemClick(chestKey);
      }}
      style={{
        backgroundImage: `url(${getAssetPath(`chest${chestValue}.png`)})`,
      }}
    />
  );
};

import { useGameStore } from "../stores/gameStore";
import { getAssetPath } from "../utils";

type MedaillonOverlayProps = {
  bossNumber: number;
};

/**
 * MedaillonOverlay component renders medallion overlay for Dark World bosses
 * Used in the item grid to show medallion requirements for Misery Mire and Turtle Rock
 * @param bossNumber - The boss number (0-9), only shows overlay for bosses 8 and 9
 */
export const MedaillonOverlay = ({ bossNumber }: MedaillonOverlayProps) => {
  const { medallions, handleMedallionChange } = useGameStore();

  // Only show medallion overlay for Dark World bosses (8 and 9)
  if (bossNumber < 8) return null;

  const medallionValue = medallions[bossNumber];
  // Map medallion values to image files (medallion0.png to medallion2.png):
  // 0 = unknown/not assigned (medallion0.png)
  // 1 = bombos (medallion1.png)
  // 2 = ether (medallion2.png)
  // 3 = quake (cycle back to medallion0.png)
  const imageIndex = medallionValue === 3 ? 0 : medallionValue;

  return (
    <div
      className="overlay-base overlay--top-right"
      onClick={(e) => {
        e.stopPropagation();
        // Cycle from 0 to 3, then back to 0
        const newMedallion = (medallionValue + 1) % 4;
        handleMedallionChange(bossNumber, newMedallion);
      }}
      style={{
        backgroundImage: `url(${getAssetPath(`medallion${imageIndex}.png`)})`,
      }}
    />
  );
};

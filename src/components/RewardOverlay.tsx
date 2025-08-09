import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type RewardOverlayProps = {
  bossNumber: number;
};

/**
 * RewardOverlay component renders crystal/pendant overlay for dungeons
 * Used in the item grid to show dungeon rewards (crystals/pendants)
 * @param bossNumber - The boss number (0-9) used to get individual reward
 */
export const RewardOverlay = ({ bossNumber }: RewardOverlayProps) => {
  const { items, handleItemClick } = useGameStore();

  const rewardKey = `reward${bossNumber}`;
  const rewardValue = items[rewardKey] as number;

  return (
    <div
      className="overlay-base overlay--bottom-right"
      onClick={(e) => {
        e.stopPropagation();
        handleItemClick(rewardKey);
      }}
      style={{
        backgroundImage: `url(${getAssetPath(`dungeon${rewardValue}.png`)})`,
      }}
    />
  );
};

import { getAssetPath } from "@/utils";
import type { DungeonItem, ItemState } from "../data/chests";

type DungeonBossProps = {
  dungeon: DungeonItem;
  index: number;
  items: ItemState;
  medallions: number[];
  mapOrientation: boolean;
  onToggle: (index: number) => void;
  onHighlight: (index: number) => void;
  onUnhighlight: () => void;
};

/**
 * DungeonBoss component handles the rendering of a single dungeon boss on the map
 * @param dungeon - The dungeon data
 * @param index - The dungeon index
 * @param items - Current items state
 * @param medallions - Current medallions state
 * @param mapOrientation - Map orientation setting
 * @param onToggle - Callback when boss is clicked
 * @param onHighlight - Callback when boss is hovered
 * @param onUnhighlight - Callback when boss is unhovered
 */
export const DungeonBoss = ({
  dungeon,
  index,
  items,
  medallions,
  mapOrientation,
  onToggle,
  onHighlight,
  onUnhighlight,
}: DungeonBossProps) => {
  // Get dungeon boss availability class
  const getAvailabilityClass = () => {
    const bossKey = `boss${index}`;
    const bossValue = items[bossKey] as number;

    // If boss is beaten (value 2), return "opened"
    if (bossValue === 2) return "opened";

    if (dungeon.isBeaten) return "opened";
    return dungeon.isBeatable(items, medallions);
  };

  // Transform coordinates for vertical orientation
  const getTransformedCoordinates = () => {
    const x = dungeon.x;
    const y = dungeon.y;

    if (!mapOrientation) return { x, y };

    const xNum = parseFloat(x) / 100;
    const yNum = parseFloat(y) / 100;

    if (xNum > 0.5) {
      return {
        x: `${(xNum - 0.5) * 2 * 100}%`,
        y: `${(yNum / 2 + 0.5) * 100}%`,
      };
    } else {
      return {
        x: `${xNum * 2 * 100}%`,
        y: `${(yNum / 2) * 100}%`,
      };
    }
  };

  const coords = getTransformedCoordinates();
  const availabilityClass = getAvailabilityClass();

  return (
    <div
      className={`mapspan boss map-element-base ${availabilityClass}`}
      onClick={() => onToggle(index)}
      onMouseOut={onUnhighlight}
      onMouseOver={() => onHighlight(index)}
      style={{
        backgroundImage: `url(${getAssetPath(dungeon.image)})`,
        left: coords.x,
        top: coords.y,
      }}
    />
  );
};

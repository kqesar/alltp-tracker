import { CornerTable } from "@/components/CornerTable";
import { ChestOverlay } from "@/components/tracker/overlays/ChestOverlay";
import { MedaillonOverlay } from "@/components/tracker/overlays/MedaillonOverlay";
import { RewardOverlay } from "@/components/tracker/overlays/RewardOverlay";
import { CSS_CLASSES } from "@/constants";
import { itemsMin } from "@/data/items";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useTouchGestures } from "@/hooks/useTouchGestures";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type BossItemProps = {
  row: number;
  col: number;
  item: string;
  bossNumber: number;
  /** Callback when item receives focus for keyboard navigation */
  onFocus?: () => void;
  /** Whether this item is draggable */
  draggable?: boolean;
  /** Handler for drag start event */
  onDragStart?: () => void;
  /** Handler for drag over event */
  onDragOver?: (e: React.DragEvent) => void;
  /** Handler for drag leave event */
  onDragLeave?: () => void;
  /** Handler for drop event */
  onDrop?: () => void;
  /** Handler for drag end event */
  onDragEnd?: () => void;
  /** Whether this item is the current drop target */
  isDropTarget?: boolean;
  /** Whether this item is being dragged */
  isDragging?: boolean;
};

/**
 * BossItem component renders a boss item with overlays in the tracker grid
 * Used for all boss items that require medallion, chest, and reward overlays
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The boss item identifier
 * @param bossNumber - The boss number (0-9)
 * @param onFocus - Callback when item receives focus
 */
export const BossItem = ({
  row,
  col,
  item,
  bossNumber,
  onFocus,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDropTarget = false,
  isDragging = false,
}: BossItemProps) => {
  const { items, handleItemClick } = useGameStore();
  const { isTouchDevice } = useDeviceDetection();

  // Set up touch gestures for mobile devices
  const { ref: touchRef } = useTouchGestures({
    disabled: item === "blank" || !isTouchDevice,
    onLongPress: () => {
      // Long press could cycle backward through states or show detailed info
      if (item !== "blank") {
        handleItemClick(item);
      }
    },
    onTap: () => {
      if (item !== "blank") {
        handleItemClick(item);
      }
    },
  });

  // Type-safe ref callback for button element
  const setButtonRef = (element: HTMLButtonElement | null) => {
    if (touchRef) {
      touchRef.current = element;
    }
  };

  /**
   * Gets the background image URL for an item
   * @param item - The item identifier
   * @returns CSS background-image URL string
   */
  const getItemBackground = (item: string): string => {
    if (!item || item === "blank") return "";

    if (typeof items[item] === "boolean") {
      return `url(${getAssetPath(`${item}.png`)})`;
    } else {
      return `url(${getAssetPath(`${item}${items[item]}.png`)})`;
    }
  };

  /**
   * Calculates opacity based on item state
   * @param item - The item identifier
   * @returns Opacity value as string
   */
  const getItemOpacity = (item: string): string => {
    if (!item || item === "blank") return "0.25";

    if (typeof items[item] === "boolean") {
      return items[item] ? "1" : "0.25";
    } else if (typeof items[item] === "number" && item.indexOf("boss") === 0) {
      return "1";
    } else {
      const minValue = itemsMin[item] || 0;
      return (items[item] as number) > minValue ? "1" : "0.25";
    }
  };

  /**
   * Creates common grid item styles
   * @param item - The item identifier
   * @returns Style object for grid items (only dynamic properties)
   */
  const getGridItemStyles = (item: string) => ({
    backgroundImage: getItemBackground(item),
    opacity: getItemOpacity(item),
  });

  /**
   * Get boss name for accessibility
   * @param bossNumber - The boss number
   * @returns Human-readable boss name
   */
  const getBossName = (bossNumber: number): string => {
    const bossNames: Record<number, string> = {
      0: "Armos Knights",
      1: "Lanmolas",
      2: "Moldorm",
      3: "Helmasaur King",
      4: "Arrghus",
      5: "Mothula",
      6: "Blind the Thief",
      7: "Kholdstare",
      8: "Vitreous",
      9: "Trinexx",
    };
    return bossNames[bossNumber] || `Boss ${bossNumber}`;
  };

  /**
   * Get boss state description for accessibility
   * @param item - The item identifier
   * @returns Description of current state
   */
  const getBossStateDescription = (item: string): string => {
    if (typeof items[item] === "number") {
      const state = items[item] as number;
      return state > 0 ? "defeated" : "not defeated";
    }
    return "unknown state";
  };

  const dragClassName = [
    CSS_CLASSES.GRIDITEM,
    CSS_CLASSES.GRID_ITEM_BASE,
    CSS_CLASSES.GRID_ITEM_RELATIVE,
    isDragging ? "dragging" : "",
    isDropTarget ? "drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={`${getBossName(bossNumber)}, ${getBossStateDescription(item)}. Click to change state.`}
      className={dragClassName}
      data-grid-col={col}
      data-grid-row={row}
      draggable={draggable}
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleItemClick(item);
        }
      }}
      ref={setButtonRef}
      style={getGridItemStyles(item)}
      type="button"
    >
      <MedaillonOverlay bossNumber={bossNumber} />
      <ChestOverlay bossNumber={bossNumber} />
      <RewardOverlay bossNumber={bossNumber} />
      <CornerTable />
    </button>
  );
};

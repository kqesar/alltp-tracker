import { CornerTable } from "@/components/CornerTable";
import { CSS_CLASSES } from "@/constants";
import { itemsMin } from "@/data/items";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useTouchGestures } from "@/hooks/useTouchGestures";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type RegularItemProps = {
  row: number;
  col: number;
  item: string;
  /** Callback when item receives focus for keyboard navigation */
  onFocus?: () => void;
};

/**
 * RegularItem component renders a regular (non-boss) item in the tracker grid
 * Used for all items that are not boss items (swords, shields, bottles, etc.)
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The item identifier
 * @param onFocus - Callback when item receives focus
 */
export const RegularItem = ({ row, col, item, onFocus }: RegularItemProps) => {
  const { items, handleItemClick } = useGameStore();
  const { isTouchDevice } = useDeviceDetection();

  // Set up touch gestures for mobile devices
  const { ref: touchRef } = useTouchGestures({
    disabled: item === "blank" || !isTouchDevice,
    onLongPress: () => {
      // Long press could cycle backward through states or show detailed info
      if (item !== "blank") {
        // For now, just handle normal click on long press
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
   * Get item display name for accessibility
   * @param item - The item identifier
   * @returns Human-readable item name
   */
  const getItemName = (item: string): string => {
    if (!item || item === "blank") return "Empty slot";

    // Convert item identifiers to readable names
    const itemNames: Record<string, string> = {
      bomb: "Bombs",
      bombos: "Bombos Medallion",
      book: "Book of Mudora",
      boomerang: "Boomerang",
      boots: "Pegasus Boots",
      bottle: "Bottle",
      bow: "Bow",
      byrna: "Cane of Byrna",
      cape: "Magic Cape",
      ether: "Ether Medallion",
      firerod: "Fire Rod",
      flippers: "Zora's Flippers",
      flute: "Flute",
      glove: "Power Glove",
      halfmagic: "Half Magic",
      hammer: "Hammer",
      hookshot: "Hookshot",
      icerod: "Ice Rod",
      lantern: "Lantern",
      mail: "Mail",
      mirror: "Magic Mirror",
      moonpearl: "Moon Pearl",
      mushroom: "Mushroom",
      net: "Bug Net",
      powder: "Magic Powder",
      quake: "Quake Medallion",
      shield: "Shield",
      somaria: "Cane of Somaria",
      sword: "Sword",
      // Add more mappings as needed
    };

    return itemNames[item] || item.charAt(0).toUpperCase() + item.slice(1);
  };

  /**
   * Get item state description for accessibility
   * @param item - The item identifier
   * @returns Description of current state
   */
  const getItemStateDescription = (item: string): string => {
    if (!item || item === "blank") return "empty";

    if (typeof items[item] === "boolean") {
      return items[item] ? "obtained" : "not obtained";
    } else if (typeof items[item] === "number") {
      const count = items[item] as number;
      const minValue = itemsMin[item] || 0;
      if (count > minValue) {
        return `level ${count}`;
      } else {
        return "not obtained";
      }
    }
    return "unknown state";
  };

  return (
    <button
      aria-label={`${getItemName(item)}, ${getItemStateDescription(item)}. Click to change state.`}
      className={`${CSS_CLASSES.GRIDITEM} ${CSS_CLASSES.GRID_ITEM_BASE}`}
      data-grid-col={col}
      data-grid-row={row}
      disabled={item === "blank"}
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
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
      <CornerTable />
    </button>
  );
};

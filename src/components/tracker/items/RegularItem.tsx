import { CornerTable } from "@/components/CornerTable";
import { CSS_CLASSES } from "@/constants";
import { itemsMin } from "@/data/items";
import { useGameStore } from "@/stores/gameStore";
import { getAssetPath } from "@/utils";

type RegularItemProps = {
  row: number;
  col: number;
  item: string;
};

/**
 * RegularItem component renders a regular (non-boss) item in the tracker grid
 * Used for all items that are not boss items (swords, shields, bottles, etc.)
 * @param row - Grid row index
 * @param col - Grid column index
 * @param item - The item identifier
 */
export const RegularItem = ({ row, col, item }: RegularItemProps) => {
  const { items, handleItemClick } = useGameStore();

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

  return (
    <td
      className={`${CSS_CLASSES.GRIDITEM} ${CSS_CLASSES.GRID_ITEM_BASE}`}
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      style={getGridItemStyles(item)}
    >
      <CornerTable />
    </td>
  );
};

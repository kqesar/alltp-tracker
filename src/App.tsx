import { useState } from "react";
import "./styles.css";
import { Caption } from "./components/Caption";
import { ChestOverlay } from "./components/ChestOverlay";
import { CornerTable } from "./components/CornerTable";
import { MapTracker } from "./components/MapTracker";
import { MedaillonOverlay } from "./components/MedaillonOverlay";
import { RewardOverlay } from "./components/RewardOverlay";
import { defaultItemGrid, itemsMin } from "./data/items";
import { useGameStore } from "./stores/gameStore";
import { getAssetPath } from "./utils";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Get state and actions from Zustand store
  const { items, caption, handleItemClick } = useGameStore();

  // Layout state (keep local as it doesn't need to be shared)
  const [itemLayout] = useState(JSON.parse(JSON.stringify(defaultItemGrid)));

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
   * Renders a boss item with overlays
   * @param row - Grid row index
   * @param col - Grid column index
   * @param item - The boss item identifier
   * @param bossNumber - The boss number (0-9)
   */
  const renderBossItem = (
    row: number,
    col: number,
    item: string,
    bossNumber: number,
  ) => (
    <td
      className="griditem grid-item-base grid-item-relative"
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      style={getGridItemStyles(item)}
    >
      <MedaillonOverlay bossNumber={bossNumber} />
      <ChestOverlay bossNumber={bossNumber} />
      <RewardOverlay bossNumber={bossNumber} />
      <CornerTable />
    </td>
  );

  /**
   * Renders a regular (non-boss) item
   * @param row - Grid row index
   * @param col - Grid column index
   * @param item - The item identifier
   */
  const renderRegularItem = (row: number, col: number, item: string) => (
    <td
      className="griditem grid-item-base"
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      style={getGridItemStyles(item)}
    >
      <CornerTable />
    </td>
  );

  /**
   * Renders a single grid item (boss or regular)
   * @param row - Grid row index
   * @param col - Grid column index
   */
  const renderGridItem = (row: number, col: number) => {
    const item = itemLayout[row][col];

    if (item?.startsWith("boss")) {
      const bossNumber = parseInt(item.replace("boss", ""));
      return renderBossItem(row, col, item, bossNumber);
    }

    return renderRegularItem(row, col, item);
  };

  /**
   * Renders a complete grid row
   * @param rowIndex - The row index to render
   */
  const renderGridRow = (rowIndex: number) => {
    const row = itemLayout[rowIndex];
    if (!row) return null;

    return (
      <table className="tracker" key={rowIndex}>
        <tbody>
          <tr>
            <td className="halfcell" />
            {row
              .slice(0, 7)
              .map((_: string, colIndex: number) =>
                renderGridItem(rowIndex, colIndex),
              )}
            <td className="halfcell" />
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div id="layoutdiv">
        <div className="itemdiv" id="itemdiv">
          {itemLayout.map((_: string[], rowIndex: number) =>
            renderGridRow(rowIndex),
          )}
        </div>
        <div className="mapdiv" id="mapdiv">
          <MapTracker />
        </div>
      </div>

      <div className="caption-container" id="caption">
        <Caption text={caption} />
      </div>
    </div>
  );
}

export default App;

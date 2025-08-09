import { useState } from "react";
import "./styles.css";
import { BossItem } from "./components/BossItem";
import { Caption } from "./components/Caption";
import { MapTracker } from "./components/MapTracker";
import { RegularItem } from "./components/RegularItem";
import { defaultItemGrid } from "./data/items";
import { useGameStore } from "./stores/gameStore";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Get state and actions from Zustand store
  const { caption } = useGameStore();

  // Layout state (keep local as it doesn't need to be shared)
  const [itemLayout] = useState(JSON.parse(JSON.stringify(defaultItemGrid)));

  /**
   * Renders a single grid item (boss or regular)
   * @param row - Grid row index
   * @param col - Grid column index
   */
  const renderGridItem = (row: number, col: number) => {
    const item = itemLayout[row][col];

    if (item?.startsWith("boss")) {
      const bossNumber = parseInt(item.replace("boss", ""));
      return (
        <BossItem
          bossNumber={bossNumber}
          col={col}
          item={item}
          key={`${row}_${col}`}
          row={row}
        />
      );
    }

    return (
      <RegularItem col={col} item={item} key={`${row}_${col}`} row={row} />
    );
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

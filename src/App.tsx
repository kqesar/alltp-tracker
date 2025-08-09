import { useState } from "react";
import "./styles.css";
import { Caption } from "./components/Caption";
import { GridRow } from "./components/GridRow";
import { MapTracker } from "./components/MapTracker";
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
  const [itemLayout] = useState(defaultItemGrid);

  return (
    <div>
      <div id="layoutdiv">
        <div className="itemdiv" id="itemdiv">
          {itemLayout.map((row: string[], rowIndex: number) => (
            <GridRow
              // biome-ignore lint/suspicious/noArrayIndexKey: Row position is stable and meaningful in grid layout
              key={`row-${rowIndex}`}
              row={row}
              rowIndex={rowIndex}
            />
          ))}
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

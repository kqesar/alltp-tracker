import { useState } from "react";
import "./styles.css";
import { MapTracker } from "./components/map";
import { TrackerGrid } from "./components/tracker";
import { Caption } from "./components/ui";
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
        <TrackerGrid itemLayout={itemLayout} />
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

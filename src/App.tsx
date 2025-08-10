import { useState } from "react";
import "@/styles/index.css";
import { MapTracker } from "@/components/map/MapTracker";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { Caption } from "@/components/ui/Caption";
import { Header } from "@/components/ui/Header";
import { CSS_CLASSES } from "@/constants";
import { defaultItemGrid } from "@/data/items";
import { useGameStore } from "@/stores/gameStore";

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
    <>
      <Header />
      <main className="main-content">
        <div id="layoutdiv">
          <TrackerGrid itemLayout={itemLayout} />
          <div className={CSS_CLASSES.MAPDIV} id="mapdiv">
            <MapTracker />
          </div>
        </div>

        <div className={CSS_CLASSES.CAPTION_CONTAINER} id="caption">
          <Caption text={caption} />
        </div>
      </main>
    </>
  );
}

export default App;

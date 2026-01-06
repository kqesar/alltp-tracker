import "@/styles/index.css";
import { MapTracker } from "@/components/map/MapTracker";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { BigKeyToggle } from "@/components/ui/BigKeyToggle";
import { Caption } from "@/components/ui/Caption";
import { Header } from "@/components/ui/Header";
import { CSS_CLASSES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Get state and actions from Zustand store
  const { caption, bigKeysVisible, setBigKeysVisible } = useGameStore();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <BigKeyToggle isVisible={bigKeysVisible} onToggle={setBigKeysVisible} />
      {/* Static IDs are intentional for SPA layout elements referenced by CSS and skip links */}
      <main className="main-content" id="main-content">
        <div id="layoutdiv">
          <TrackerGrid />
          <aside
            aria-label="Map display"
            className={CSS_CLASSES.MAPDIV}
            id="mapdiv"
          >
            <MapTracker />
          </aside>
        </div>

        <aside
          aria-label="Item information"
          className={CSS_CLASSES.CAPTION_CONTAINER}
          id="caption"
        >
          <Caption text={caption} />
        </aside>
      </main>
    </>
  );
}

export default App;

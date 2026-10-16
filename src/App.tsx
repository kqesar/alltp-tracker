import { MapLegend } from "@/components/map/MapLegend";
import { MapTracker } from "@/components/map/MapTracker";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { BigKeyToggle } from "@/components/ui/BigKeyToggle";
import { LiveCaption } from "@/components/ui/Caption";
import { Header } from "@/components/ui/Header";
import { TrackerControls } from "@/components/ui/TrackerControls";
import { defaultItemGrid } from "@/data/items";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import { useGameStore } from "@/stores/gameStore";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  useUndoShortcuts();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const setBigKeysVisible = useGameStore((state) => state.setBigKeysVisible);
  const mapLayout = useGameStore((state) => state.mapLayout);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <TrackerControls />
      <BigKeyToggle isVisible={bigKeysVisible} onToggle={setBigKeysVisible} />
      {/* Static IDs are intentional for SPA layout elements referenced by CSS and skip links */}
      <main className="main-content" id="main-content">
        <div
          className={mapLayout === "stacked" ? "layout--stacked" : undefined}
          data-testid="layout"
          id="layoutdiv"
        >
          <TrackerGrid itemLayout={defaultItemGrid} />
          <aside aria-label="Map display" className="mapdiv" id="mapdiv">
            <MapTracker />
            <MapLegend />
          </aside>
        </div>

        <aside
          aria-label="Item information"
          className="caption-container"
          id="caption"
        >
          <LiveCaption />
        </aside>
      </main>
    </>
  );
}

export default App;

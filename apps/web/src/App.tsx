import { MapLegend } from "@/components/map/MapLegend";
import { MapTracker } from "@/components/map/MapTracker";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { BigKeyToggle } from "@/components/ui/BigKeyToggle";
import { Header } from "@/components/ui/Header";
import { Tooltip } from "@/components/ui/Tooltip";
import { TrackerControls } from "@/components/ui/TrackerControls";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { defaultItemGrid } from "@/data/items";
import { useItemShortcuts } from "@/hooks/useItemShortcuts";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import { useGameStore } from "@/stores/gameStore";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  useUndoShortcuts();
  useItemShortcuts();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const setBigKeysVisible = useGameStore((state) => state.setBigKeysVisible);
  const mapLayout = useGameStore((state) => state.mapLayout);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <a className="skip-link" href="#map">
        Skip to map
      </a>
      <UpdatePrompt />
      <Header />
      <div className="toolbar" data-testid="toolbar">
        <TrackerControls />
        <BigKeyToggle isVisible={bigKeysVisible} onToggle={setBigKeysVisible} />
      </div>
      <main className="main-content" id="main-content">
        <div
          className={`layout${mapLayout === "stacked" ? " layout--stacked" : ""}`}
          data-testid="layout"
        >
          <TrackerGrid itemLayout={defaultItemGrid} />
          <div className="map-panel" id="map">
            <MapTracker />
            <MapLegend />
          </div>
        </div>
      </main>
      <Tooltip />
    </>
  );
}

export default App;

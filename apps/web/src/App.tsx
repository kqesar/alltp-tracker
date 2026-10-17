import { type MouseEvent, useRef } from "react";
import { flushSync } from "react-dom";
import { SeedPrompt } from "@/components/autotrack/SeedPrompt";
import { MAP_VIEW_ID, MapPanel } from "@/components/map/MapPanel";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { BigKeyToggle } from "@/components/ui/BigKeyToggle";
import { Header } from "@/components/ui/Header";
import { Tooltip } from "@/components/ui/Tooltip";
import { TrackerControls } from "@/components/ui/TrackerControls";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { defaultItemGrid } from "@/data/items";
import { useAutotrack } from "@/hooks/useAutotrack";
import { useItemShortcuts } from "@/hooks/useItemShortcuts";
import { useRunAnalysis } from "@/hooks/useRunAnalysis";
import { useToolbarFit } from "@/hooks/useToolbarFit";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import { useGameStore } from "@/stores/gameStore";
import type { MapView } from "@/utils";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  useUndoShortcuts();
  useItemShortcuts();
  useAutotrack();
  useRunAnalysis();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const setBigKeysVisible = useGameStore((state) => state.setBigKeysVisible);
  const mapLayout = useGameStore((state) => state.mapLayout);
  const setMapView = useGameStore((state) => state.setMapView);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useToolbarFit(toolbarRef);

  // Render the chosen view before its panel takes the focus
  const skipTo = (view: MapView) => (event: MouseEvent) => {
    event.preventDefault();
    flushSync(() => setMapView(view));
    document.getElementById(MAP_VIEW_ID)?.focus();
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {/* biome-ignore lint/a11y/useValidAnchor: a skip link navigates; its href holds without script */}
      <a className="skip-link" href="#map" onClick={skipTo("map")}>
        Skip to map
      </a>
      {/* biome-ignore lint/a11y/useValidAnchor: a skip link navigates; its href holds without script */}
      <a className="skip-link" href="#map" onClick={skipTo("checks")}>
        Skip to checks
      </a>
      <div className="notices">
        <UpdatePrompt />
        <SeedPrompt />
      </div>
      <Header />
      <div className="toolbar" data-testid="toolbar" ref={toolbarRef}>
        <TrackerControls />
        <BigKeyToggle isVisible={bigKeysVisible} onToggle={setBigKeysVisible} />
      </div>
      <main className="main-content" id="main-content">
        <div
          className={`layout${mapLayout === "stacked" ? " layout--stacked" : ""}`}
          data-testid="layout"
        >
          <TrackerGrid itemLayout={defaultItemGrid} />
          <MapPanel />
        </div>
      </main>
      <Tooltip />
    </>
  );
}

export default App;

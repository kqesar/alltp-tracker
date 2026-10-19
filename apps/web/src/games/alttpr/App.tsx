import { type MouseEvent, useRef } from "react";
import { flushSync } from "react-dom";
import { Header } from "@/components/ui/Header";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { SeedPrompt } from "@/games/alttpr/components/autotrack/SeedPrompt";
import { MAP_VIEW_ID, MapPanel } from "@/games/alttpr/components/map/MapPanel";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { BigKeyToggle } from "@/games/alttpr/components/ui/BigKeyToggle";
import { Tooltip } from "@/games/alttpr/components/ui/Tooltip";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { itemGridFor } from "@/games/alttpr/data/items";
import { useAutotrack } from "@/games/alttpr/hooks/useAutotrack";
import { useCrossedLogic } from "@/games/alttpr/hooks/useCrossedLogic";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { useRunAnalysis } from "@/games/alttpr/hooks/useRunAnalysis";
import { useUndoShortcuts } from "@/games/alttpr/hooks/useUndoShortcuts";
import { useVoice } from "@/games/alttpr/hooks/useVoice";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useToolbarFit } from "@/hooks/useToolbarFit";
import type { MapView } from "@/utils";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  useUndoShortcuts();
  useItemShortcuts();
  useAutotrack();
  useVoice();
  useRunAnalysis();
  useCrossedLogic();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const grid = useGameStore((state) => itemGridFor(state.settings));
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
          className={`layout${mapLayout === "stacked" ? " layout--stacked" : ""}${bigKeysVisible ? " layout--key-rows" : ""}`}
          data-testid="layout"
        >
          <TrackerGrid itemLayout={grid} />
          <MapPanel />
        </div>
      </main>
      <Tooltip />
    </>
  );
}

export default App;

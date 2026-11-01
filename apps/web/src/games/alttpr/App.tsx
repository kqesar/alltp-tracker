import type { CSSProperties, MouseEvent } from "react";
import { flushSync } from "react-dom";
import { GameShell } from "@/components/ui/GameShell";
import { SeedPrompt } from "@/games/alttpr/components/autotrack/SeedPrompt";
import { MAP_VIEW_ID, MapPanel } from "@/games/alttpr/components/map/MapPanel";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { Tooltip } from "@/games/alttpr/components/ui/Tooltip";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { itemGridFor } from "@/games/alttpr/data/items";
import { useAutotrack } from "@/games/alttpr/hooks/useAutotrack";
import { useBonkDrops } from "@/games/alttpr/hooks/useBonkDrops";
import { useCrossedLogic } from "@/games/alttpr/hooks/useCrossedLogic";
import { useDoorLogic } from "@/games/alttpr/hooks/useDoorLogic";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { useRunAnalysis } from "@/games/alttpr/hooks/useRunAnalysis";
import { useVoice } from "@/games/alttpr/hooks/useVoice";
import { useCloseReview } from "@/games/alttpr/review/useReview";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { type MapView, visibleRows } from "@/games/alttpr/utils";
import { useUndoShortcuts } from "@/games/useUndoShortcuts";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  useUndoShortcuts(useGameStore);
  useItemShortcuts();
  useAutotrack();
  useVoice();
  useRunAnalysis();
  useCloseReview();
  useCrossedLogic();
  useDoorLogic();
  useBonkDrops();
  const bigKeysVisible = useGameStore((state) => state.bigKeysVisible);
  const grid = useGameStore((state) => itemGridFor(state.settings));
  // The grid's height in rows sizes --cell (layout.css): the key cells'
  // rows while they show, a retro run's shops or a hunt's pieces
  const gridRows = visibleRows(grid, bigKeysVisible).length;
  const mapLayout = useGameStore((state) => state.mapLayout);
  const setMapView = useGameStore((state) => state.setMapView);

  // Render the chosen view before its panel takes the focus
  const skipTo = (view: MapView) => (event: MouseEvent) => {
    event.preventDefault();
    flushSync(() => setMapView(view));
    document.getElementById(MAP_VIEW_ID)?.focus();
  };

  return (
    <>
      <GameShell
        game="alttpr"
        notices={<SeedPrompt />}
        skipLinks={
          <>
            {/* biome-ignore lint/a11y/useValidAnchor: a skip link navigates; its href holds without script */}
            <a className="skip-link" href="#map" onClick={skipTo("map")}>
              Skip to map
            </a>
            {/* biome-ignore lint/a11y/useValidAnchor: a skip link navigates; its href holds without script */}
            <a className="skip-link" href="#map" onClick={skipTo("checks")}>
              Skip to checks
            </a>
          </>
        }
        toolbar={<TrackerControls />}
      >
        <div
          className={`layout${mapLayout === "stacked" ? " layout--stacked" : ""}${bigKeysVisible ? " layout--key-rows" : ""}`}
          data-testid="layout"
          style={{ "--grid-rows": gridRows } as CSSProperties}
        >
          <TrackerGrid itemLayout={grid} />
          <MapPanel />
        </div>
      </GameShell>
      <Tooltip />
    </>
  );
}

export default App;

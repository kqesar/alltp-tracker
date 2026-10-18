import { useId } from "react";
import { ChecksPanel } from "@/components/map/ChecksPanel";
import { GoMode } from "@/components/map/GoMode";
import { MapLegend } from "@/components/map/MapLegend";
import { MapTracker } from "@/components/map/MapTracker";
import { RunPanel } from "@/components/map/RunPanel";
import { RunTimer } from "@/components/map/RunTimer";
import { VoiceControl, VoiceLiveRegion } from "@/components/map/VoiceControl";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";
import { useGameStore } from "@/stores/gameStore";
import type { MapView } from "@/utils";

/** The panel's views, as its tabs. */
const VIEWS = [
  { label: "Map", value: "map" },
  { label: "Checks", value: "checks" },
  { label: "Run", value: "run" },
] as const satisfies readonly Tab<MapView>[];

/** The id of the view's panel, which the skip links focus. */
export const MAP_VIEW_ID = "map-view";

/**
 * The map panel: the two worlds with their legend, every check as a list
 * (ChecksPanel) or the run's splits, timeline and stats (RunPanel), behind
 * ARIA tabs, with voice commands, the run timer and go mode beside them. The view is a
 * preference of the device, kept across runs.
 */
export const MapPanel = () => {
  const view = useGameStore((state) => state.mapView);
  const setMapView = useGameStore((state) => state.setMapView);
  const baseId = useId();

  return (
    <div className="map-panel" id="map">
      <div className="map-panel__bar">
        <Tabs
          baseId={baseId}
          label="Map view"
          onSelect={setMapView}
          panelId={MAP_VIEW_ID}
          selected={view}
          tabs={VIEWS}
          testId="map-view-tab"
        />
        <div className="map-panel__status">
          <VoiceControl />
          <RunTimer />
          <GoMode />
          <VoiceLiveRegion />
        </div>
      </div>
      <div
        aria-labelledby={tabId(baseId, view)}
        className="map-view"
        id={MAP_VIEW_ID}
        role="tabpanel"
        tabIndex={-1}
      >
        {view === "map" && (
          <>
            <MapTracker />
            <MapLegend />
          </>
        )}
        {view === "checks" && <ChecksPanel />}
        {view === "run" && <RunPanel />}
      </div>
    </div>
  );
};

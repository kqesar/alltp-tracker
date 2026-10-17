import { useId } from "react";
import { ChecksPanel } from "@/components/map/ChecksPanel";
import { GoMode } from "@/components/map/GoMode";
import { MapLegend } from "@/components/map/MapLegend";
import { MapTracker } from "@/components/map/MapTracker";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";
import { useGameStore } from "@/stores/gameStore";
import type { MapView } from "@/utils";

/** The panel's views, as its tabs. */
const VIEWS = [
  { label: "Map", value: "map" },
  { label: "Checks", value: "checks" },
] as const satisfies readonly Tab<MapView>[];

/** The id of the view's panel, which the skip links focus. */
export const MAP_VIEW_ID = "map-view";

/**
 * The map panel: the two worlds with their legend, or every check as a list
 * (ChecksPanel), behind ARIA tabs, with the run's go mode beside them. The
 * view is a preference of the device, kept across runs.
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
        <GoMode />
      </div>
      <div
        aria-labelledby={tabId(baseId, view)}
        className="map-view"
        id={MAP_VIEW_ID}
        role="tabpanel"
        tabIndex={-1}
      >
        {view === "map" ? (
          <>
            <MapTracker />
            <MapLegend />
          </>
        ) : (
          <ChecksPanel />
        )}
      </div>
    </div>
  );
};

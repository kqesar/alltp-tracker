import { lazy, Suspense, useId } from "react";
import { MapLegend } from "@/components/map/MapLegend";
import { ReviewNotice } from "@/components/ui/ReviewNotice";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";
import { ChecksPanel } from "@/games/alttpr/components/map/ChecksPanel";
import { GoMode } from "@/games/alttpr/components/map/GoMode";
import { LogicNote } from "@/games/alttpr/components/map/LogicNote";
import { MapTracker } from "@/games/alttpr/components/map/MapTracker";
import { ReviewButton } from "@/games/alttpr/components/map/ReviewSection";
import { RunPanel } from "@/games/alttpr/components/map/RunPanel";
import { RunTimer } from "@/games/alttpr/components/map/RunTimer";
import {
  VoiceControl,
  VoiceLiveRegion,
} from "@/games/alttpr/components/map/VoiceControl";
import { doorShuffleSettingsOf } from "@/games/alttpr/data/doorRando";
import { doorLogic, entrancesShuffled } from "@/games/alttpr/data/presets";
import { marginShown, tricksShown } from "@/games/alttpr/logic/solution";
import { capitalized, useLogicWords } from "@/games/alttpr/logic/words";
import { useReview } from "@/games/alttpr/review/useReview";
import { useDarkRoomStore } from "@/games/alttpr/stores/darkRoomStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type { MapView } from "@/games/alttpr/utils";
import { useReviewStore } from "@/review/store";

/**
 * The panel's views, as its tabs: the Entrances list with shuffled ones,
 * the Doors list with shuffled doors.
 */
const viewsOf = (
  entrances: boolean,
  doors: boolean,
): readonly Tab<MapView>[] => [
  { label: "Map", value: "map" },
  { label: "Checks", value: "checks" },
  ...(entrances ? [{ label: "Entrances", value: "entrances" as const }] : []),
  ...(doors ? [{ label: "Doors", value: "doors" as const }] : []),
  { label: "Run", value: "run" },
];
const VIEWS = [false, true].map((entrances) =>
  [false, true].map((doors) => viewsOf(entrances, doors)),
);

/** The entrance assistant's list and picker, loaded with their tables. */
const EntrancesPanel = lazy(
  () => import("@/games/alttpr/components/map/entrances/EntrancesPanel"),
);
const EntrancePicker = lazy(
  () => import("@/games/alttpr/components/map/entrances/EntrancePicker"),
);

/** A door shuffle's notes, loaded with DR's world. */
const DoorsPanel = lazy(
  () => import("@/games/alttpr/components/map/doors/DoorsPanel"),
);

/** The dark room's plan: its code loads only when a dark room is read. */
const DarkRoomPanel = lazy(
  () => import("@/games/alttpr/components/map/DarkRoomPanel"),
);

/** The id of the view's panel, which the skip links focus. */
export const MAP_VIEW_ID = "map-view";

/**
 * The map panel: the two worlds with their legend, every check as a list
 * (ChecksPanel) or the run's splits, timeline and stats (RunPanel), behind
 * ARIA tabs, with voice commands, the run timer and go mode beside them. The view is a
 * preference of the device, kept across runs. Over the tabs, a dark room's plan
 * while autotracking reads Link in one without the Lamp.
 */
export const MapPanel = () => {
  const shuffled = useGameStore((state) => entrancesShuffled(state.settings));
  const doors = useGameStore(
    (state) =>
      doorLogic(state.settings) &&
      doorShuffleSettingsOf(state.settings) !== undefined,
  );
  const saved = useGameStore((state) => state.mapView);
  // A run without shuffled entrances or doors has no tab for them: the map
  const view =
    (saved === "entrances" && !shuffled) || (saved === "doors" && !doors)
      ? "map"
      : saved;
  const setMapView = useGameStore((state) => state.setMapView);
  const tricksOn = useGameStore(tricksShown);
  const marginOn = useGameStore(marginShown);
  const words = useLogicWords();
  const baseId = useId();
  const review = useReview();
  const closeReview = useReviewStore((state) => state.close);
  const inDarkRoom = useDarkRoomStore((state) => state.map !== null);

  return (
    <div className="map-panel" id="map">
      <div className="map-panel__bar">
        <Tabs
          baseId={baseId}
          label="Map view"
          onSelect={setMapView}
          panelId={MAP_VIEW_ID}
          selected={view}
          tabs={
            VIEWS[Number(shuffled)]?.[Number(doors)] ?? viewsOf(false, false)
          }
          testId="map-view-tab"
        />
        <div className="map-panel__status">
          <VoiceControl />
          <RunTimer />
          <ReviewButton />
          <GoMode />
          <VoiceLiveRegion />
        </div>
      </div>
      {review !== null && (
        <ReviewNotice
          hint="The board shows what each place held: markers, Checks and the grid."
          onClose={closeReview}
          review={review}
        />
      )}
      {inDarkRoom && (
        <Suspense fallback={null}>
          <DarkRoomPanel />
        </Suspense>
      )}
      <div
        aria-labelledby={tabId(baseId, view)}
        className="map-view"
        id={MAP_VIEW_ID}
        role="tabpanel"
        tabIndex={-1}
      >
        {view !== "run" && <LogicNote />}
        {view === "map" && (
          <>
            <MapTracker />
            <MapLegend
              margin={marginOn}
              trick={tricksOn}
              unavailable={capitalized(words.no)}
            />
          </>
        )}
        {view === "checks" && <ChecksPanel />}
        {view === "entrances" && (
          <Suspense fallback={null}>
            <EntrancesPanel />
          </Suspense>
        )}
        {view === "doors" && (
          <Suspense fallback={null}>
            <DoorsPanel />
          </Suspense>
        )}
        {view === "run" && <RunPanel />}
      </div>
      {shuffled && (
        <Suspense fallback={null}>
          <EntrancePicker />
        </Suspense>
      )}
    </div>
  );
};

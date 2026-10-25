import {
  HYRULE_MARKERS,
  type Smz3Marker,
  ZEBES_MARKERS,
} from "@alltp/pack-smz3";
import {
  type CSSProperties,
  lazy,
  Suspense,
  useEffect,
  useId,
  useState,
} from "react";
import { MapLegend } from "@/components/map/MapLegend";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";
import { STATE_LABELS, useMarkerState } from "@/games/smz3/logic";
import { useMarkerHeld } from "@/games/smz3/review/labels";
import { useReview } from "@/games/smz3/review/useReview";
import { useSmz3Store } from "@/games/smz3/store";

// The review's tab is a chunk of its own: a player who never reviews a run
// downloads none of it
const Smz3ReviewPanel = lazy(
  () => import("@/games/smz3/components/Smz3ReviewPanel"),
);

const poi = `url(${import.meta.env.BASE_URL}assets/poi.png)`;

/**
 * A marker standing for one location or several (a cave's chests, a
 * dungeon's, a room's items). Clicking it checks them all, or none once all
 * are, as ALttPR's map does.
 */
const Marker = ({ marker }: { marker: Smz3Marker }) => {
  const state = useMarkerState(marker.locations);
  const toggleChecks = useSmz3Store((store) => store.toggleChecks);
  const count = marker.locations.length;
  // In a review: what the marker held, drawn on it and said in its name
  const held = useMarkerHeld(marker.id);
  const icon = held?.top.icon ?? null;
  const heldStyle: CSSProperties | undefined =
    icon === null
      ? undefined
      : icon.kind === "asset"
        ? ({
            "--held": `url(${import.meta.env.BASE_URL}assets/${icon.file})`,
          } as CSSProperties)
        : ({ "--frame": icon.frame, "--held": "none" } as CSSProperties);
  return (
    <button
      aria-label={`${marker.name}${count > 1 ? ` (${count} checks)` : ""}: ${STATE_LABELS[state]}${held ? `. Held: ${held.words}; ${state === "opened" ? "all checked" : "not all checked"}` : ""}`}
      aria-pressed={state === "opened"}
      className={`mapspan chest state-glyph ${state}`}
      data-held={
        icon === null ? undefined : icon.kind === "sheet" ? "sheet" : ""
      }
      data-review={held ? (state === "opened" ? "found" : "missed") : undefined}
      data-testid={`marker-${marker.id}`}
      onClick={() => toggleChecks(marker.locations)}
      style={
        {
          "--x": `${marker.x}%`,
          "--y": `${marker.y}%`,
          backgroundImage: poi,
          ...heldStyle,
        } as CSSProperties
      }
      type="button"
    />
  );
};

type MapId = "hyrule" | "zebes" | "review";

const MAP_TABS: readonly Tab<MapId>[] = [
  { label: "Hyrule", value: "hyrule" },
  { label: "Zebes", value: "zebes" },
];

/** The maps' tabs, and the review's while one is open. */
const REVIEW_TABS: readonly Tab<MapId>[] = [
  ...MAP_TABS,
  { label: "Review", value: "review" },
];

/** Hyrule's two worlds, as ALttPR's map draws them (map.css). */
const Hyrule = () => (
  <div className="map-worlds map-worlds--auto">
    {(["light", "dark"] as const).map((world) => (
      <section
        aria-label={world === "light" ? "Light World" : "Dark World"}
        className={`map-world map-world--${world} pixel-art`}
        data-testid={`map-world-${world}`}
        key={world}
      >
        {HYRULE_MARKERS[world].map((marker) => (
          <Marker key={marker.id} marker={marker} />
        ))}
      </section>
    ))}
  </div>
);

/** Zebes, its areas as VARIA's maps draw them (packs/smz3 markers.ts). */
const Zebes = () => (
  <section
    aria-label="Zebes"
    className="smz3-zebes pixel-art"
    data-testid="map-zebes"
  >
    {ZEBES_MARKERS.map((marker) => (
      <Marker key={marker.id} marker={marker} />
    ))}
  </section>
);

/**
 * The maps: Hyrule's two worlds and Zebes, one at a time under their tabs,
 * and what the markers' colours and glyphs mean.
 */
export const Smz3Maps = () => {
  const [chosen, setMap] = useState<MapId>("hyrule");
  const review = useReview();
  const id = useId();
  // A review opening shows its tab; one closing gives the maps back
  const reviewing = review !== null;
  useEffect(() => {
    setMap((now) => (reviewing ? "review" : now === "review" ? "hyrule" : now));
  }, [reviewing]);
  const map: MapId = !reviewing && chosen === "review" ? "hyrule" : chosen;
  const panelId = `${id}-panel`;
  return (
    <section
      aria-label="Map tracker with locations"
      className="smz3-maps"
      data-testid="map-tracker"
    >
      <h2 className="sr-only">Map locations</h2>
      <Tabs
        baseId={id}
        label="Map"
        onSelect={setMap}
        panelId={panelId}
        selected={map}
        tabs={reviewing ? REVIEW_TABS : MAP_TABS}
        testId="smz3-map-tab"
      />
      <div
        aria-labelledby={tabId(id, map)}
        className="smz3-maps__panel"
        id={panelId}
        role="tabpanel"
      >
        {map === "review" && review !== null ? (
          <Suspense fallback={<p className="run-section__empty">Loading…</p>}>
            <Smz3ReviewPanel review={review} />
          </Suspense>
        ) : map === "zebes" ? (
          <Zebes />
        ) : (
          <Hyrule />
        )}
      </div>
      {map !== "review" && <MapLegend seen={false} />}
    </section>
  );
};

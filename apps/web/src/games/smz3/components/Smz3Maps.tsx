import {
  HYRULE_MARKERS,
  type Smz3Marker,
  ZEBES_MARKERS,
} from "@alltp/pack-smz3";
import { type CSSProperties, useId, useState } from "react";
import { MapLegend } from "@/components/map/MapLegend";
import { Tabs, tabId } from "@/components/ui/Tabs";
import { STATE_LABELS, useMarkerState } from "@/games/smz3/logic";
import { useSmz3Store } from "@/games/smz3/store";

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
  return (
    <button
      aria-label={`${marker.name}${count > 1 ? ` (${count} checks)` : ""}: ${STATE_LABELS[state]}`}
      aria-pressed={state === "opened"}
      className={`mapspan chest state-glyph ${state}`}
      data-testid={`marker-${marker.id}`}
      onClick={() => toggleChecks(marker.locations)}
      style={
        {
          "--x": `${marker.x}%`,
          "--y": `${marker.y}%`,
          backgroundImage: poi,
        } as CSSProperties
      }
      type="button"
    />
  );
};

type MapId = "hyrule" | "zebes";

const TABS = [
  { label: "Hyrule", value: "hyrule" },
  { label: "Zebes", value: "zebes" },
] as const;

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
  const [map, setMap] = useState<MapId>("hyrule");
  const id = useId();
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
        tabs={TABS}
        testId="smz3-map-tab"
      />
      <div
        aria-labelledby={tabId(id, map)}
        className="smz3-maps__panel"
        id={panelId}
        role="tabpanel"
      >
        {map === "hyrule" ? <Hyrule /> : <Zebes />}
      </div>
      <MapLegend seen={false} />
    </section>
  );
};

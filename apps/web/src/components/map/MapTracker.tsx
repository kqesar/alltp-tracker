import { type MapMarker, markersOf } from "@alltp/pack-alttpr";
import { MapDungeon, MapLocation } from "@/components/map/MapMarkers";
import { packSettings } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";
import { toWorldPosition, type World } from "@/utils";

const WORLDS: { id: World; label: string }[] = [
  { id: "light", label: "Light World" },
  { id: "dark", label: "Dark World" },
];

type ByWorld = Record<World, readonly MapMarker[]>;

const split = new WeakMap<readonly MapMarker[], ByWorld>();

/**
 * A world's markers, by the half of the map they sit in: computed once per
 * marker list, so the board's settings pick one of two.
 */
const byWorld = (markers: readonly MapMarker[]): ByWorld => {
  let found = split.get(markers);
  if (found === undefined) {
    const half = (world: World) =>
      markers.filter(
        (marker) =>
          toWorldPosition(`${marker.x}%`, `${marker.y}%`).world === world,
      );
    found = { dark: half("dark"), light: half("light") };
    split.set(markers, found);
  }
  return found;
};

/**
 * The two worlds, each drawn as its own square with the markers of the
 * run's world that lie in it: a location's (or a cave's), or a dungeon's.
 * An Inverted run moves some doors (the pack's markersOf). Side by side or
 * stacked, per the player's map layout; on "auto" the map stacks itself
 * when it gets too narrow (see map.css).
 */
export const MapTracker = () => {
  const mapLayout = useGameStore((state) => state.mapLayout);
  const markers = useGameStore((state) =>
    byWorld(markersOf(packSettings(state.settings))),
  );

  return (
    <section
      aria-label="Map tracker with locations and dungeons"
      className={`map-worlds map-worlds--${mapLayout}`}
      data-testid="map-tracker"
    >
      <h2 className="sr-only">Map Locations</h2>
      {WORLDS.map((world) => (
        <section
          aria-label={world.label}
          className={`map-world map-world--${world.id} pixel-art`}
          data-testid={`map-world-${world.id}`}
          key={world.id}
        >
          {markers[world.id].map((marker) =>
            marker.dungeon === undefined ? (
              <MapLocation key={marker.id} marker={marker} />
            ) : (
              <MapDungeon
                dungeon={marker.dungeon}
                key={marker.id}
                marker={marker}
              />
            ),
          )}
        </section>
      ))}
    </section>
  );
};

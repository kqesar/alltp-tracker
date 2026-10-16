import { MARKERS } from "@alltp/pack-alttpr";
import { MapDungeon, MapLocation } from "@/components/map/MapMarkers";
import { useGameStore } from "@/stores/gameStore";
import { toWorldPosition, type World } from "@/utils";

const WORLDS: { id: World; label: string }[] = [
  { id: "light", label: "Light World" },
  { id: "dark", label: "Dark World" },
];

/** The pack's markers, by the world whose half of the map they sit in. */
const MARKERS_BY_WORLD: Record<World, typeof MARKERS> = {
  dark: MARKERS.filter(
    (marker) =>
      toWorldPosition(`${marker.x}%`, `${marker.y}%`).world === "dark",
  ),
  light: MARKERS.filter(
    (marker) =>
      toWorldPosition(`${marker.x}%`, `${marker.y}%`).world === "light",
  ),
};

/**
 * The two worlds, each drawn as its own square with the pack's markers that
 * lie in it: a location's (or a cave's), or a dungeon's. Side by side or
 * stacked, per the player's map layout; on "auto" the map stacks itself
 * when it gets too narrow (see map.css).
 */
export const MapTracker = () => {
  const mapLayout = useGameStore((state) => state.mapLayout);

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
          {MARKERS_BY_WORLD[world.id].map((marker) =>
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

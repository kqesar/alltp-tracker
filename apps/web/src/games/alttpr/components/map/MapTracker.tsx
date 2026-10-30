import { type MapMarker, markersOf } from "@alltp/pack-alttpr";
import { lazy, Suspense } from "react";
import { BonkMarkers } from "@/games/alttpr/components/map/BonkMarkers";
import {
  MapDungeon,
  MapLocation,
} from "@/games/alttpr/components/map/MapMarkers";
import { entrancesShuffled } from "@/games/alttpr/data/presets";
import { packSettings } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { toWorldPosition, type World } from "@/games/alttpr/utils";

/** A world's shuffled entrances, loaded with their tables on demand. */
const EntranceLayer = lazy(
  () => import("@/games/alttpr/components/map/entrances/EntranceLayer"),
);

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

/** A world's markers: a location's (or a cave's), or a dungeon's. */
const Markers = ({ markers }: { markers: readonly MapMarker[] }) =>
  markers.map((marker) =>
    marker.dungeon === undefined ? (
      <MapLocation key={marker.id} marker={marker} />
    ) : (
      <MapDungeon dungeon={marker.dungeon} key={marker.id} marker={marker} />
    ),
  );

/**
 * The two worlds, each drawn as its own square with the markers of the
 * run's world that lie in it: a location's (or a cave's), or a dungeon's.
 * An Inverted run moves some doors (the pack's markersOf); a run with
 * shuffled entrances draws them too, and the checks inside each place
 * above the door noted to lead there (EntranceLayer, loaded on demand). An
 * Overworld Randomizer run that shuffles its bonk drops draws them too.
 * Side by side or
 * stacked, per the player's map layout; on "auto" the map stacks itself
 * when it gets too narrow (see map.css).
 */
export const MapTracker = () => {
  const mapLayout = useGameStore((state) => state.mapLayout);
  const all = useGameStore((state) => markersOf(packSettings(state.settings)));
  const markers = byWorld(all);
  const shuffled = useGameStore((state) => entrancesShuffled(state.settings));

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
          {shuffled ? (
            // Until the entrance tables are in, the markers as they are
            <Suspense fallback={<Markers markers={markers[world.id]} />}>
              <EntranceLayer markers={all} world={world.id} />
            </Suspense>
          ) : (
            <Markers markers={markers[world.id]} />
          )}
          <BonkMarkers world={world.id} />
        </section>
      ))}
    </section>
  );
};

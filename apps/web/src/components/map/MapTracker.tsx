import { MapChest, MapDungeon } from "@/components/map/MapMarkers";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { useGameStore } from "@/stores/gameStore";
import { toWorldPosition, type World } from "@/utils";

const WORLDS: { id: World; label: string }[] = [
  { id: "light", label: "Light World" },
  { id: "dark", label: "Dark World" },
];

/**
 * The two worlds, each drawn as its own square with the chests and dungeons
 * that lie in it. Side by side or stacked, per the player's map layout; on
 * "auto" the map stacks itself when it gets too narrow (see map.css).
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
          {chests.map((chest, index) =>
            toWorldPosition(chest.x, chest.y).world === world.id ? (
              <MapChest
                chest={chest}
                index={index}
                key={`chest-${chest.name}`}
              />
            ) : null,
          )}
          {dungeons.map((dungeon, index) =>
            toWorldPosition(dungeon.x, dungeon.y).world === world.id ? (
              <MapDungeon
                dungeon={dungeon}
                index={index}
                key={`dungeon-${dungeon.image}`}
              />
            ) : null,
          )}
        </section>
      ))}
    </section>
  );
};

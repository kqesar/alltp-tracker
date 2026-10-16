import {
  DungeonBoss,
  DungeonChest,
  MapChest,
} from "@/components/map/MapMarkers";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";

/**
 * MapTracker component handles the map display with chests and dungeons.
 * The tables are static; each marker subscribes to the progress it shows.
 */
export const MapTracker = () => (
  <section
    aria-label="Map tracker with locations and dungeons"
    className="map-container"
    data-testid="map-tracker"
  >
    <h2 className="sr-only">Map Locations</h2>
    {/* Render chests */}
    {chests.map((chest, index) => (
      <MapChest chest={chest} index={index} key={`chest-${chest.name}`} />
    ))}

    {/* Render dungeon bosses */}
    {dungeons.map((dungeon, index) => (
      <DungeonBoss
        dungeon={dungeon}
        index={index}
        key={`boss-${dungeon.image}`}
      />
    ))}

    {/* Render dungeon chests */}
    {dungeons.map((dungeon, index) => (
      <DungeonChest
        dungeon={dungeon}
        index={index}
        key={`dungeon-${dungeon.image}`}
      />
    ))}
  </section>
);

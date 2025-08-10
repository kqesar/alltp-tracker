import { DungeonBoss } from "@/components/map/DungeonBoss";
import { DungeonChest } from "@/components/map/DungeonChest";
import { MapChest } from "@/components/map/MapChest";
import { CSS_CLASSES } from "@/constants";
import { useGameStore } from "@/stores/gameStore";

/**
 * MapTracker component handles the map display with chests and dungeons
 */
export const MapTracker = () => {
  // Get all state and actions from Zustand store
  const { chestsState, dungeonsState } = useGameStore();

  return (
    <section
      aria-label="Map tracker with locations and dungeons"
      className={CSS_CLASSES.MAP_CONTAINER}
      data-testid="map-tracker"
    >
      <h2 className="sr-only">Map Locations</h2>
      {/* Render chests */}
      {chestsState.map((chest, index) => (
        <MapChest chest={chest} index={index} key={`chest-${chest.id}`} />
      ))}

      {/* Render dungeon bosses */}
      {dungeonsState.map((dungeon, index) => (
        <DungeonBoss
          dungeon={dungeon}
          index={index}
          key={`boss-${dungeon.id}`}
        />
      ))}

      {/* Render dungeon chests */}
      {dungeonsState.map((dungeon, index) => (
        <DungeonChest
          dungeon={dungeon}
          index={index}
          key={`dungeon-${dungeon.id}`}
        />
      ))}
    </section>
  );
};

// Not ported yet: app/Region/Standard/LightWorld/DeathMountain/West.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../../world";

export const LIGHT_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Standard/LightWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [],
      id: "westDeathMountain",
      locations: [],
      name: "West Death Mountain",
    },
  ],
} as const satisfies RegionModule;

// Not ported yet: app/Region/Standard/LightWorld/DeathMountain/East.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../../world";

export const LIGHT_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Standard/LightWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [],
      id: "eastDeathMountain",
      locations: [],
      name: "East Death Mountain",
    },
  ],
} as const satisfies RegionModule;

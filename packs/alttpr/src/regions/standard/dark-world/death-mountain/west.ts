// Not ported yet: app/Region/Standard/DarkWorld/DeathMountain/West.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../../world";

export const DARK_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Standard/DarkWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [],
      id: "westDarkWorldDeathMountain",
      locations: [],
      name: "West Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;

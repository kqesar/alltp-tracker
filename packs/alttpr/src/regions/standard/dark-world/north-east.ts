// Not ported yet: app/Region/Standard/DarkWorld/NorthEast.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const DARK_WORLD_NORTH_EAST = {
  file: "app/Region/Standard/DarkWorld/NorthEast.php",
  regions: [
    {
      entrances: [],
      id: "northEastDarkWorld",
      locations: [],
      name: "North East Dark World",
    },
  ],
} as const satisfies RegionModule;

// Not ported yet: app/Region/Standard/DarkWorld/NorthWest.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const DARK_WORLD_NORTH_WEST = {
  file: "app/Region/Standard/DarkWorld/NorthWest.php",
  regions: [
    {
      entrances: [],
      id: "northWestDarkWorld",
      locations: [],
      name: "North West Dark World",
    },
  ],
} as const satisfies RegionModule;

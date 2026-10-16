// Not ported yet: app/Region/Standard/DarkWorld/South.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const DARK_WORLD_SOUTH = {
  file: "app/Region/Standard/DarkWorld/South.php",
  regions: [
    {
      entrances: [],
      id: "southDarkWorld",
      locations: [],
      name: "South Dark World",
    },
  ],
} as const satisfies RegionModule;

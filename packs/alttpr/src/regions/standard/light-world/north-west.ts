// Not ported yet: app/Region/Standard/LightWorld/NorthWest.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const LIGHT_WORLD_NORTH_WEST = {
  file: "app/Region/Standard/LightWorld/NorthWest.php",
  regions: [
    {
      entrances: [],
      id: "northWestLightWorld",
      locations: [],
      name: "North West Light World",
    },
  ],
} as const satisfies RegionModule;

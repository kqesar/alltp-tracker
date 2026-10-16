// Not ported yet: app/Region/Standard/LightWorld/NorthEast.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const LIGHT_WORLD_NORTH_EAST = {
  file: "app/Region/Standard/LightWorld/NorthEast.php",
  regions: [
    {
      entrances: [],
      id: "northEastLightWorld",
      locations: [],
      name: "North East Light World",
    },
  ],
} as const satisfies RegionModule;

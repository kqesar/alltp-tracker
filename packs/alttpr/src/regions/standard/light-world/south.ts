// Not ported yet: app/Region/Standard/LightWorld/South.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const LIGHT_WORLD_SOUTH = {
  file: "app/Region/Standard/LightWorld/South.php",
  regions: [
    {
      entrances: [],
      id: "southLightWorld",
      locations: [],
      name: "South Light World",
    },
  ],
} as const satisfies RegionModule;

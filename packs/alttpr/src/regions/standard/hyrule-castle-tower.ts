// Not ported yet: app/Region/Standard/HyruleCastleTower.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const HYRULE_CASTLE_TOWER = {
  file: "app/Region/Standard/HyruleCastleTower.php",
  regions: [
    {
      entrances: [],
      id: "hyruleCastleTower",
      locations: [],
      name: "Hyrule Castle Tower",
    },
  ],
} as const satisfies RegionModule;

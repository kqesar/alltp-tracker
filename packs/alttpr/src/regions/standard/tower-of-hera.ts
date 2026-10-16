// Not ported yet: app/Region/Standard/TowerOfHera.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const TOWER_OF_HERA = {
  file: "app/Region/Standard/TowerOfHera.php",
  regions: [
    { entrances: [], id: "towerOfHera", locations: [], name: "Tower of Hera" },
  ],
} as const satisfies RegionModule;

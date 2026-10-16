// Not ported yet: app/Region/Standard/ThievesTown.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const THIEVES_TOWN = {
  file: "app/Region/Standard/ThievesTown.php",
  regions: [
    { entrances: [], id: "thievesTown", locations: [], name: "Thieves Town" },
  ],
} as const satisfies RegionModule;

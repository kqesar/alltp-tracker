// Not ported yet: app/Region/Standard/Medallions.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const MEDALLIONS = {
  file: "app/Region/Standard/Medallions.php",
  regions: [
    { entrances: [], id: "medallions", locations: [], name: "Medallions" },
  ],
} as const satisfies RegionModule;

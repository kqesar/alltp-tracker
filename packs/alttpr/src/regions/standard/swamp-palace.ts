// Not ported yet: app/Region/Standard/SwampPalace.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const SWAMP_PALACE = {
  file: "app/Region/Standard/SwampPalace.php",
  regions: [
    { entrances: [], id: "swampPalace", locations: [], name: "Swamp Palace" },
  ],
} as const satisfies RegionModule;

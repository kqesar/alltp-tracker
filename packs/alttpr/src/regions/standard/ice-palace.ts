// Not ported yet: app/Region/Standard/IcePalace.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const ICE_PALACE = {
  file: "app/Region/Standard/IcePalace.php",
  regions: [
    { entrances: [], id: "icePalace", locations: [], name: "Ice Palace" },
  ],
} as const satisfies RegionModule;

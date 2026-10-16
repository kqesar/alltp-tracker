// Not ported yet: app/Region/Standard/DesertPalace.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const DESERT_PALACE = {
  file: "app/Region/Standard/DesertPalace.php",
  regions: [
    { entrances: [], id: "desertPalace", locations: [], name: "Desert Palace" },
  ],
} as const satisfies RegionModule;

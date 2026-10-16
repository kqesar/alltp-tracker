// Not ported yet: app/Region/Standard/Fountains.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const FOUNTAINS = {
  file: "app/Region/Standard/Fountains.php",
  regions: [
    { entrances: [], id: "fountains", locations: [], name: "Fountains" },
  ],
} as const satisfies RegionModule;

// Not ported yet: app/Region/Standard/PalaceOfDarkness.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const PALACE_OF_DARKNESS = {
  file: "app/Region/Standard/PalaceOfDarkness.php",
  regions: [
    {
      entrances: [],
      id: "palaceOfDarkness",
      locations: [],
      name: "Palace of Darkness",
    },
  ],
} as const satisfies RegionModule;

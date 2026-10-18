// app/Region/Inverted/PalaceOfDarkness.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_PALACE_OF_DARKNESS = {
  file: "app/Region/Inverted/PalaceOfDarkness.php",
  regions: [
    {
      entrances: [],
      id: "palaceOfDarkness",
      locations: [],
      name: "Palace of Darkness",
    },
  ],
} as const satisfies RegionModule;

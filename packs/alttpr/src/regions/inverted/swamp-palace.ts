// app/Region/Inverted/SwampPalace.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_SWAMP_PALACE = {
  file: "app/Region/Inverted/SwampPalace.php",
  regions: [
    {
      entrances: [],
      id: "swampPalace",
      locations: [],
      name: "Swamp Palace",
    },
  ],
} as const satisfies RegionModule;

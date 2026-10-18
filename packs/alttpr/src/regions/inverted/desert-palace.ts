// app/Region/Inverted/DesertPalace.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_DESERT_PALACE = {
  file: "app/Region/Inverted/DesertPalace.php",
  regions: [
    {
      entrances: [],
      id: "desertPalace",
      locations: [],
      name: "Desert Palace",
    },
  ],
} as const satisfies RegionModule;

// app/Region/Inverted/EasternPalace.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_EASTERN_PALACE = {
  file: "app/Region/Inverted/EasternPalace.php",
  regions: [
    {
      entrances: [],
      id: "easternPalace",
      locations: [],
      name: "Eastern Palace",
    },
  ],
} as const satisfies RegionModule;

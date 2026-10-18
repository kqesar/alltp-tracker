// app/Region/Inverted/IcePalace.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_ICE_PALACE = {
  file: "app/Region/Inverted/IcePalace.php",
  regions: [
    {
      entrances: [],
      id: "icePalace",
      locations: [],
      name: "Ice Palace",
    },
  ],
} as const satisfies RegionModule;

// app/Region/Inverted/ThievesTown.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_THIEVES_TOWN = {
  file: "app/Region/Inverted/ThievesTown.php",
  regions: [
    {
      entrances: [],
      id: "thievesTown",
      locations: [],
      name: "Thieves Town",
    },
  ],
} as const satisfies RegionModule;

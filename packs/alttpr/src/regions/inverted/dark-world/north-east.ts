// app/Region/Inverted/DarkWorld/NorthEast.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_NORTH_EAST = {
  file: "app/Region/Inverted/DarkWorld/NorthEast.php",
  regions: [
    {
      entrances: [],
      id: "northEastDarkWorld",
      locations: [],
      name: "North East Dark World",
    },
  ],
} as const satisfies RegionModule;

// app/Region/Inverted/DarkWorld/NorthWest.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_NORTH_WEST = {
  file: "app/Region/Inverted/DarkWorld/NorthWest.php",
  regions: [
    {
      entrances: [],
      id: "northWestDarkWorld",
      locations: [],
      name: "North West Dark World",
    },
  ],
} as const satisfies RegionModule;

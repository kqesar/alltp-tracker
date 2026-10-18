// app/Region/Inverted/DarkWorld/South.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_SOUTH = {
  file: "app/Region/Inverted/DarkWorld/South.php",
  regions: [
    {
      entrances: [],
      id: "southDarkWorld",
      locations: [],
      name: "South Dark World",
    },
  ],
} as const satisfies RegionModule;

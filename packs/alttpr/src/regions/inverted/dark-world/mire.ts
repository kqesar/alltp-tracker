// app/Region/Inverted/DarkWorld/Mire.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_MIRE = {
  file: "app/Region/Inverted/DarkWorld/Mire.php",
  regions: [
    {
      entrances: [],
      id: "mire",
      locations: [],
      name: "Mire",
    },
  ],
} as const satisfies RegionModule;

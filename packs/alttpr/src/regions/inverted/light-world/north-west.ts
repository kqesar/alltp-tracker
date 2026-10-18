// app/Region/Inverted/LightWorld/NorthWest.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_LIGHT_WORLD_NORTH_WEST = {
  file: "app/Region/Inverted/LightWorld/NorthWest.php",
  regions: [
    {
      entrances: [],
      id: "northWestLightWorld",
      locations: [],
      name: "North West Light World",
    },
  ],
} as const satisfies RegionModule;

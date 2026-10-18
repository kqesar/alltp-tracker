// app/Region/Inverted/LightWorld/NorthEast.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_LIGHT_WORLD_NORTH_EAST = {
  file: "app/Region/Inverted/LightWorld/NorthEast.php",
  regions: [
    {
      entrances: [],
      id: "northEastLightWorld",
      locations: [],
      name: "North East Light World",
    },
  ],
} as const satisfies RegionModule;

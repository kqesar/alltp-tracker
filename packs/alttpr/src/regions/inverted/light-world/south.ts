// app/Region/Inverted/LightWorld/South.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../world";

export const INVERTED_LIGHT_WORLD_SOUTH = {
  file: "app/Region/Inverted/LightWorld/South.php",
  regions: [
    {
      entrances: [],
      id: "southLightWorld",
      locations: [],
      name: "South Light World",
    },
  ],
} as const satisfies RegionModule;

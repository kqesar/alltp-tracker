// app/Region/Inverted/LightWorld/DeathMountain/West.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../../world";

export const INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Inverted/LightWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [],
      id: "westDeathMountain",
      locations: [],
      name: "West Death Mountain",
    },
  ],
} as const satisfies RegionModule;

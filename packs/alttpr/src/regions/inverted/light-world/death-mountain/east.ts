// app/Region/Inverted/LightWorld/DeathMountain/East.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../../world";

export const INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Inverted/LightWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [],
      id: "eastDeathMountain",
      locations: [],
      name: "East Death Mountain",
    },
  ],
} as const satisfies RegionModule;

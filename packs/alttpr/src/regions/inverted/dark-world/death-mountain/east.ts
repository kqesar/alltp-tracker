// app/Region/Inverted/DarkWorld/DeathMountain/East.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../../world";

export const INVERTED_DARK_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Inverted/DarkWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [],
      id: "eastDarkWorldDeathMountain",
      locations: [],
      name: "East Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;

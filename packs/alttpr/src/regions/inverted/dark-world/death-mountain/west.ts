// app/Region/Inverted/DarkWorld/DeathMountain/West.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../../../world";

export const INVERTED_DARK_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Inverted/DarkWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [],
      id: "westDarkWorldDeathMountain",
      locations: [],
      name: "West Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;

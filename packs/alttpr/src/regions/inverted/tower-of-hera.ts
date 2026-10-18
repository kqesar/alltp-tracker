// app/Region/Inverted/TowerOfHera.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_TOWER_OF_HERA = {
  file: "app/Region/Inverted/TowerOfHera.php",
  regions: [
    {
      entrances: [],
      id: "towerOfHera",
      locations: [],
      name: "Tower of Hera",
    },
  ],
} as const satisfies RegionModule;

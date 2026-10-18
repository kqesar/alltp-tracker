// app/Region/Inverted/HyruleCastleTower.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_HYRULE_CASTLE_TOWER = {
  file: "app/Region/Inverted/HyruleCastleTower.php",
  regions: [
    {
      entrances: [],
      id: "hyruleCastleTower",
      locations: [],
      name: "Hyrule Castle Tower",
    },
  ],
} as const satisfies RegionModule;

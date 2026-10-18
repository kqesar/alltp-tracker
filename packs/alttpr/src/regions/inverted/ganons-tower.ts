// app/Region/Inverted/GanonsTower.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_GANONS_TOWER = {
  file: "app/Region/Inverted/GanonsTower.php",
  regions: [
    {
      entrances: [],
      id: "ganonsTower",
      locations: [],
      name: "Ganons Tower",
    },
  ],
} as const satisfies RegionModule;

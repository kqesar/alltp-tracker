// app/Region/Inverted/SkullWoods.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_SKULL_WOODS = {
  file: "app/Region/Inverted/SkullWoods.php",
  regions: [
    {
      entrances: [],
      id: "skullWoods",
      locations: [],
      name: "Skull Woods",
    },
  ],
} as const satisfies RegionModule;

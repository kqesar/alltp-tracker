// app/Region/Inverted/MiseryMire.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_MISERY_MIRE = {
  file: "app/Region/Inverted/MiseryMire.php",
  regions: [
    {
      entrances: [],
      id: "miseryMire",
      locations: [],
      name: "Misery Mire",
    },
  ],
} as const satisfies RegionModule;

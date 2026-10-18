// app/Region/Inverted/HyruleCastleEscape.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_HYRULE_CASTLE_ESCAPE = {
  file: "app/Region/Inverted/HyruleCastleEscape.php",
  regions: [
    {
      entrances: [],
      id: "escape",
      locations: [],
      name: "Escape",
    },
  ],
} as const satisfies RegionModule;

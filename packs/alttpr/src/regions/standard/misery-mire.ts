// Not ported yet: app/Region/Standard/MiseryMire.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const MISERY_MIRE = {
  file: "app/Region/Standard/MiseryMire.php",
  regions: [
    { entrances: [], id: "miseryMire", locations: [], name: "Misery Mire" },
  ],
} as const satisfies RegionModule;

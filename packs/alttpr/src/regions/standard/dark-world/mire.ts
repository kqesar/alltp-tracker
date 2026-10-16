// Not ported yet: app/Region/Standard/DarkWorld/Mire.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../../world";

export const DARK_WORLD_MIRE = {
  file: "app/Region/Standard/DarkWorld/Mire.php",
  regions: [{ entrances: [], id: "mire", locations: [], name: "Mire" }],
} as const satisfies RegionModule;

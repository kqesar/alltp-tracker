// Not ported yet: app/Region/Standard/SkullWoods.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const SKULL_WOODS = {
  file: "app/Region/Standard/SkullWoods.php",
  regions: [
    { entrances: [], id: "skullWoods", locations: [], name: "Skull Woods" },
  ],
} as const satisfies RegionModule;

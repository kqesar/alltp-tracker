// Not ported yet: app/Region/Standard/GanonsTower.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const GANONS_TOWER = {
  file: "app/Region/Standard/GanonsTower.php",
  regions: [
    { entrances: [], id: "ganonsTower", locations: [], name: "Ganons Tower" },
  ],
} as const satisfies RegionModule;

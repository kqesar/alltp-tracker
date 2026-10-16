// Not ported yet: app/Region/Standard/HyruleCastleEscape.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const HYRULE_CASTLE_ESCAPE = {
  file: "app/Region/Standard/HyruleCastleEscape.php",
  regions: [{ entrances: [], id: "escape", locations: [], name: "Escape" }],
} as const satisfies RegionModule;

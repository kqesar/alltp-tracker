// Not ported yet: app/Region/Standard/TurtleRock.php.
// Its region has no way in and no location, so that the worlds can list the
// module and other modules can name the region.
import type { RegionModule } from "../../world";

export const TURTLE_ROCK = {
  file: "app/Region/Standard/TurtleRock.php",
  regions: [
    { entrances: [], id: "turtleRock", locations: [], name: "Turtle Rock" },
  ],
} as const satisfies RegionModule;

// app/Region/Inverted/TurtleRock.php: pending. Its regions are listed, with no entrance and no
// location, so the Inverted world holds together until the file is ported.
import type { RegionModule } from "../../world";

export const INVERTED_TURTLE_ROCK = {
  file: "app/Region/Inverted/TurtleRock.php",
  regions: [
    {
      entrances: [],
      id: "turtleRock",
      locations: [],
      name: "Turtle Rock",
    },
  ],
} as const satisfies RegionModule;

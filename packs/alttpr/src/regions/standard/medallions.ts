// app/Region/Standard/Medallions.php: the two medallion pads, as locations
// the randomizer places a medallion at. They have no rule: what a pad wants
// is knowledge the player gains in play, which Misery Mire's and Turtle
// Rock's ways in read (src/medallions.ts), and the app decides how to show
// the pads.
//
// The region sets no can_enter, so Region::canEnter is true for it
// (Region.php:217-224): an entrance from the start, cited at the class.
import type { RegionModule } from "../../world";

export const MEDALLIONS = {
  file: "app/Region/Standard/Medallions.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Standard/Medallions.php:14",
        },
      ],
      id: "medallions",
      locations: [
        {
          id: "turtle-rock-medallion",
          kind: "medallion",
          name: "Turtle Rock Medallion",
          req: "true",
          source: "app/Region/Standard/Medallions.php:30",
        },
        {
          id: "misery-mire-medallion",
          kind: "medallion",
          name: "Misery Mire Medallion",
          req: "true",
          source: "app/Region/Standard/Medallions.php:31",
        },
      ],
      name: "Medallions",
    },
  ],
} as const satisfies RegionModule;

// app/Region/Standard/Fountains.php: the prizes of the two fairy fountains
// (Location\Fountain), which upstream holds apart from the overworld and
// gives no rule; the app decides how to show them.
//
// The region sets no can_enter, so Region::canEnter is true for it
// (Region.php:217-224): an entrance from the start, cited at the class.
import type { RegionModule } from "../../world";

export const FOUNTAINS = {
  file: "app/Region/Standard/Fountains.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "true",
          source: "app/Region/Standard/Fountains.php:14",
        },
      ],
      id: "fountains",
      locations: [
        {
          id: "waterfall-bottle",
          kind: "fountain",
          name: "Waterfall Bottle",
          req: "true",
          source: "app/Region/Standard/Fountains.php:30",
        },
        {
          id: "pyramid-bottle",
          kind: "fountain",
          name: "Pyramid Bottle",
          req: "true",
          source: "app/Region/Standard/Fountains.php:31",
        },
      ],
      name: "Fountains",
    },
  ],
} as const satisfies RegionModule;

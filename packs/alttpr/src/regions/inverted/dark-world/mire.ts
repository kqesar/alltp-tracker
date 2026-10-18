// app/Region/Inverted/DarkWorld/Mire.php: the Mire and its shed.
//
// Its initalize (18-30) replaces Standard's without calling it: the shed's
// chests, which it sets no rule for, need only the region
// (Location.php:96-111).
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_MIRE = {
  file: "app/Region/Inverted/DarkWorld/Mire.php",
  regions: [
    {
      // can_enter (20-27)
      entrances: [
        {
          from: "start",
          req: "@canFly",
          source: "app/Region/Inverted/DarkWorld/Mire.php:21",
        },
        {
          from: "southLightWorld",
          req: "magicMirror",
          source: "app/Region/Inverted/DarkWorld/Mire.php:22",
        },
        {
          from: "start",
          req: "setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Inverted/DarkWorld/Mire.php:23",
        },
        {
          from: "start",
          req: "setting(canOWYBA) & @hasABottle",
          source: "app/Region/Inverted/DarkWorld/Mire.php:24",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/DarkWorld/Mire.php:26",
        },
      ],
      id: "mire",
      locations: [
        {
          id: "mire-shed/left",
          kind: "chest",
          name: "Mire Shed - Left",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/Mire.php:18",
        },
        {
          id: "mire-shed/right",
          kind: "chest",
          name: "Mire Shed - Right",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/Mire.php:18",
        },
      ],
      name: "Mire",
    },
  ],
} as const satisfies RegionModule;

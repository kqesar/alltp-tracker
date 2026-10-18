// app/Region/Inverted/LightWorld/DeathMountain/West.php: West Death
// Mountain and its locations. Ether Tablet and Spectacle Rock move to East
// Death Mountain's file (24-25).
//
// Its initalize (34-51) replaces Standard's without calling it: Spectacle
// Rock Cave, which it sets no rule for, needs only the region
// (Location.php:96-111).
import type { RegionModule } from "../../../../world";

export const INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Inverted/LightWorld/DeathMountain/West.php",
  regions: [
    {
      // can_enter (40-48)
      entrances: [
        {
          from: "start",
          req: "@canFly",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:41",
        },
        {
          from: "start",
          req: "@canLiftRocks & lamp >= setting(requireLamp)",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:42",
        },
        {
          from: "start",
          req: "setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:43",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:45",
        },
        {
          from: "start",
          req: "setting(canOWYBA) & @hasABottle",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:46",
        },
      ],
      id: "westDeathMountain",
      locations: [
        {
          id: "old-man",
          kind: "npc",
          name: "Old Man",
          req: "lamp >= setting(requireLamp)",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:36",
        },
        {
          id: "spectacle-rock-cave",
          kind: "standing",
          name: "Spectacle Rock Cave",
          req: "true",
          source: "app/Region/Inverted/LightWorld/DeathMountain/West.php:34",
        },
      ],
      name: "West Death Mountain",
    },
  ],
} as const satisfies RegionModule;

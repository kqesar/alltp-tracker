// app/Region/Inverted/DarkWorld/DeathMountain/West.php: the west of the
// Dark World's Death Mountain, climbed to from the Dark World, and its
// location.
//
// Its initalize (33-56) replaces Standard's without calling it. The Dark
// Death Mountain Fairy, a shop, is gone (24).
import type { RegionModule } from "../../../../world";

export const INVERTED_DARK_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Inverted/DarkWorld/DeathMountain/West.php",
  regions: [
    {
      // can_enter (46-53)
      entrances: [
        {
          from: "start",
          req: "@canFly",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:47",
        },
        {
          from: "start",
          req: "@canLiftRocks & lamp >= setting(requireLamp)",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:48",
        },
        {
          from: "start",
          req: "setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:49",
        },
        {
          from: "start",
          req: "setting(canOWYBA) & @hasABottle",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:50",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:52",
        },
      ],
      id: "westDarkWorldDeathMountain",
      locations: [
        {
          id: "spike-cave",
          kind: "chest",
          name: "Spike Cave",
          req: "hammer & @canLiftRocks & (@canExtendMagic & cape | (!setting(cantTakeDamage) | @canExtendMagic) & caneOfByrna)",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/West.php:35",
        },
      ],
      name: "West Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;

// app/Region/Inverted/DarkWorld/DeathMountain/East.php: the east of the
// Dark World's Death Mountain and its locations.
//
// Its initalize (18-74) replaces Standard's without calling it: Superbunny
// Cave's chests, which it sets no rule for, need only the region
// (Location.php:96-111).
import type { RegionModule } from "../../../../world";

/** Into the Hookshot Cave, which each of its rules holds (20-57). */
const HOOKSHOT_CAVE =
  "@canLiftRocks | magicMirror & @canBombThings & reach(eastDeathMountain) | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)";

export const INVERTED_DARK_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Inverted/DarkWorld/DeathMountain/East.php",
  regions: [
    {
      // can_enter (60-71)
      entrances: [
        {
          from: "westDarkWorldDeathMountain",
          req: "!setting(cantTakeDamage) | caneOfByrna | cape | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:61",
        },
        {
          from: "westDeathMountain",
          req: "magicMirror & moonPearl & hookshot",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:67",
        },
      ],
      id: "eastDarkWorldDeathMountain",
      locations: [
        {
          id: "superbunny-cave/top",
          kind: "chest",
          name: "Superbunny Cave - Top",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:18",
        },
        {
          id: "superbunny-cave/bottom",
          kind: "chest",
          name: "Superbunny Cave - Bottom",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:18",
        },
        {
          id: "hookshot-cave/top-right",
          kind: "chest",
          name: "Hookshot Cave - Top Right",
          req: `hookshot & (${HOOKSHOT_CAVE})`,
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:20",
        },
        {
          id: "hookshot-cave/top-left",
          kind: "chest",
          name: "Hookshot Cave - Top Left",
          req: `hookshot & (${HOOKSHOT_CAVE})`,
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:30",
        },
        {
          id: "hookshot-cave/bottom-left",
          kind: "chest",
          name: "Hookshot Cave - Bottom Left",
          req: `hookshot & (${HOOKSHOT_CAVE})`,
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:40",
        },
        {
          id: "hookshot-cave/bottom-right",
          kind: "chest",
          name: "Hookshot Cave - Bottom Right",
          req: `(hookshot | pegasusBoots) & (${HOOKSHOT_CAVE})`,
          source: "app/Region/Inverted/DarkWorld/DeathMountain/East.php:50",
        },
      ],
      name: "East Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;

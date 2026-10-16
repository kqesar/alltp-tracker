// app/Region/Standard/LightWorld/DeathMountain/East.php: East Death
// Mountain, entered from West Death Mountain by the hookshot and from Tower
// of Hera by the hammer, and its locations.
//
// Not ported here: the Light World Death Mountain Shop and the Hookshot
// Fairy (44-53, 64-66), which are shops, not locations. The glitch branches
// of can_enter (91-94) and of the two rules stay behind their flags, which
// NoGlitches folds away.
import type { RegionModule } from "../../../../world";

export const LIGHT_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Standard/LightWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:91",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:92",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canSuperSpeed) & @canSpinSpeed",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:93",
        },
        {
          from: "westDeathMountain",
          req: "rescueZelda & ((setting(canMirrorClip) | setting(canMirrorWrap)) & magicMirror | hookshot)",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:94",
        },
        {
          from: "towerOfHera",
          req: "rescueZelda & hammer",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:97",
        },
      ],
      id: "eastDeathMountain",
      locations: [
        {
          id: "spiral-cave",
          kind: "chest",
          name: "Spiral Cave",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:32",
        },
        {
          // Its door is reached from inside Turtle Rock, with two of its
          // keys, and the mirror
          id: "mimic-cave",
          kind: "chest",
          name: "Mimic Cave",
          req: "hammer & magicMirror & (setting(canMirrorClip) | setting(canBootsClip) & pegasusBoots & (moonPearl | setting(canOWYBA) & bottle) | setting(canSuperSpeed) & @canSpinSpeed & moonPearl & reach(eastDarkWorldDeathMountain) | setting(canOneFrameClipOW) | keyD7 >= 2 & reach(turtleRock))",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:68",
        },
        {
          id: "paradox-cave-lower/far-left",
          kind: "chest",
          name: "Paradox Cave Lower - Far Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:34",
        },
        {
          id: "paradox-cave-lower/left",
          kind: "chest",
          name: "Paradox Cave Lower - Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:35",
        },
        {
          id: "paradox-cave-lower/right",
          kind: "chest",
          name: "Paradox Cave Lower - Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:36",
        },
        {
          id: "paradox-cave-lower/far-right",
          kind: "chest",
          name: "Paradox Cave Lower - Far Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:37",
        },
        {
          id: "paradox-cave-lower/middle",
          kind: "chest",
          name: "Paradox Cave Lower - Middle",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:38",
        },
        {
          id: "paradox-cave-upper/left",
          kind: "chest",
          name: "Paradox Cave Upper - Left",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:39",
        },
        {
          id: "paradox-cave-upper/right",
          kind: "chest",
          name: "Paradox Cave Upper - Right",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:40",
        },
        {
          // Reached by the mirror from the Dark World's Death Mountain, and
          // seen on its island from where the player stands
          id: "floating-island",
          kind: "standing",
          name: "Floating Island",
          req: "setting(canBootsClip) & pegasusBoots | setting(canOWYBA) & bottle | setting(canOneFrameClipOW) | magicMirror & (moonPearl & @canBombThings & @canLiftRocks | setting(canMirrorWrap)) & reach(eastDarkWorldDeathMountain)",
          source: "app/Region/Standard/LightWorld/DeathMountain/East.php:79",
          visible: { source: "game" },
        },
      ],
      name: "East Death Mountain",
    },
  ],
} as const satisfies RegionModule;

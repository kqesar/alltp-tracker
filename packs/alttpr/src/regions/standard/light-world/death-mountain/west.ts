// app/Region/Standard/LightWorld/DeathMountain/West.php: West Death
// Mountain, entered from anywhere by the flute or by a glove and the lamp,
// and its locations.
//
// The glitch branches of can_enter (65-68) and Spectacle Rock's (58-59) stay
// behind their flags, which NoGlitches folds away.
import type { RegionModule } from "../../../../world";

export const LIGHT_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Standard/LightWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda & @canFly",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:64",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:65",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOWYBA) & @hasABottle",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:66",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:67",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canSuperSpeed) & @canSpinSpeed",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:68",
        },
        {
          from: "start",
          req: "rescueZelda & @canLiftRocks & lamp >= setting(requireLamp)",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:69",
        },
      ],
      id: "westDeathMountain",
      locations: [
        {
          id: "old-man",
          kind: "npc",
          name: "Old Man",
          req: "lamp >= setting(requireLamp)",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:46",
        },
        {
          id: "spectacle-rock-cave",
          kind: "standing",
          name: "Spectacle Rock Cave",
          req: "true",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:31",
        },
        {
          // On the upper ledge, which upstream reaches as Tower of Hera's way
          // in: the Book reads it there, and a sword (or the hammer,
          // swordless) takes the item
          id: "ether-tablet",
          kind: "drop",
          name: "Ether Tablet",
          req: "bookOfMudora & (@hasSword2 | setting(swordless) & hammer) & reach(towerOfHera)",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:50",
          visible: {
            req: "bookOfMudora & reach(towerOfHera)",
            source: "game",
          },
        },
        {
          // Seen on its rock from the path below
          id: "spectacle-rock",
          kind: "standing",
          name: "Spectacle Rock",
          req: "magicMirror | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)",
          source: "app/Region/Standard/LightWorld/DeathMountain/West.php:56",
          visible: { source: "game" },
        },
      ],
      name: "West Death Mountain",
    },
  ],
} as const satisfies RegionModule;

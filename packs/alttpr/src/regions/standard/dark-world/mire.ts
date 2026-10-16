// app/Region/Standard/DarkWorld/Mire.php: the Mire, behind the dark rocks
// of the desert, and its shed.
//
// Not ported here: the shops (36-39, 50-64), which are not locations.
import type { RegionModule } from "../../../world";

/**
 * Either chest of the shed (66-84): the pearl, or a glitch that does as
 * much.
 */
const SHED =
  "moonPearl | setting(canOWYBA) & @hasABottle & (setting(canOneFrameClipOW) | @hasBottle2 | magicMirror & bugCatchingNet & setting(canBunnyRevive) | setting(canBootsClip) & pegasusBoots) | setting(canSuperBunny) & magicMirror";

export const DARK_WORLD_MIRE = {
  file: "app/Region/Standard/DarkWorld/Mire.php",
  regions: [
    {
      // can_enter (86-96): RescueZelda, and one of its branches
      entrances: [
        {
          from: "start",
          req: "rescueZelda & @canLiftDarkRocks & (@canFly | setting(canBootsClip) & pegasusBoots)",
          source: "app/Region/Standard/DarkWorld/Mire.php:88",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/DarkWorld/Mire.php:90",
        },
        {
          from: "southDarkWorld",
          req: "rescueZelda & ((moonPearl | setting(canBunnyRevive) & @canBunnyRevive) & setting(canBootsClip) & pegasusBoots | setting(canMirrorWrap) & magicMirror)",
          source: "app/Region/Standard/DarkWorld/Mire.php:91",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOWYBA) & @hasABottle",
          source: "app/Region/Standard/DarkWorld/Mire.php:95",
        },
      ],
      id: "mire",
      locations: [
        {
          id: "mire-shed/left",
          kind: "chest",
          name: "Mire Shed - Left",
          req: SHED,
          source: "app/Region/Standard/DarkWorld/Mire.php:66",
        },
        {
          id: "mire-shed/right",
          kind: "chest",
          name: "Mire Shed - Right",
          req: SHED,
          source: "app/Region/Standard/DarkWorld/Mire.php:76",
        },
      ],
      name: "Mire",
    },
  ],
} as const satisfies RegionModule;

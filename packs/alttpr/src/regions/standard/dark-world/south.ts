// app/Region/Standard/DarkWorld/South.php: South Dark World, from the Hype
// Cave to the Digging Game.
//
// Not ported here: the shops (41-54, 108-145), which are not locations.
import type { RegionModule } from "../../../world";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive";

export const DARK_WORLD_SOUTH = {
  file: "app/Region/Standard/DarkWorld/South.php",
  regions: [
    {
      // can_enter (147-156): RescueZelda, and one of its branches
      entrances: [
        {
          from: "start",
          req: "rescueZelda & setting(canOWYBA) & @hasABottle",
          source: "app/Region/Standard/DarkWorld/South.php:149",
        },
        {
          from: "northEastDarkWorld",
          req: "rescueZelda & (moonPearl | setting(canBunnyRevive) & @canBunnyRevive) & (hammer | setting(canSuperSpeed) & @canSpinSpeed & (setting(canFakeFlipper) | flippers))",
          source: "app/Region/Standard/DarkWorld/South.php:150",
        },
        {
          from: "northWestDarkWorld",
          req: "rescueZelda",
          source: "app/Region/Standard/DarkWorld/South.php:155",
        },
      ],
      id: "southDarkWorld",
      locations: [
        {
          id: "hype-cave/top",
          kind: "chest",
          name: "Hype Cave - Top",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:65",
        },
        {
          id: "hype-cave/middle-right",
          kind: "chest",
          name: "Hype Cave - Middle Right",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:71",
        },
        {
          id: "hype-cave/middle-left",
          kind: "chest",
          name: "Hype Cave - Middle Left",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:77",
        },
        {
          id: "hype-cave/bottom",
          kind: "chest",
          name: "Hype Cave - Bottom",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:83",
        },
        {
          id: "stumpy",
          kind: "npc",
          name: "Stumpy",
          req: `${PEARL} | magicMirror & setting(canMirrorWrap)`,
          source: "app/Region/Standard/DarkWorld/South.php:95",
        },
        {
          id: "hype-cave/npc",
          kind: "npc",
          name: "Hype Cave - NPC",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:89",
        },
        {
          id: "digging-game",
          kind: "dig",
          name: "Digging Game",
          req: PEARL,
          source: "app/Region/Standard/DarkWorld/South.php:102",
        },
      ],
      name: "South Dark World",
    },
  ],
} as const satisfies RegionModule;

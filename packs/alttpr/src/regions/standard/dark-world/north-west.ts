// app/Region/Standard/DarkWorld/NorthWest.php: North West Dark World,
// Village of Outcasts and its surroundings.
//
// Not ported here: the shops (41-61, 72-76), which are not locations.
import type { RegionModule } from "../../../world";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive";

/**
 * The Blacksmith (118-128): the frog is brought back from here, behind the
 * dark rocks, to the smith in the Light World, whom the basic placement
 * wants reached by mirror. Purple Chest starts with it (131).
 */
const BLACKSMITH = `(!setting(basicPlacement) | magicMirror) & ((${PEARL}) & @canLiftDarkRocks | setting(canOWYBA) & @hasABottle & (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots & (moonPearl | @hasBottle2)))`;

/** Over the dark rocks, or round them through the water (100-105, 136-140). */
const PAST_ROCKS =
  "@canLiftDarkRocks | (setting(canFakeFlipper) | flippers) & (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed)";

export const DARK_WORLD_NORTH_WEST = {
  file: "app/Region/Standard/DarkWorld/NorthWest.php",
  regions: [
    {
      // can_enter (143-164): RescueZelda, and one of its branches
      entrances: [
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:145",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOWYBA) & @hasABottle",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:146",
        },
        {
          from: "westDeathMountain",
          req: "rescueZelda & magicMirror & (setting(canMirrorClip) | setting(canMirrorWrap) & (setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed))",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:147",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canBunnySurf) & setting(canMirrorWrap) & magicMirror & flippers & defeatAgahnim",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:152",
        },
        // 154-163: the pearl, then the hammer and a glove, the dark rocks,
        // or from North East Dark World by hookshot
        {
          from: "start",
          req: "rescueZelda & moonPearl & (hammer & @canLiftRocks | @canLiftDarkRocks | setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed)",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:154",
        },
        {
          from: "northEastDarkWorld",
          req: "rescueZelda & moonPearl & (hookshot | setting(canMirrorWrap) & magicMirror) & (@canLiftRocks | hammer | flippers | setting(canBunnyRevive) & @canBunnyRevive)",
          source: "app/Region/Standard/DarkWorld/NorthWest.php:155",
        },
      ],
      id: "northWestDarkWorld",
      locations: [
        {
          id: "brewery",
          kind: "chest",
          name: "Brewery",
          req: `@canBombThings & (${PEARL})`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:78",
        },
        {
          id: "c-shaped-house",
          kind: "chest",
          name: "C-Shaped House",
          req: `${PEARL} | setting(canSuperBunny)`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:84",
        },
        {
          id: "chest-game",
          kind: "chest",
          name: "Chest Game",
          req: `${PEARL} | setting(canSuperBunny)`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:90",
        },
        {
          id: "hammer-pegs",
          kind: "standing",
          name: "Hammer Pegs",
          req: `hammer & (${PEARL}) & (${PAST_ROCKS} | magicMirror & setting(canMirrorWrap))`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:96",
        },
        {
          id: "bumper-cave",
          kind: "standing",
          name: "Bumper Cave",
          req: `setting(canOneFrameClipOW) | (${PEARL}) & (setting(canBootsClip) & pegasusBoots | (!setting(basicPlacement) | hookshot) & @canLiftRocks & cape)`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:108",
          // Its ledge is in sight from the road below
          visible: { source: "game" },
        },
        {
          id: "blacksmith",
          kind: "npc",
          name: "Blacksmith",
          req: BLACKSMITH,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:118",
        },
        {
          id: "purple-chest",
          kind: "npc",
          name: "Purple Chest",
          req: `${BLACKSMITH} & (magicMirror & setting(canMirrorWrap) | (${PEARL}) & (${PAST_ROCKS}))`,
          source: "app/Region/Standard/DarkWorld/NorthWest.php:130",
        },
      ],
      name: "North West Dark World",
    },
  ],
} as const satisfies RegionModule;
